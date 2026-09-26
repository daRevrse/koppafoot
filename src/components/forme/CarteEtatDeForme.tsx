"use client";

import { useState } from "react";
import { Activity, Edit3, Loader2 } from "lucide-react";
import { Bouton, Etiquette } from "@/components/ui/socle";
import {
  JOURS_SANS_MATCH, LIBELLE_CONDITION, LIBELLE_FORME, MATCHS_NOTES_MINIMUM,
  conditionEnVigueur, joursDepuis,
  type ConditionJoueur, type FormeJoueur,
} from "@/lib/etat-de-forme";
import { formaterNote } from "@/lib/notes";
import { BadgeCondition, BadgeForme, FriseDesNotes, ICONE_TENDANCE, MOT_TENDANCE, jourCourt } from "./badges";
import EditeurCondition, { type ConditionSaisie } from "./EditeurCondition";

// ============================================
// L'état de forme d'un joueur, en entier : ce qu'il déclare à gauche, ce que
// ses matchs disent à droite. Voir lib/etat-de-forme pour pourquoi les deux
// ne se confondent pas.
//
// Sur sa propre fiche, le joueur y déclare sa condition. Ailleurs, la carte
// se lit seulement.
// ============================================

export default function CarteEtatDeForme({
  forme,
  formeChargee,
  condition,
  conditionConnue = true,
  editable = false,
  onEnregistrerCondition,
}: {
  forme: FormeJoueur | null | undefined;
  formeChargee: boolean;
  condition: ConditionJoueur | null | undefined;
  /**
   * Faux pour un visiteur sans compte : la condition vit sur `users`, qui lui
   * est fermé. On ne lui dit donc pas « rien de déclaré » — on n'en sait rien.
   */
  conditionConnue?: boolean;
  editable?: boolean;
  onEnregistrerCondition?: (c: ConditionSaisie) => Promise<void>;
}) {
  const [edition, setEdition] = useState(false);
  const enVigueur = conditionEnVigueur(condition);
  const jours = joursDepuis(forme?.dernierMatch ?? null);
  const Pente = forme?.tendance ? ICONE_TENDANCE[forme.tendance] : null;

  return (
    <section className="border border-gray-200/70 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200/70 px-4 py-3">
        <Activity size={16} className="text-emerald-600" />
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-gray-900">État de forme</h2>
      </div>

      <div className="grid gap-px bg-gray-200/70 md:grid-cols-2">
        {/* ─── La condition, déclarée ─── */}
        <div className="bg-white p-4">
          <Etiquette className="mb-3">Condition</Etiquette>
          {edition && editable && onEnregistrerCondition ? (
            <EditeurCondition
              initiale={enVigueur}
              onAnnuler={() => setEdition(false)}
              onEnregistrer={async (c) => {
                await onEnregistrerCondition(c);
                setEdition(false);
              }}
              aide="Visible par ton manager et par les membres connectés de KoppaFoot. Ton manager est prévenu quand tu changes de statut."
            />
          ) : (
            <div className="space-y-2">
              {!conditionConnue ? (
                <p className="text-sm font-semibold text-gray-400">
                  Connecte-toi pour voir la condition déclarée par le joueur.
                </p>
              ) : enVigueur ? (
                <>
                  <BadgeCondition condition={enVigueur} apte date={false} className="text-[11px]!" />
                  <dl className="space-y-1 text-xs font-semibold text-gray-600">
                    {enVigueur.retourPrevu && (
                      <div className="flex gap-1">
                        <dt className="text-gray-400">Retour prévu :</dt>
                        <dd>{jourCourt(enVigueur.retourPrevu)}</dd>
                      </div>
                    )}
                    {enVigueur.note && (
                      <p className="border-l-2 border-gray-200/70 pl-2 italic text-gray-500">{enVigueur.note}</p>
                    )}
                    {enVigueur.declareeLe && (
                      <p className="text-[11px] text-gray-400">
                        {LIBELLE_CONDITION[enVigueur.statut]} depuis le {jourCourt(enVigueur.declareeLe.slice(0, 10))}
                      </p>
                    )}
                  </dl>
                </>
              ) : (
                <p className="text-sm font-semibold text-gray-500">
                  {editable
                    ? "Rien de déclaré : tu es considéré comme apte."
                    : "Rien de déclaré : considéré comme apte."}
                </p>
              )}
              {editable && onEnregistrerCondition && (
                <Bouton petit variante="contour" Icon={Edit3} onClick={() => setEdition(true)} className="mt-2">
                  {enVigueur ? "Mettre à jour" : "Déclarer ma condition"}
                </Bouton>
              )}
            </div>
          )}
        </div>

        {/* ─── La forme, calculée ─── */}
        <div className="bg-white p-4">
          <Etiquette className="mb-3">Forme sur les derniers matchs</Etiquette>
          {!formeChargee ? (
            <Loader2 size={18} className="animate-spin text-gray-300" />
          ) : !forme || forme.matchs.length === 0 ? (
            <p className="text-sm font-semibold text-gray-500">
              Pas de match récent. La forme se calcule sur les notes du direct,
              dès que le joueur figure sur une feuille de match terminée.
            </p>
          ) : (
            <div className="space-y-3">
              {forme.niveau && forme.indice !== null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeForme forme={forme} pente={false} className="text-[11px]!" />
                  {Pente && forme.tendance && (
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                      <Pente size={13} /> {MOT_TENDANCE[forme.tendance]}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-500">
                  Pas encore assez de matchs notés : il en faut {MATCHS_NOTES_MINIMUM} sur
                  les cinq derniers. Une entrée en jeu trop courte n&apos;est pas notée.
                </p>
              )}
              <FriseDesNotes matchs={forme.matchs} />
              <p className="text-[11px] leading-relaxed text-gray-400">
                {forme.niveau && forme.indice !== null && (
                  <>
                    {LIBELLE_FORME[forme.niveau]} : {formaterNote(forme.indice)} de moyenne
                    sur les notes du direct, les matchs récents comptant davantage.{" "}
                  </>
                )}
                {jours !== null && jours > JOURS_SANS_MATCH && (
                  <span className="font-bold text-amber-700">
                    Dernier match il y a {jours} jours : cette forme date un peu.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
