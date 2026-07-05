export interface PlaceResult {
  place_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  web: string | null;
  rating: number | null;
  reviews: number | null;
}

/** Busca negocios por rubro + comuna usando Places API (New) Text Search. */
export async function searchPlaces(
  rubro: string,
  comuna: string,
): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Falta GOOGLE_PLACES_API_KEY");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: `${rubro} en ${comuna}, Chile`,
      languageCode: "es",
      maxResultCount: 20,
    }),
  });

  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return ((data.places ?? []) as any[]).map((p) => ({
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
