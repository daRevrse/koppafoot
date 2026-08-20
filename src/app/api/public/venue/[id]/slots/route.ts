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
    const snap = await adminDb
      .collection("bookings")
      .where("venue_id", "==", id)
      .where("status", "==", "confirmed")
      .get();

    const slots = snap.docs
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
