import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOutboundStore } from "../../lib/outbound/store";
import { importarCSV } from "../../lib/outbound/ingestion";
import { MockEmailVerifier } from "../../lib/outbound/verification";
import {
  normalizarDominio,
  normalizarEmail,
  generarMatchingKey,
  normalizarNombrePersona,
  normalizarTelefono,
} from "../../lib/outbound/normalization";

test("Normalización de email y dominios básica y estricta", () => {
  assert.equal(normalizarEmail("  Juan.Perez@Empresa.CL  "), "juan.perez@empresa.cl");
  assert.equal(normalizarEmail("invalido@@algo..com"), null);
  assert.equal(normalizarDominio("https://www.Empresa.CL/contacto?ref=1"), "empresa.cl");
  assert.equal(normalizarDominio("contacto@clinica.cl"), "clinica.cl");
});

test("Normalización de nombres y teléfonos chilenos", () => {
  const p1 = normalizarNombrePersona("GUEVARA, ELVIA");
  assert.equal(p1.nombre, "Elvia");
  assert.equal(p1.apellido, "Guevara");

  const p2 = normalizarNombrePersona("Daniel Pardo");
  assert.equal(p2.nombre, "Daniel");
  assert.equal(p2.apellido, "Pardo");

  assert.equal(normalizarTelefono("+56 9 6166 0295"), "56961660295");
  assert.equal(normalizarTelefono("961660295"), "56961660295");
});

test("Matching key para empresas genera clave de búsqueda sin hacer merge destructivo", () => {
  const k1 = generarMatchingKey("Centro de Tratamiento del Dolor SpA");
  const k2 = generarMatchingKey("Centro de Tratamiento del Dolor S.P.A.");
  const k3 = generarMatchingKey("Centro de Tratamiento del Dolor Limitada");

  assert.equal(k1, "centro_de_tratamiento_del_dolor");
  assert.equal(k2, "centro_de_tratamiento_del_dolor");
  assert.equal(k3, "centro_de_tratamiento_del_dolor");
});

test("REGLA 1: Mismo dominio permite múltiples contactos legítimos (NO deduplica por dominio)", async () => {
  const store = new MemoryOutboundStore();
  const mockVerifier = new MockEmailVerifier();

  const csv = `empresa,contacto,cargo,email,web
Acme Chile,Juan Perez,Gerente General,juan@acme.cl,https://acme.cl
Acme Chile,Maria Lopez,Directora Comercial,maria@acme.cl,https://acme.cl
Acme Chile,Soporte Ventas,Recepción,ventas@acme.cl,https://acme.cl`;

  const res = await importarCSV(
    csv,
    {
      tipo_origen: "csv",
      nombre_fuente: "Test Multi-Contacto",
      verifier: mockVerifier,
    },
    store,
  );

  assert.equal(res.total_filas, 3);
  assert.equal(res.insertados, 3, "Los 3 contactos deben insertarse aunque compartan dominio");

  const contactos = await store.listContacts();
  assert.equal(contactos.length, 3);
  assert.equal(contactos.filter((c) => c.email_normalizado.endsWith("@acme.cl")).length, 3);

  // Ver que todos se asociaron a la MISMA empresa
  const empresas = await store.listCompanies();
  assert.equal(empresas.length, 1, "Debe existir exactamente una sola empresa 'Acme Chile'");
  assert.equal(contactos[0].company_id, empresas[0].id);
  assert.equal(contactos[1].company_id, empresas[0].id);
  assert.equal(contactos[2].company_id, empresas[0].id);
});

test("REGLA 2: Email exacto normalizado es deduplicado estrictamente", async () => {
  const store = new MemoryOutboundStore();
  const mockVerifier = new MockEmailVerifier();

  const csv = `empresa,contacto,cargo,email,web
Clinica Los Andes,Pedro Soto,Director,pedro@losandes.cl,https://losandes.cl
Clinica Los Andes,Pedro Soto Reingreso,Director,PEDRO@losandes.cl,https://losandes.cl`;

  const res = await importarCSV(
    csv,
    {
      tipo_origen: "csv",
      nombre_fuente: "Test Dedupe Email",
      verifier: mockVerifier,
    },
    store,
  );

  assert.equal(res.insertados, 1);
  assert.equal(res.duplicados_ignorados, 1, "El segundo contacto con el mismo email debe ser ignorado");
});

test("REGLA 3: Supresión permanente bloquea reimportación y se preserva", async () => {
  const store = new MemoryOutboundStore();
  const mockVerifier = new MockEmailVerifier();

  // Registrar supresión previa
  await store.addSuppression({
    tipo: "email",
    valor: "bloqueado@empresa.cl",
    motivo: "opt_out",
    origen: "test_previo",
    notas: "Pidió baja anteriormente",
  });

  const csv = `empresa,contacto,cargo,email,web
Empresa Test,Carlos Bajas,Gerente,bloqueado@empresa.cl,https://empresa.cl
Empresa Test,Ana Libre,Operaciones,ana@empresa.cl,https://empresa.cl`;

  const res = await importarCSV(
    csv,
    {
      tipo_origen: "csv",
      nombre_fuente: "Test Supresión",
      verifier: mockVerifier,
    },
    store,
  );

  assert.equal(res.suprimidos, 1, "bloqueado@empresa.cl debe ser detectado como suprimido");
  assert.equal(res.insertados, 1, "ana@empresa.cl debe insertarse normalmente");

  const contactoBloqueado = await store.findContactByEmail("bloqueado@empresa.cl");
  assert.equal(contactoBloqueado, null, "El contacto suprimido nunca debe entrar a la base");
});

test("REGLA 4: Trazabilidad del origen y Ley 21.719 registrada en LeadSource", async () => {
  const store = new MemoryOutboundStore();
  const mockVerifier = new MockEmailVerifier();

  const csv = `empresa,contacto,cargo,email,web
Centro Medico,Doctor Morales,Director Medico,morales@centromedico.cl,https://centromedico.cl`;

  await importarCSV(
    csv,
    {
      tipo_origen: "cliente_partner",
      nombre_fuente: "Impresora Color Base 2026",
      referencia_fuente: "Cliente de talonarios e impresos",
      tipo_relacion_default: "warm",
      relationship_approved_for_copy: false,
      verifier: mockVerifier,
    },
    store,
  );

  const sources = await store.getLeadSources();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].tipo_origen, "cliente_partner");
  assert.equal(sources[0].nombre, "Impresora Color Base 2026");

  const contact = await store.findContactByEmail("morales@centromedico.cl");
  assert.ok(contact);
  assert.equal(contact.tipo_relacion, "warm");
  assert.equal(contact.relationship_approved_for_copy, false, "Debe ser false por defecto");
});
