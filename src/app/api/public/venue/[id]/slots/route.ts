import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/venue/[id]/slots, les créneaux déjà pris.
 *
 * Pourquoi passer par le serveur : les règles réservent la lecture d'une
 * demande à ses deux parties, et c'est juste, une demande dit qui joue où
 * et quand. Mais quelqu'un qui veut réserver a besoin de savoir ce qui est
 * libre, sans quoi il demande un créneau déjà pris et découvre le refus deux
 * jours plus tard.
 *
 * On publie donc l'OCCUPATION, jamais l'occupant : date, heure, durée. Ni
 * nom, ni identifiant du demandeur ne sortent d'ici.
 *
 * Seules les demandes confirmées comptent. Une demande en attente ne bloque
 * rien : le propriétaire arbitre, et deux personnes peuvent parfaitement
 * demander le même samedi soir.
 *
 * Une réservation confirmée dont les frais de réservation ne sont pas venus à
 * temps ne compte plus : son créneau est libre.
 */

export const revalidate = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ slots: [] });

  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  try {
    const [snap, ouverts] = await Promise.all([
      adminDb.collection("bookings").where("venue_id", "==", id).where("status", "==", "confirmed").get(),
      adminDb.collection("reglements").where("venue_id", "==", id).where("cloture", "==", null).get(),
    ]);

    // Un créneau confirmé dont les frais n'ont pas été payés à temps est déjà
    // libre, même si personne ne l'a encore libéré (lib/reglement-serveur).
    // L'échéance se lit dans le règlement, jamais sur la réservation.
    const maintenant = Date.now();
    const echus = new Set(ouverts.docs
      .filter((d) => !d.get("paye_le") && typeof d.get("echeance") === "number" && d.get("echeance") < maintenant)
      .map((d) => d.id));

    const slots = snap.docs
      .filter((d) => !echus.has(d.id))
      .flatMap((d) => {
        const b = d.data();
        const date = typeof b.date === "string" ? b.date : null;
        // Le passé n'intéresse personne qui cherche un créneau.
        if (!date || date < today) return [];
        return [{
          date,
          time: typeof b.time === "string" ? b.time : "",
          duration: typeof b.duration === "number" ? b.duration : 1,
        }];
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    return NextResponse.json({ slots });
  } catch (err) {
    console.error("GET venue slots failed:", err);
    return NextResponse.json({ slots: [] });
  }
}
