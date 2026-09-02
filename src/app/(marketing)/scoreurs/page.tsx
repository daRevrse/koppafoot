import Link from "next/link";
import {
  Radio, Hand, ListChecks, ShieldCheck, ArrowRight,
} from "lucide-react";

// ============================================
// Le site du scoreur.
//
// Même registre que /organisateurs : pas une page de l'application, pas de
// coquille, pas de barre du bas. On arrive ici par un message WhatsApp ou une
// conversation au bord d'un terrain, et on ne doit encore rien à KoppaFoot.
// La page argumente avant de demander.
//
// CE QU'ELLE NE FAIT PAS : promettre une rémunération, un statut, ou un
// nombre de matchs. Rien de tout cela n'est décidé, et une page qui invente
// ce qu'elle ignore se paie au premier bénévole déçu.
//
// Elle dit en revanche ce qu'un scoreur NE PEUT PAS faire. C'est ce qui
// rassure les deux côtés : celui qui se propose sait où s'arrête sa
// responsabilité, et le manager qui lit la page sait ce qu'un inconnu pourra
// toucher de son match.
// ============================================

export const metadata = {
  title: "Devenir scoreur, KoppaFoot",
  description:
    "Tenir la console d'un match au bord du terrain : buts, passeurs, cartons, "
    + "remplacements. Le score bouge en direct pour ceux qui suivent.",
  openGraph: {
    title: "Deviens scoreur sur KoppaFoot",
    description:
      "Un match qui se joue près de chez toi, un téléphone, et tout le monde suit le score en direct.",
    images: ["/branding/hero_stadium.png"],
  },
};

const CE_QUON_FAIT = [
  {
    Icon: Radio,
    title: "Le direct, depuis la touche",
    body: "Coup d'envoi, buts, passeurs, cartons, remplacements, arrêts du gardien. Chaque geste part sur la page publique dans la seconde.",
  },
  {
    Icon: Hand,
    title: "On touche le joueur, pas un menu",
    body: "La console montre le terrain et les maillots. Tu touches celui qui vient de marquer, tu choisis l'action. C'est l'ordre dans lequel ça s'est passé.",
  },
  {
    Icon: ListChecks,
    title: "Tu choisis tes matchs",
    body: "Une fois validé, ton espace liste les amicaux que personne ne couvre. Tu prends celui qui t'arrange, et tu peux le rendre tant qu'il n'a pas commencé.",
  },
];

export default function ScoreursPage() {
  return (
    <main className="bg-white">
      {/* Ce qu'on vient chercher ici tient en une phrase. */}
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-20 sm:pt-28">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-600">
          Devenir scoreur
        </p>
        <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight text-gray-900 sm:text-6xl">
          Un match se joue près de chez toi.
          <br />
          <span className="text-gray-400">Personne ne sait le score.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-gray-600">
          Les amicaux se jouent sans que rien n&apos;en sorte : pas de score en
          direct, pas de buteurs, rien pour ceux qui n&apos;ont pas pu venir. Un
          scoreur, c&apos;est quelqu&apos;un avec un téléphone au bord du
          terrain, et ça suffit à changer ça.
        </p>
        <Link
          href="/scoreurs/candidature"
          className="mt-10 inline-flex items-center gap-2 bg-gray-900 px-7 py-4 text-[12px] font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
        >
          Déposer ma candidature
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="border-y border-gray-200/70 bg-gray-50/50">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-3 sm:py-20">
          {CE_QUON_FAIT.map(({ Icon, title, body }) => (
            <div key={title}>
              <Icon size={30} className="text-emerald-600" strokeWidth={1.5} />
              <h2 className="mt-5 font-display text-lg font-black leading-tight text-gray-900">
                {title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Les limites, dites franchement. Elles rassurent les deux côtés. */}
      <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
        <div className="flex items-start gap-5">
          <ShieldCheck size={30} className="mt-1 shrink-0 text-gray-300" strokeWidth={1.5} />
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
              Ce qu&apos;un scoreur ne peut pas faire
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-gray-600">
              Couvrir un match, c&apos;est en tenir le déroulé et le score. Ce
              n&apos;est pas le rédiger. La date, le lieu, les équipes, la liste
              des joueurs et celle des autres scoreurs restent à ceux qui
              organisent la rencontre — ce n&apos;est pas une politesse, c&apos;est
              écrit dans les règles du serveur.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-gray-600">
              Et on ne couvre pas un match qu&apos;on joue. Si tu figures sur la
              feuille, la console reste fermée : saisir les buts de sa propre
              rencontre, ce n&apos;est plus arbitrer un score, c&apos;est être
              juge et partie.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200/70 bg-gray-900 px-5 py-16 text-center sm:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
          Il faut une candidature, et c&apos;est voulu
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
          Ce qu&apos;un scoreur saisit devient le score officiel de la rencontre,
          compte dans les statistiques des deux équipes et remonte dans le
          classement des joueurs. On lit chaque candidature avant de valider.
        </p>
        <Link
          href="/scoreurs/candidature"
          className="mt-10 inline-flex items-center gap-2 bg-white px-7 py-4 text-[12px] font-black uppercase tracking-widest text-gray-900 transition-colors hover:bg-emerald-50"
        >
          Déposer ma candidature
          <ArrowRight size={16} />
        </Link>
        <p className="mt-8 text-[13px] text-white/40">
          Tu organises déjà une compétition ? Tu es scoreur sur tes propres
          matchs, sans rien demander.
        </p>
      </section>
    </main>
  );
}
