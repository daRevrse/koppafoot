// MAQUETTE JETABLE — l'affiche « Journée X » / « Matchs du jour », validée le 2026-10-22. Équipes fictives.
// Usage : npx tsx --tsconfig tsconfig.json scripts/maquettes-journee.tsx <dossier>
// Référence visuelle seulement (docs/superpowers/specs/2026-10-22-journees-et-affiche-du-jour-design.md).
import React from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { chargerRessources, Ecusson, EMERAUDE, GRIS } from "@/lib/og-da";
import { Cadre, Surtitre, Titre, TAILLE_FLYER, LARGEUR_UTILE } from "@/lib/og-flyer";

const DIR = process.argv[2];

interface Ligne {
  dom: string; ext: string; logoDom: string | null; logoExt: string | null;
  heure: string; score?: [number, number]; detail: string; tab?: string;
}
interface Jour { titre: string; lignes: Ligne[] }

const ecusson = async (lettre: string, couleur: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <path d="M100 8 L184 40 L172 140 L100 192 L28 140 L16 40 Z" fill="${couleur}" stroke="#fff" stroke-width="6"/>
    <text x="100" y="128" font-size="80" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${lettre}</text>
  </svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
};

function LigneMatch({ l, h }: { l: Ligne; h: number }) {
  const ec = Math.min(120, Math.round(h * 0.62));
  const nom = Math.max(18, Math.min(36, Math.round(h * 0.28)));
  const joue = Boolean(l.score);
  return (
    <div style={{ display: "flex", alignItems: "center", height: h, borderTop: "2px solid #1c2622", width: LARGEUR_UTILE }}>
      <div style={{ display: "flex", flexDirection: "column", width: 112 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: nom, color: joue ? GRIS : EMERAUDE }}>
          {joue ? "FINAL" : l.heure}
        </div>
        {h >= 70 && (
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 15, letterSpacing: 2, color: GRIS }}>
            {l.detail}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 14 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: nom, color: "#fff", textTransform: "uppercase" }}>{l.dom}</div>
        <Ecusson nom={l.dom} logo={l.logoDom} taille={ec} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 150 }}>
        {joue ? (
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: Math.round(h * 0.55), color: "#fff", lineHeight: 1 }}>
            {`${l.score![0]} – ${l.score![1]}`}
          </div>
        ) : (
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: Math.round(h * 0.45), color: EMERAUDE, lineHeight: 1 }}>VS</div>
        )}
        {l.tab && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 14, color: GRIS }}>{l.tab}</div>}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 14 }}>
        <Ecusson nom={l.ext} logo={l.logoExt} taille={ec} />
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: nom, color: "#fff", textTransform: "uppercase" }}>{l.ext}</div>
      </div>
    </div>
  );
}

/** Trois matchs au plus : chacun en duel, comme le flyer MATCHDAY, plutôt qu'une ligne perdue dans le vide. */
function Duel({ l }: { l: Ligne }) {
  const joue = Boolean(l.score);
  const camp = (nom: string, logo: string | null) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
      <Ecusson nom={nom} logo={logo} taille={130} />
      <div style={{ display: "flex", marginTop: 14, fontFamily: "Outfit", fontWeight: 900, fontSize: 30, color: "#fff", textTransform: "uppercase", textAlign: "center" }}>{nom}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: LARGEUR_UTILE, padding: "26px 0", borderTop: "2px solid #1c2622" }}>
      {camp(l.dom, l.logoDom)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 236 }}>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 700, fontSize: 18, letterSpacing: 4, color: GRIS }}>{l.detail}</div>
        <div style={{ display: "flex", height: 100, alignItems: "center", fontFamily: "Anton", fontSize: joue ? 92 : 80, color: joue ? "#fff" : EMERAUDE, whiteSpace: "nowrap" }}>
          {joue ? `${l.score![0]} – ${l.score![1]}` : "VS"}
        </div>
        <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 900, fontSize: 30, color: joue ? GRIS : EMERAUDE }}>{joue ? "FINAL" : l.heure}</div>
      </div>
      {camp(l.ext, l.logoExt)}
    </div>
  );
}

function Affiche({ logo, surtitre, titre, jours, place }: { logo: string; surtitre: string; titre: string; jours: Jour[]; place: number }) {
  const n = jours.reduce((s, j) => s + j.lignes.length, 0);
  const entetes = jours.length > 1 ? jours.length * 46 : 0;
  const h = Math.min(104, Math.floor((place - entetes) / n));
  return (
    <Cadre logo={logo} logoCompetition={null}>
      <Surtitre texte={surtitre} />
      <Titre texte={titre} max={150} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: 44 }}>
        {jours.map((j, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            {jours.length > 1 && (
              <div style={{ display: "flex", height: 46, alignItems: "flex-end", paddingBottom: 8, fontFamily: "Outfit", fontWeight: 700, fontSize: 20, letterSpacing: 6, color: EMERAUDE }}>
                {j.titre}
              </div>
            )}
            {j.lignes.map((l, k) => (n <= 3 ? <Duel key={k} l={l} /> : <LigneMatch key={k} l={l} h={h} />))}
          </div>
        ))}
      </div>
    </Cadre>
  );
}

async function rendre(nom: string, props: Omit<Parameters<typeof Affiche>[0], "logo">) {
  const { fonts, logo } = await chargerRessources();
  const r = new ImageResponse(<Affiche logo={logo} {...props} />, { ...TAILLE_FLYER, fonts });
  await writeFile(`${DIR}/${nom}.png`, Buffer.from(await r.arrayBuffer()));
  console.log("écrit", nom);
}

async function main() {
  const E = {
    lions: await ecusson("L", "#d4a017"), be: await ecusson("B", "#1d6fb8"), agoe: await ecusson("A", "#b91c1c"),
    etoile: await ecusson("E", "#7c3aed"), tok: await ecusson("T", "#0f766e"), adi: await ecusson("J", "#c2410c"),
  };
  // A. Journée 2 d'une compétition à trois poules, sur trois dimanches.
  await rendre("A-journee", {
    surtitre: "TOURNOI DES QUARTIERS · PHASE DE POULES", titre: "JOURNÉE 2", place: 760,
    jours: [
      { titre: "DIMANCHE 18 OCTOBRE", lignes: [
        { dom: "Lions FC", ext: "AS Bè", logoDom: E.lions, logoExt: E.be, heure: "15H00", score: [2, 1], detail: "POULE A" },
        { dom: "FC Agoè", ext: "Étoile FC", logoDom: E.agoe, logoExt: E.etoile, heure: "17H00", score: [0, 0], detail: "POULE A" },
      ] },
      { titre: "DIMANCHE 25 OCTOBRE", lignes: [
        { dom: "US Tokoin", ext: "JS Adidogomé", logoDom: E.tok, logoExt: E.adi, heure: "15H00", detail: "POULE B" },
        { dom: "Union Bè", ext: "Racing Hédzranawoé", logoDom: null, logoExt: null, heure: "17H00", detail: "POULE B" },
      ] },
      { titre: "DIMANCHE 1ER NOVEMBRE", lignes: [
        { dom: "Dynamo Kégué", ext: "AC Nyékonakpoè", logoDom: null, logoExt: null, heure: "15H00", detail: "POULE C" },
        { dom: "Olympic Baguida", ext: "FC Avédji", logoDom: null, logoExt: null, heure: "17H00", detail: "POULE C" },
      ] },
    ],
  });
  // B. Matchs du jour : deux matchs, l'un joué, l'autre à venir.
  await rendre("B-jour", {
    surtitre: "SAMEDI 8 AOÛT · STADE DE BÈ", titre: "MATCHS DU JOUR", place: 760,
    jours: [{ titre: "", lignes: [
      { dom: "Lions FC", ext: "AS Bè", logoDom: E.lions, logoExt: E.be, heure: "16H00", score: [3, 2], detail: "POULE D" },
      { dom: "FC Agoè", ext: "Étoile FC", logoDom: E.agoe, logoExt: E.etoile, heure: "18H30", detail: "POULE D" },
    ] }],
  });
  // C. Une journée chargée : douze matchs le même jour.
  const equipes = ["Lions FC", "AS Bè", "FC Agoè", "Étoile FC", "US Tokoin", "JS Adidogomé", "Union Bè", "Racing Hédzranawoé", "Dynamo Kégué", "AC Nyékonakpoè", "Olympic Baguida", "FC Avédji"];
  const logos = [E.lions, E.be, E.agoe, E.etoile, E.tok, E.adi, null, null, null, null, null, null];
  const lignes: Ligne[] = Array.from({ length: 12 }, (_, i) => {
    const a = i % 12, b = (i * 5 + 3) % 12 === a ? (a + 1) % 12 : (i * 5 + 3) % 12;
    return {
      dom: equipes[a], ext: equipes[b], logoDom: logos[a], logoExt: logos[b],
      heure: `${String(8 + i).padStart(2, "0")}H00`, score: i < 7 ? [i % 3, (i + 1) % 2] as [number, number] : undefined,
      detail: i % 2 ? "POULE B" : "POULE A",
    };
  });
  await rendre("C-charge", { surtitre: "SPORTFEST · SAMEDI 17 OCTOBRE", titre: "MATCHS DU JOUR", place: 760, jours: [{ titre: "", lignes }] });
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
