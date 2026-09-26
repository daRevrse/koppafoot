"use client";

import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useFormes } from "@/hooks/useFormes";
import { prevenirDuChangementDeCondition } from "@/lib/firestore";
import { cleFormeCompte, conditionEnVigueur, versFirestoreCondition } from "@/lib/etat-de-forme";
import CarteEtatDeForme from "./CarteEtatDeForme";
import type { ConditionSaisie } from "./EditeurCondition";

// ============================================
// La carte d'état de forme du joueur connecté, sur ses propres écrans : il y
// lit sa forme et y déclare sa condition.
//
// LE MANAGER EST PRÉVENU QUAND LE STATUT CHANGE, pas quand le mot change. Un
// joueur qui corrige une faute dans « entorse de la cheville » ne doit pas
// réveiller qui que ce soit ; un joueur qui passe de « apte » à « blessé »,
// si.
// ============================================

export default function MonEtatDeForme() {
  const { user, updateProfile } = useAuth();
  const { formes, charge } = useFormes(user ? [cleFormeCompte(user.uid)] : []);
  if (!user) return null;

  const enregistrer = async (c: ConditionSaisie) => {
    const avant = conditionEnVigueur(user.condition)?.statut ?? "apte";
    await updateProfile({ condition: versFirestoreCondition(c) });
    toast.success("Condition enregistrée");
    if (avant !== c.statut) void prevenirDuChangementDeCondition();
  };

  return (
    <CarteEtatDeForme
      forme={formes[cleFormeCompte(user.uid)] ?? null}
      formeChargee={charge}
      condition={user.condition}
      editable
      onEnregistrerCondition={enregistrer}
    />
  );
}
