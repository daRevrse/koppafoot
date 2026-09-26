// ============================================
// La candidature « propriétaire de terrain », côté serveur.
//
// Relue au dépôt (POST) comme à la modification (PUT) : les deux chemins
// doivent borner les mêmes champs de la même façon, sinon une modification
// ferait passer ce que le dépôt refusait.
// ============================================

/** Ce qu'un candidat saisit, relu et borné : partagé avec la modification (PUT). */
export function champsCandidature(body: {
  venueName?: string; city?: string; address?: string;
  fieldSize?: string; fieldSurface?: string; phone?: string; motivation?: string;
}): { erreur: string } | { champs: Record<string, string | null> } {
  const venueName = body.venueName?.trim().slice(0, 120) ?? "";
  if (venueName.length < 2) return { erreur: "Indique le nom du terrain." };
  const city = body.city?.trim().slice(0, 80) ?? "";
  if (city.length < 2) return { erreur: "Indique la ville du terrain." };
  return {
    champs: {
      venue_name: venueName,
      city,
      address: body.address?.trim().slice(0, 160) || null,
      field_size: body.fieldSize || "11v11",
      field_surface: body.fieldSurface || "synthetic",
      motivation: body.motivation?.trim().slice(0, 1000) || null,
      phone: body.phone?.trim().slice(0, 30) || null,
    },
  };
}

