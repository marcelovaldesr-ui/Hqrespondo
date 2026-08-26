import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONECTA_FOCO, ESTADOS_FOCO, MAX_SIN_CONTESTAR, RESULTADO_CFG, RESULTADOS_FOCO, type ResultadoFoco } from "@/lib/foco";
import { NIVELES_ENCAJE } from "@/lib/encaje";
import { personaDeLogin, quienEs } from "@/lib/equipo";
import { PLAN_PRECIOS } from "@/lib/types";
import { normalizarTelefono, registrarActividad } from "@/lib/actividades";

/**
 * /api/foco
 *
 *  POST  { id, resultado, nota?, actor? }  → registra el desenlace de un toque
 *  PATCH { id, nota?, tags?, recordatorio?, estado? } → edición manual
 *
 * El POST hace TODO lo que implica una disposición, en un solo lugar:
 * cambia el estado, reagenda si corresponde, suma el intento, escribe en la
 * bitácora y suprime el número si la persona dijo que no. Repartir eso entre
 * la UI y varios endpoints es la receta para que un día algo quede a medias.
 */

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const id = String(b.id ?? "");
    const resultado = String(b.resultado ?? "") as ResultadoFoco;
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
    if (!RESULTADOS_FOCO.includes(resultado)) {
      return NextResponse.json({ error: "resultado inválido" }, { status: 400 });
    }

    const s = db();
    const { data: lead, error: e1 } = await s
      .from("leads_foco")
      .select("id,empresa,contacto,cargo,telefono,industria,intentos,sin_contestar,nota,rut,lista")
      .eq("id", id)
      .single();
    if (e1 || !lead) return NextResponse.json({ error: "lead no encontrado" }, { status: 404 });

    const cfg = RESULTADO_CFG[resultado];
    const ahora = new Date();
    const nota = String(b.nota ?? "").trim();
    const actor =
      String(b.actor ?? "").trim() || personaDeLogin(req.headers.get("x-hq-user"));

    const upd: Record<string, unknown> = {
      ultimo_resultado: resultado,
      ultimo_intento: ahora.toISOString(),
      updated_at: ahora.toISOString(),
    };
    if (cfg.estado) upd.estado = cfg.estado;
    if (cfg.cuentaIntento) upd.intentos = (lead.intentos ?? 0) + 1;

    // Regla TGP: 3 sin contestar seguidas y el lead sale solo de la base.
    // Cualquier respuesta humana —portero incluido— reinicia el contador,
    // porque prueba que el número funciona; lo que retira es el número muerto.
    let retirado = false;
    if (resultado === "no_contesta") {
      const seguidas = (lead.sin_contestar ?? 0) + 1;
      upd.sin_contestar = seguidas;
      if (seguidas >= MAX_SIN_CONTESTAR) {
        retirado = true;
        upd.estado = "descartado";
        upd.recordatorio = null;
      }
    } else if (CONECTA_FOCO.includes(resultado) || resultado === "gatekeeper" || resultado === "derivo") {
      upd.sin_contestar = 0;
    }
    if (retirado) {
      // nada: el retiro ya fijó estado y recordatorio
    } else if (cfg.reagendaDias !== null) {
      const r = new Date(ahora);
      r.setDate(r.getDate() + cfg.reagendaDias);
      r.setHours(9, 0, 0, 0);
      upd.recordatorio = r.toISOString();
    } else {
      // Un desenlace definitivo no debe dejar un recordatorio colgando: la
      // fila volvería sola a una cola de la que ya salió.
      upd.recordatorio = null;
    }
    let notaAcum = lead.nota ?? "";
    if (nota) {
      const linea = `[${ahora.toLocaleDateString("es-CL")} · ${cfg.label}] ${nota}`;
      notaAcum = notaAcum ? `${notaAcum}\n${linea}` : linea;
    }

    // Número equivocado: el teléfono se saca de la ficha y se preserva en la
    // nota. Dejarlo puesto era peor que borrarlo: el lead seguía encabezando
    // la cola de hoy con un número que ya se sabía malo, para siempre.
    // Al vaciarlo, `contactabilidad` (columna generada) se recalcula sola y el
    // lead baja hasta que alguien consiga el número bueno.
    if (resultado === "equivocado" && lead.telefono) {
      upd.telefono = "";
      const marca = `[${ahora.toLocaleDateString("es-CL")}] Número equivocado: ${lead.telefono} (se quitó de la ficha)`;
      notaAcum = notaAcum ? `${notaAcum}\n${marca}` : marca;
    }
    if (retirado) {
      const marca = `[${ahora.toLocaleDateString("es-CL")}] Retirado: ${MAX_SIN_CONTESTAR} llamadas sin contestar (regla de la base). Vuelve solo si se consigue otro número.`;
      notaAcum = notaAcum ? `${notaAcum}\n${marca}` : marca;
    }
    if (notaAcum !== (lead.nota ?? "")) upd.nota = notaAcum;

    const { error: e2 } = await s.from("leads_foco").update(upd).eq("id", id);
    if (e2) throw new Error(e2.message);

    // ---- El veredicto vuelve a la empresa de origen ----
    // Este bloque es la razón de ser de toda la cascada. Encontrar un teléfono
    // no prueba nada; lo único que resuelve de quién es un número es la llamada.
    // Acá esa respuesta viaja de vuelta a `empresas_sii` para poder contestar,
    // con datos y no con fe: de los números que encontramos, ¿cuántos eran del
    // que decide?
    //
    // Los ambiguos quedan en null a propósito. "Mándanos un correo" es lo que
    // dice una recepcionista tanto como un dueño apurado: contarlo como acierto
    // sería inflar la métrica que estamos tratando de medir.
    const VERDICTO: Partial<Record<ResultadoFoco, "decisor" | "recepcion" | "malo">> = {
      exito: "decisor", rechazo: "decisor", ya_cliente: "decisor", no_aplica: "decisor",
      gatekeeper: "recepcion", derivo: "recepcion",
      equivocado: "malo", no_existe: "malo",
    };
    const verdicto = VERDICTO[resultado];
    if (verdicto && lead.rut) {
      const { error: eV } = await s
        .from("empresas_sii")
        .update({ telefono_directo_verdicto: verdicto, verificado_at: ahora.toISOString() })
        .eq("rut", lead.rut)
        .not("telefono_directo", "is", null);
      if (eV) console.error("[foco] no se pudo devolver el veredicto a empresas_sii:", eV.message);
    }

    await registrarActividad({
      lead_foco_id: lead.id,
      contacto: lead.telefono ?? "",
      actor,
      canal: "llamada",
      tipo: "toque",
      // La bitácora tiene su propio vocabulario, más chico. Se mapea lo que
      // calza y el resto entra como "contactado" para no perder el toque.
      resultado:
        resultado === "no_contesta" ? "no_contesto"
        : resultado === "gatekeeper" ? "gatekeeper"
        : resultado === "exito" ? "interesado"
        : resultado === "rechazo" || resultado === "no_contactar" ? "no_interesa"
        : resultado === "equivocado" || resultado === "no_existe" ? "numero_malo"
        : resultado === "no_aplica" || resultado === "duplicado" ? "fuera_icp"
        : resultado === "llamar_mas_tarde" ? "seguimiento"
        : "contactado",
      nota: `${lead.empresa} · ${lead.contacto} — ${cfg.label}${nota ? ` · ${nota}` : ""}`,
    });

    if (cfg.suprime && lead.telefono) {
      const valor = normalizarTelefono(lead.telefono);
      if (valor) {
        await s.from("supresiones").upsert(
          { valor, tipo: "telefono", motivo: `Leads Foco — ${cfg.label}`, origen: "foco" },
          { onConflict: "valor", ignoreDuplicates: true },
        );
      }
    }

    // Éxito = reunión agendada. Eso tiene que aparecer en el Pipeline, no
    // quedarse viviendo dentro de Foco: el Kanban tiene una columna que se
    // llama exactamente "Reunión agendada". Si ya existe un deal con ese nombre
    // no se duplica (pudo haberse creado a mano).
    let dealCreado = false;
    if (resultado === "exito") {
      try {
        const { data: existe } = await s
          .from("deals")
          .select("id")
          .ilike("nombre_negocio", lead.empresa)
          .limit(1);
        if (!existe?.length) {
          const precios = PLAN_PRECIOS.crecimiento;
          const { error: eDeal } = await s.from("deals").insert({
            nombre_negocio: lead.empresa,
            rubro: lead.industria || null,
            plan: "crecimiento",
            valor_setup: precios.setup,
            valor_mensual: precios.mensual,
            etapa: "demo",
            proxima_accion: "Preparar la reunión agendada desde Leads Foco",
            notas: [
              `Origen: Leads Foco.`,
              lead.contacto ? `Contacto: ${lead.contacto}${lead.cargo ? ` (${lead.cargo})` : ""}.` : "",
              lead.telefono ? `Teléfono: ${lead.telefono}.` : "",
              nota ? `Nota de la llamada: ${nota}` : "",
            ].filter(Boolean).join(" "),
          });
          if (eDeal) console.error("[foco] no se pudo crear el deal:", eDeal.message);
          else dealCreado = true;
        }
      } catch (e) {
        // Si el deal falla, el registro del éxito NO se pierde: ya quedó en el
        // lead y en la bitácora. Se avisa en la respuesta para que la UI lo diga.
        console.error("[foco] error creando deal:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      estado: cfg.estado,
      reagenda: retirado ? null : cfg.reagendaDias,
      retirado,
      dealCreado,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/foco  { id }
 *
 * Borra un lead de verdad. Es lo correcto para lo que se acumula de sobra:
 * pruebas, duplicados, empresas que no eran, tandas mal filtradas de Apollo.
 * Dejar basura en la cola le cuesta atención a quien llama todos los días.
 *
 * Lo que NO se borra es la bitácora. Desde la migración 035 la actividad
 * sobrevive al lead con `lead_foco_id` en NULL: conserva el teléfono, el actor,
 * el resultado y la nota con el nombre de la empresa. Si a alguien se le llamó,
 * ese hecho no desaparece porque después se borre la ficha — ni para las
 * métricas ni para la Ley 21.719.
 *
 * Y antes de irse deja constancia de su propio borrado, con quién lo hizo.
 */
export async function DELETE(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const id = String(b.id ?? new URL(req.url).searchParams.get("id") ?? "");
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

    const s = db();
    const { data: lead, error: e1 } = await s
      .from("leads_foco")
      .select("id,empresa,contacto,telefono,intentos,lista")
      .eq("id", id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!lead) return NextResponse.json({ error: "lead no encontrado" }, { status: 404 });

    const quien = quienEs(req) ?? "alguien sin sesión";

    // Cuántas llamadas quedan registradas. Se informa al que borra: no para
    // impedírselo, sino para que sepa qué está sacando de la cola.
    const { count } = await s
      .from("actividades")
      .select("id", { count: "exact", head: true })
      .eq("lead_foco_id", id);

    // La constancia va ANTES del borrado: si el delete falla, queda anotado el
    // intento; si el orden fuera al revés y fallara la anotación, el lead se
    // habría ido sin dejar rastro.
    await registrarActividad({
      contacto: lead.telefono ?? "",
      actor: quien,
      canal: "otro",
      tipo: "toque",
      resultado: "fuera_icp",
      nota: `Lead borrado de Foco (lista ${lead.lista}): ${lead.empresa}${lead.contacto ? ` · ${lead.contacto}` : ""}. Tenía ${lead.intentos ?? 0} intento(s).`,
    });

    const { error: e2 } = await s.from("leads_foco").delete().eq("id", id);
    if (e2) throw new Error(e2.message);

    return NextResponse.json({
      ok: true,
      borrado: lead.empresa,
      actividades_conservadas: count ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    const id = String(b.id ?? "");
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Toda edición queda firmada sola. Antes se podía cambiar el teléfono o el
    // estado de un lead sin que quedara rastro de quién lo hizo.
    const quien = quienEs(req);
    if (quien) upd.actualizado_por = quien;
    if (b.nota !== undefined) upd.nota = String(b.nota).slice(0, 4000);
    // Validado contra la lista cerrada: un estado inventado rebotaría en el
    // CHECK de la tabla como un 500 críptico en vez de un 400 que explica.
    if (b.estado !== undefined) {
      if (!ESTADOS_FOCO.includes(b.estado)) {
        return NextResponse.json({ error: `estado inválido: ${b.estado}` }, { status: 400 });
      }
      upd.estado = b.estado;
    }
    // Campos de contacto editables desde la ficha. Existen porque la cola
    // "Por investigar" produce exactamente esto —un nombre, un cargo, un
    // número encontrados a mano— y sin esta puerta el hallazgo no tenía
    // dónde anotarse más que en la nota, donde no ordena ninguna cola.
    // Todo lo que la ficha muestra tiene que poder corregirse desde la ficha.
    // Antes eran siete campos y la ficha tenía el doble: para arreglar la
    // comuna o el rubro de un lead había que entrar a Supabase.
    const EDITABLES = [
      "empresa", "razon_social", "rut", "contacto", "cargo",
      "telefono", "email", "web", "linkedin_contacto", "linkedin_empresa",
      "industria", "comuna", "region",
    ] as const;
    for (const campo of EDITABLES) {
      if (b[campo] !== undefined) upd[campo] = String(b[campo]).trim().slice(0, 300);
    }
    // La señal es un párrafo, no una línea: se le da más espacio.
    if (b.senal !== undefined) upd.senal = String(b.senal).trim().slice(0, 1200);
    // Número, no texto: vacío significa "no se sabe", y eso es NULL, no cero.
    if (b.n_empleados !== undefined) {
      const n = Number(b.n_empleados);
      upd.n_empleados = Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 100_000) : null;
    }
    if (upd.empresa === "") delete upd.empresa; // la empresa nunca queda vacía
    if (b.recordatorio !== undefined) upd.recordatorio = b.recordatorio || null;

    // ---- Varios teléfonos / correos (migración 034) ----
    // `usar_telefono` promueve uno del arreglo a primario: es el que ordena la
    // cola y el que alguien marca. Cambiarlo es una decisión ("el móvil no
    // contesta, probemos el fijo"), no una edición de texto.
    if (Array.isArray(b.telefonos)) upd.telefonos = b.telefonos.slice(0, 8);
    if (Array.isArray(b.emails)) upd.emails = b.emails.slice(0, 8);
    if (typeof b.usar_telefono === "string" && b.usar_telefono.trim()) {
      upd.telefono = b.usar_telefono.trim().slice(0, 60);
    }
    if (typeof b.usar_email === "string" && b.usar_email.trim()) {
      upd.email = b.usar_email.trim().slice(0, 200);
    }
    // Próximo paso: QUÉ hacer. Va aparte del recordatorio, que dice CUÁNDO, y
    // aparte de la nota, donde un compromiso se pierde entre el relato.
    if (b.proximo_paso !== undefined) upd.proximo_paso = String(b.proximo_paso).trim().slice(0, 600) || null;
    if (b.proximo_paso_at !== undefined) upd.proximo_paso_at = b.proximo_paso_at || null;
    if (Array.isArray(b.tags)) upd.tags = b.tags.map(String).slice(0, 12);
    // Corregir el encaje a mano lo deja marcado como manual, para que una
    // reimportación no vuelva a pisarlo con lo que dice la regla.
    if (b.encaje !== undefined && NIVELES_ENCAJE.includes(b.encaje)) {
      upd.encaje = b.encaje;
      upd.encaje_manual = true;
      upd.encaje_motivo = String(b.encaje_motivo ?? "Corregido a mano por el equipo.").slice(0, 600);
    }

    const { error } = await db().from("leads_foco").update(upd).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
