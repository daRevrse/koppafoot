import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// ============================================
// Les rôles, la page qui explique ce qu'on peut devenir ici.
//
// Dans le groupe (marketing), donc avec la peau du site vitrine et sans le
// shell de l'app : quelqu'un qui arrive ici n'a pas de compte, et lui servir
// Direct / Mercato / Tribune serait du mobilier pour un produit qu'il n'a pas
// encore accepté d'utiliser.
//
// La route est /roles et non /evolution : ce dernier chemin est déjà celui du
// sélecteur de rôle, côté connecté. Deux groupes de routes ne peuvent pas
// servir la même URL, et c'est tant mieux, la vitrine et l'outil ne sont pas
// la même page.
//
// Cette page ne parle que des ROLES : ce qu'on est sur le terrain, un seul a
// la fois. Joueur, manager, arbitre.
//
// Les casquettes, organiser une competition et gerer un terrain, n'y figurent
// pas et c'est deliberе : ce sont des fonctions qui s'ajoutent a un role sans
// le remplacer, elles ont leurs propres vitrines (Koppafoot Organize et
// MyFields) et leurs propres candidatures. Les melanger ici reintroduirait la
// confusion que le modele vient justement de defaire.
// ============================================

export const metadata = {
  title: "Les rôles, KoppaFoot",
  description:
    "Joueur, manager, arbitre : ce que chacun fait sur KoppaFoot, et comment choisir son rôle.",
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
      "Ta fiche, tes équipes, tes convocations. Tes buts et tes cartons en compétition sont comptés à ta place, match après match, et le mercato te met en face des équipes qui recrutent près de chez toi.",
    cta: { label: "Devenir joueur", href: "/signup?role=player" },
  },
  {
    name: "Manager",
    image: "/branding/role_manager.png",
    line: "Tu tiens l'effectif",
    body:
      "L'équipe, son effectif permanent, ses entraînements, son palmarès. Côté marché : une sélection de joueurs repérés, les candidatures reçues et les invitations envoyées, au même endroit.",
    cta: { label: "Devenir manager", href: "/signup?role=manager" },
  },
  {
    name: "Arbitre",
    image: "/branding/role_arbitre.png",
    line: "Tu tiens le sifflet",
    body:
      "Ta fiche d'arbitre avec ton niveau de licence, et ta place dans la recherche : ceux qui cherchent quelqu'un pour siffler te trouvent. L'activation est libre, personne ne vérifie la licence aujourd'hui, elle sert à te présenter, pas à te valider.",
    cta: { label: "Devenir arbitre", href: "/signup?role=referee" },
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
      {/* Meme hero que Koppafoot Organize : image pleine page, texte pose
          en bas, titre a la taille de l'ecran. Les trois vitrines sont trois
          portes du meme produit, elles doivent s'ouvrir de la meme facon. */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/branding/role_joueur.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-32 sm:px-10 sm:pb-28">
          <p className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            Koppafoot Evolution
          </p>
          <h1 className="max-w-5xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-[-0.03em] text-white sm:text-[9vw] lg:text-[7.5vw]">
            Ce que tu
            <br />
            deviens ici
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70 sm:text-xl">
            Un compte, trois façons d&apos;être là. Tu choisis ce que tu es sur le
            terrain, et tu peux en changer sans rien perdre.
          </p>

          <Link
            href="/evolution"
            className="group mt-12 flex w-full items-center justify-between gap-6 bg-white px-8 py-7 text-gray-900 transition-colors hover:bg-amber-400 sm:px-12 sm:py-9"
          >
            <span className="font-display text-xl font-black uppercase tracking-tight sm:text-3xl">
              Choisir mon rôle
            </span>
            <ArrowRight
              size={32}
              strokeWidth={1.5}
              className="shrink-0 transition-transform group-hover:translate-x-2"
            />
          </Link>
        </div>
      </section>

      <section id="ouverts" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          {/* Ce que le hero promet, deploye : ce que chaque role donne, et ce
              qu'il demande. La liste EST le contenu de cette page. */}
          <h2 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-5xl">
            Trois façons d&apos;être là
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            Joueur, manager, arbitre. Un seul à la fois : c&apos;est ce que tu es
            sur le terrain, et ça se change quand ça change dans la vraie vie.
          </p>
          <div className="mt-8 grid gap-px bg-gray-200/70 lg:grid-cols-3">
            {OPEN.map((r) => <RoleCard key={r.name} role={r} />)}
          </div>
        </div>
      </section>

      <section id="choisir" className="scroll-mt-24 border-t border-gray-200/70 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-6xl">
            Le rôle se choisit après, pas avant
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            On crée le compte d&apos;abord, on choisit ensuite, et on peut en
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
