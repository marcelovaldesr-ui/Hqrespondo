export interface PlaceResult {
  place_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  web: string | null;
  rating: number | null;
  reviews: number | null;
}

/**
 * Busca negocios por rubro + comuna usando Places API (New) Text Search.
 * Pagina con nextPageToken hasta 60 resultados (3 páginas de 20): el triple
 * de base por búsqueda.
 */
export async function searchPlaces(
  rubro: string,
  comuna: string,
): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Falta GOOGLE_PLACES_API_KEY");

  const acumulado: any[] = [];
  let pageToken: string | undefined;

  for (let pagina = 0; pagina < 3; pagina++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: `${rubro} en ${comuna}, Chile`,
        languageCode: "es",
        maxResultCount: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });

    if (!res.ok) {
      // si falla una página siguiente, nos quedamos con lo acumulado
      if (acumulado.length > 0) break;
      throw new Error(`Places API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    acumulado.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return (acumulado as any[]).map((p) => ({
    place_id: p.id,
    nombre: p.displayName?.text ?? "Sin nombre",
    direccion: p.formattedAddress ?? null,
    telefono: p.nationalPhoneNumber
      ? String(p.nationalPhoneNumber).replace(/\s/g, "")
      : null,
    web: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
  }));
}
