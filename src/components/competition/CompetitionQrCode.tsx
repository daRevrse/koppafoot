"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download, QrCode, X } from "lucide-react";
import { lienAbsolu } from "@/lib/partage";
import type { Competition } from "@/types";
import { avecVia } from "@/lib/audience";

// ============================================
// Le QR code d'une compétition, pour ce qui s'imprime.
//
// Le lien se partage sur WhatsApp ; une affiche, une banderole ou l'écran du
// stade ne se cliquent pas. Le QR code est ce lien-là, pour le papier.
//
// IL MÈNE TOUJOURS À LA PAGE DE LA COMPÉTITION, jamais à celle d'inscription
// que la carte de partage sert pendant les inscriptions : une affiche survit à
// la phase qui l'a vue naître, et la page de la compétition reste la bonne à
// chaque étape (elle propose l'inscription tant qu'elle est ouverte).
//
// L'adresse est celle de production (lib/partage) : un QR code imprimé doit
// s'ouvrir chez n'importe qui.
// ============================================

/** Côté de l'image téléchargée, en pixels CSS (multiplié par la densité de l'écran). */
const COTE_IMAGE = 1024;

export default function CompetitionQrCode({ competition }: { competition: Competition }) {
  const [ouvert, setOuvert] = useState(false);
  const toile = useRef<HTMLCanvasElement>(null);
  const url = lienAbsolu(`/c/${competition.slug}`);
  const brouillon = competition.status === "draft";

  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouvert]);

  const telecharger = () => {
    const c = toile.current;
    if (!c) return;
    const lien = document.createElement("a");
    lien.href = c.toDataURL("image/png");
    lien.download = `qr-code-${competition.slug}.png`;
    lien.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 border-2 border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:border-emerald-300"
      >
        <QrCode size={15} />
        QR code
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOuvert(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-code-titre"
            className="w-full max-w-sm modal-sheet rounded-t-3xl bg-white p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="qr-code-titre" className="font-display text-lg font-bold text-gray-900">
                  Le QR code de ta compétition
                </h2>
                <p className="truncate text-xs font-semibold text-gray-400">{competition.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
                className="p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center border border-gray-200/70 bg-white p-4">
              <QRCodeSVG value={avecVia(url, "qr")} size={224} level="M" marginSize={2} title={`QR code de ${competition.name}`} />
            </div>
            <p className="mt-2 truncate text-center font-mono text-xs font-bold text-gray-500">
              {url.replace(/^https?:\/\//, "")}
            </p>

            {brouillon && (
              <p className="mt-3 border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-900">
                Ta compétition est en brouillon : le QR code ouvrira une page fermée tant que tu ne l&apos;as pas publiée.
              </p>
            )}

            <p className="mt-3 text-sm text-gray-600">
              Pour tes affiches, tes banderoles ou l&apos;écran du stade : il ouvre la page de la
              compétition, avec le calendrier et les scores en direct.
            </p>

            <button
              type="button"
              onClick={telecharger}
              className="mt-4 flex w-full items-center justify-center gap-2 bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
            >
              <Download size={16} />
              Télécharger l&apos;image (PNG)
            </button>

            {/* L'image à télécharger : grande, avec sa marge blanche réglementaire,
                pour rester lisible imprimée en grand. Jamais affichée. */}
            <QRCodeCanvas
              ref={toile}
              value={avecVia(url, "qr")}
              size={COTE_IMAGE}
              level="M"
              marginSize={4}
              style={{ display: "none" }}
              aria-hidden
            />
          </div>
        </div>
      )}
    </>
  );
}
