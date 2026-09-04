"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, Mail, Loader2, X, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Etiquette } from "@/components/ui/socle";

// ============================================
// Joindre le responsable d'un terrain.
//
// LA CARTE « GÉRÉ PAR » A DISPARU D'ICI. Elle nommait le propriétaire et
// menait à sa fiche de PERSONNE — position, taille, pied fort, équipes —
// c'est-à-dire à tout sauf au terrain qu'on était en train de regarder. Qui
// il est n'intéresse pas celui qui cherche un créneau ; savoir comment le
// joindre, oui.
//
// LES COORDONNÉES NE DESCENDENT PAS AVEC LA PAGE. Elles sont demandées au
// clic (voir /api/venues/[id]/contact), donc elles ne sont jamais dans le
// HTML mis en cache que lisent les robots. Un compte est exigé : c'est déjà
// le prix d'une demande de créneau, et c'est ce qui empêche de moissonner
// les numéros de tous les propriétaires en parcourant l'annuaire.
// ============================================

interface Contact {
  nom: string;
  telephone: string | null;
  email: string | null;
}

export default function ContactResponsable({ venueId }: { venueId: string }) {
  const { firebaseUser } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const fermerRef = useRef<HTMLButtonElement>(null);
  const declencheur = useRef<Element | null>(null);

  const fermer = useCallback(() => {
    setOuvert(false);
    if (declencheur.current instanceof HTMLElement) declencheur.current.focus();
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    fermerRef.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouvert, fermer]);

  const ouvrir = async () => {
    declencheur.current = document.activeElement;
    setOuvert(true);
    if (contact || !firebaseUser) return;

    setCharge(true);
    setErreur(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/venues/${encodeURIComponent(venueId)}/contact`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? "Impossible de récupérer les coordonnées.");
        return;
      }
      setContact(data.contact);
    } catch {
      setErreur("Erreur réseau. Réessaie.");
    } finally {
      setCharge(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="mt-10 inline-flex items-center gap-2 border border-gray-200/70 bg-white px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
      >
        <UserRound size={15} />
        Contacter le responsable
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-titre"
            className="relative w-full max-w-md border border-gray-200/70 bg-white p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Etiquette>Responsable du terrain</Etiquette>
                <h2
                  id="contact-titre"
                  className="mt-1.5 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900"
                >
                  {contact?.nom ?? "Coordonnées"}
                </h2>
              </div>
              <button
                ref={fermerRef}
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="-mr-1 -mt-1 shrink-0 border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-6">
              {!firebaseUser ? (
                <>
                  <p className="text-sm leading-relaxed text-gray-500">
                    Les coordonnées sont réservées aux comptes KoppaFoot. C&apos;est
                    ce qui évite que les numéros des propriétaires soient
                    ramassés par n&apos;importe quel robot.
                  </p>
                  <Link
                    href={`/login?for=creneau&next=/terrains/${venueId}`}
                    className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
                  >
                    Créer mon compte
                  </Link>
                </>
              ) : charge ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" aria-label="Chargement" />
                </div>
              ) : erreur ? (
                <p role="alert" className="text-sm font-semibold leading-relaxed text-red-600">
                  {erreur}
                </p>
              ) : contact && (contact.telephone || contact.email) ? (
                <>
                  <ul className="divide-y divide-gray-200/70 border border-gray-200/70">
                    {contact.telephone && (
                      <li>
                        <a
                          href={`tel:${contact.telephone.replace(/\s/g, "")}`}
                          className="group flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                        >
                          <Phone size={17} className="shrink-0 text-emerald-600" />
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                              Téléphone
                            </span>
                            <span className="block truncate text-sm font-bold text-gray-900">
                              {contact.telephone}
                            </span>
                          </span>
                        </a>
                      </li>
                    )}
                    {contact.email && (
                      <li>
                        <a
                          href={`mailto:${contact.email}`}
                          className="group flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
                        >
                          <Mail size={17} className="shrink-0 text-emerald-600" />
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                              Email
                            </span>
                            <span className="block truncate text-sm font-bold text-gray-900">
                              {contact.email}
                            </span>
                          </span>
                        </a>
                      </li>
                    )}
                  </ul>

                  <p className="mt-5 text-[11px] leading-relaxed text-gray-400">
                    Pour bloquer une date, la demande de créneau reste le chemin
                    le plus sûr : elle laisse une trace que vous suivez tous les deux.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-gray-500">
                  Ce responsable n&apos;a renseigné aucune coordonnée. Passez par
                  la demande de créneau : il en est prévenu par notification et
                  par email.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
