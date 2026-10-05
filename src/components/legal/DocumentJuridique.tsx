import Link from "next/link";

// ============================================
// La mise en page des textes juridiques : politique de confidentialité,
// conditions d'utilisation.
//
// UN TEXTE QU'ON PEUT LIRE. Ces pages sont souvent un mur gris que personne
// n'ouvre ; ici chaque section commence par ce qu'elle dit, en phrases
// courtes, et le sommaire permet de sauter à la question qu'on se pose. Le
// ton reste celui de l'application (le tutoiement), parce que c'est à la même
// personne qu'on parle.
//
// Les deux pages partagent cette coquille pour ne pas diverger : un texte
// juridique qui change de forme d'une page à l'autre a l'air bricolé, et un
// sommaire codé deux fois finit par ne plus correspondre à ses ancres.
// ============================================

export interface SectionJuridique {
  /** L'ancre de la section, dans l'adresse : /confidentialite#droits. */
  id: string;
  titre: string;
  corps: React.ReactNode;
}

export function DocumentJuridique({
  surtitre,
  titre,
  misAJour,
  intro,
  sections,
  voirAussi,
}: {
  surtitre: string;
  titre: string;
  /** La date de la version en vigueur, écrite en toutes lettres. */
  misAJour: string;
  intro: React.ReactNode;
  sections: SectionJuridique[];
  voirAussi: { href: string; label: string };
}) {
  return (
    <div className="bg-white">
      <header className="border-b border-gray-200/70">
        <div className="mx-auto max-w-4xl px-6 pb-14 pt-16 sm:px-10 sm:pb-20 sm:pt-24">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">{surtitre}</p>
          <h1 className="mt-5 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-6xl">
            {titre}
          </h1>
          <p className="mt-6 text-sm font-semibold text-gray-500">Dernière mise à jour : {misAJour}</p>
          <div className="mt-8 max-w-2xl text-lg leading-relaxed text-gray-700">{intro}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav aria-label="Sommaire" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sommaire</p>
          <ol className="mt-4 space-y-2.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 text-sm text-gray-600 transition-colors hover:text-emerald-700">
                  <span className="w-5 shrink-0 font-bold tabular-nums text-gray-300">{i + 1}</span>
                  <span>{s.titre}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-14">
          {sections.map((s, i) => (
            // La marge d'ancrage laisse la place à l'en-tête collant : sans
            // elle, un clic dans le sommaire posait le titre dessous.
            <section key={s.id} id={s.id} className="scroll-mt-32">
              <h2 className="flex gap-3 font-display text-2xl font-black leading-tight text-gray-900 sm:text-3xl">
                <span className="text-gray-300">{i + 1}.</span>
                <span>{s.titre}</span>
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-gray-700 sm:text-base">{s.corps}</div>
            </section>
          ))}

          <p className="border-t border-gray-200/70 pt-8 text-sm text-gray-500">
            À lire aussi :{" "}
            <Link href={voirAussi.href} className="font-bold text-gray-900 underline underline-offset-4 hover:text-emerald-700">
              {voirAussi.label}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Une liste à puces dans le corps d'une section. */
export function Liste({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-emerald-600">{children}</ul>;
}

/** Un lien dans le corps du texte, interne ou externe. */
export function Lien({ href, children }: { href: string; children: React.ReactNode }) {
  const classe = "font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900";
  if (href.startsWith("http")) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={classe}>{children}</a>;
  }
  return <Link href={href} className={classe}>{children}</Link>;
}
