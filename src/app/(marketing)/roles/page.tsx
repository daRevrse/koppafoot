import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// ============================================
// Les rôles — la page qui explique ce qu'on peut devenir ici.
//
// Dans le groupe (marketing), donc avec la peau du site vitrine et sans le
// shell de l'app : quelqu'un qui arrive ici n'a pas de compte, et lui servir
// Direct / Mercato / Tribune serait du mobilier pour un produit qu'il n'a pas
// encore accepté d'utiliser.
//
// La route est /roles et non /evolution : ce dernier chemin est déjà celui du
// sélecteur de rôle, côté connecté. Deux groupes de routes ne peuvent pas
// servir la même URL, et c'est tant mieux — la vitrine et l'outil ne sont pas
// la même page.
//
// Règle d'honnêteté tenue ici : seuls Joueur et Manager ont aujourd'hui un
// parcours d'activation. Organisateur passe par une candidature. Arbitre et
// propriétaire de terrain existent dans les données sans onboarding — ils
// sont annoncés comme tels, pas comme des boutons qui n'existent pas.
// ============================================

export const metadata = {
  title: "Les rôles — KoppaFoot",
  description:
    "Joueur, manager, organisateur, arbitre, propriétaire de terrain : ce que chacun fait sur KoppaFoot.",
};

interface Role {
  name: string;
  line: string;
  body: string;
  /** L'affiche du role, tiree de la campagne visuelle du produit. */
  image: string;
  /** Ce qu'on peut faire tout de suite, ou l'état réel si rien encore. */
  cta: { label: string; href: string } | { pending: string };
}

const OPEN: Role[] = [
  {
    name: "Joueur",
    image: "/branding/role_joueur.png",
    line: "Tu joues, on tient le compte",
    body:
      "Ta fiche, tes équipes, tes convocations. Tes buts et tes cartons en compétition sont comptés à ta place, match après match — et le mercato te met en face des équipes qui recrutent près de chez toi.",
    cta: { label: "Devenir joueur", href: "/evolution" },
  },
  {
    name: "Manager",
    image: "/branding/role_manager.png",
    line: "Tu tiens l'effectif",
    body:
      "L'équipe, son effectif permanent, ses entraînements, son palmarès. Côté marché : une sélection de joueurs repérés, les candidatures reçues et les invitations envoyées, au même endroit.",
    cta: { label: "Devenir manager", href: "/evolution" },
  },
  {
    name: "Organisateur",
    image: "/branding/hero_stadium.png",
    line: "Tu montes la compétition",
    body:
      "Poules, calendrier, tableau final, inscriptions des équipes et console de score en direct. C'est le rôle le plus lourd du produit, et il passe par une candidature plutôt que par un bouton.",
    cta: { label: "Organiser ma compétition", href: "/organisateurs" },
  },
  {
    name: "Arbitre",
    image: "/branding/role_arbitre.png",
    line: "Tu tiens le sifflet",
    body:
      "Ta fiche d'arbitre avec ton niveau de licence, et ta place dans la recherche : les organisateurs qui cherchent quelqu'un pour siffler te trouvent. L'activation est libre — personne ne vérifie la licence aujourd'hui, elle sert à te présenter, pas à te valider.",
    cta: { label: "Devenir arbitre", href: "/evolution" },
  },
  {
    name: "Propriétaire de terrain",
    image: "/branding/role_proprietaire.png",
    line: "Tu as la pelouse",
    body:
      "Un terrain se référence sur la plateforme et se trouve dans la recherche. Tout ce qui touche à la réservation et au calendrier d'occupation n'existe pas encore.",
    cta: { label: "Référencer mon terrain", href: "/terrains/candidature" },
  },
];

function RoleCard({ role }: { role: Role }) {
  return (
    <article className="flex flex-col bg-white">
      {/* L'affiche d'abord : un role se reconnait a une silhouette sur un
          terrain avant de se lire. Ratio 4/3 fixe pour que les cartes d'une
          rangee s'alignent quelle que soit la longueur du texte. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <Image
          src={role.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-8 sm:p-10">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
        {role.line}
      </p>
      <h3 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
        {role.name}
      </h3>
      <p className="mt-5 flex-1 text-base leading-relaxed text-gray-600">{role.body}</p>

      <div className="mt-8">
        {"pending" in role.cta ? (
          <span className="inline-block border border-gray-200/70 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {role.cta.pending}
          </span>
        ) : (
          <Link
            href={role.cta.href}
            className="inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            {role.cta.label}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
      </div>
    </article>
  );
}

export default function RolesPage() {
  return (
    <>
      <section className="border-b border-gray-200/70 py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
            Koppafoot Evolution
          </p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
            Un compte, plusieurs façons d&apos;être là
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.02em] text-gray-900 sm:text-7xl lg:text-8xl">
            Ce que tu deviens ici
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-gray-600">
            Le football togolais ne se joue pas qu&apos;avec des joueurs. Il faut
            quelqu&apos;un pour tenir l&apos;effectif, quelqu&apos;un pour monter la
            compétition, quelqu&apos;un pour siffler, et un terrain pour tout ça.
            Chaque rôle ouvre un espace différent.
          </p>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
            Ouverts aujourd&apos;hui
          </h2>
          <div className="mt-8 grid gap-px bg-gray-200/70 lg:grid-cols-3">
            {OPEN.map((r) => <RoleCard key={r.name} role={r} />)}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200/70 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-6xl">
            Le rôle se choisit après, pas avant
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            On crée le compte d&apos;abord, on choisit ensuite — et on peut en
            activer un second sans en perdre un.
          </p>
          <Link
            href="/evolution"
            className="mt-10 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Choisir mon rôle
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
