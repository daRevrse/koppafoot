"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { estSansPub, jourDeLome, type FirestoreDroits } from "@/lib/offre";

// ============================================
// Ce compte voit-il les partenaires ?
//
// LA PROMESSE DE « MON OFFRE ». Le Pro, et l'option sans pub vendue à part,
// annoncent « Aucune publicité ». Les emplacements s'affichaient pourtant
// pour tout le monde : la promesse n'était tenue nulle part.
//
// PAR LE NAVIGATEUR, ET PAS PAR /api/partenaires. Cette route est publique et
// mise en cache par le CDN : la même réponse sert tous les visiteurs, elle ne
// peut donc pas dépendre du compte. Le titulaire lit ses propres droits
// (`droits/{uid}`, firestore.rules), une fois par session et par compte.
//
// `null` tant qu'on ne sait pas : l'emplacement attend plutôt que de montrer
// une marque une demi-seconde à quelqu'un qui a payé pour ne plus en voir.
// ============================================

const lectures = new Map<string, Promise<boolean>>();

function sansPubDe(uid: string): Promise<boolean> {
  let lecture = lectures.get(uid);
  if (!lecture) {
    lecture = getDoc(doc(db, "droits", uid))
      .then((s) => estSansPub(s.exists() ? (s.data() as FirestoreDroits) : null, jourDeLome()))
      // Droits illisibles : on montre, comme à un compte sans option.
      .catch(() => false);
    lectures.set(uid, lecture);
  }
  return lecture;
}

export function useSansPub(): boolean | null {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;
  const [lu, setLu] = useState<{ uid: string; sansPub: boolean } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    void sansPubDe(uid).then((sansPub) => { if (vivant) setLu({ uid, sansPub }); });
    return () => { vivant = false; };
  }, [uid]);

  if (loading) return null;
  if (!uid) return false;
  return lu?.uid === uid ? lu.sansPub : null;
}
