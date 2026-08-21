// ============================================
// Le terrain, dessiné, en attendant les compositions.
//
// Un onglet « Composition » vide dirait « rien à afficher » et n'apprendrait
// rien. Le terrain, lui, dit CE QUI VIENDRA : onze positions, deux camps, et
// la promesse qu'on les remplira. C'est une page blanche qui montre son
// gabarit plutôt qu'un message d'absence.
//
// Dessiné en SVG plutôt qu'en image : il se met à l'échelle sans flou, ne
// coûte aucune requête, et suivra les couleurs du thème le jour où on y
// placera de vrais joueurs.
//
// Les onze pastilles sont un 4-3-3, le dispositif le plus lisible d'un coup
// d'œil. Elles ne portent pas de nom : ce sont des emplacements, pas des
// joueurs, et leur donner un numéro laisserait croire à une composition
// réelle.
// ============================================

/** Un 4-3-3, en coordonnées relatives : x de 0 (gauche) à 100, y de 0 à 100. */
const FORMATION = [
  { x: 50, y: 92 },                                          // gardien
  { x: 18, y: 74 }, { x: 39, y: 78 }, { x: 61, y: 78 }, { x: 82, y: 74 },  // défense
  { x: 28, y: 56 }, { x: 50, y: 60 }, { x: 72, y: 56 },      // milieu
  { x: 24, y: 36 }, { x: 50, y: 30 }, { x: 76, y: 36 },      // attaque
];

export default function PitchPlaceholder({ note }: { note?: string }) {
  return (
    <div className="border border-gray-200/70 bg-white p-5">
      <div className="relative mx-auto w-full max-w-md">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Terrain de football, compositions non disponibles"
          className="w-full"
        >
          {/* La pelouse et ses lignes. Un vert très pâle : le terrain est un
              décor, pas le sujet, et les joueurs devront s'en détacher. */}
          <rect x="0" y="0" width="100" height="100" fill="#f0fdf4" />
          <g stroke="#bbf7d0" strokeWidth="0.6" fill="none">
            <rect x="3" y="3" width="94" height="94" />
            <line x1="3" y1="50" x2="97" y2="50" />
            <circle cx="50" cy="50" r="11" />
            {/* Surfaces de réparation */}
            <rect x="26" y="3" width="48" height="16" />
            <rect x="26" y="81" width="48" height="16" />
            {/* Surfaces de but */}
            <rect x="38" y="3" width="24" height="6" />
            <rect x="38" y="91" width="24" height="6" />
          </g>
          <circle cx="50" cy="50" r="1.2" fill="#bbf7d0" />

          {/* Les emplacements, vides. */}
          {FORMATION.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.6"
              fill="#ffffff"
              stroke="#d1d5db"
              strokeWidth="0.7"
              strokeDasharray="1.6 1.2"
            />
          ))}
        </svg>
      </div>

      <p className="mt-5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        Pas encore disponible
      </p>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-gray-500">
        {note ?? "Les compositions apparaîtront ici dès que les équipes auront annoncé leur onze de départ."}
      </p>
    </div>
  );
}
