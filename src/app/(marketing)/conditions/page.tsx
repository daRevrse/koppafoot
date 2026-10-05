import { DocumentJuridique, Liste, Lien, type SectionJuridique } from "@/components/legal/DocumentJuridique";

// ============================================
// Les conditions d'utilisation.
//
// ELLES REPRENNENT LES PROMESSES DÉJÀ FAITES, sans en retirer une : la
// gratuité de l'accueil, « La plateforme n'encaisse rien et ne prend aucune
// commission » de la page des terrains. Un texte juridique qui contredit la
// vitrine casse la confiance plus vite qu'aucun prix.
//
// L'AVENIR PAYANT Y EST ÉCRIT HONNÊTEMENT : des options pourront apparaître,
// annoncées avant, jamais imposées pour finir ce qui est commencé. C'est ce
// qui permet plus tard des limites d'usage sans trahir personne.
//
// À FAIRE VALIDER par un juriste avant publication, et à compléter de
// l'identité de l'éditeur dès que la société existe.
// ============================================

export const metadata = {
  title: "Conditions d'utilisation, KoppaFoot",
  description: "Les règles du jeu sur KoppaFoot : ton compte, les rôles, ce qui est interdit, ce qui est gratuit.",
};

const MIS_A_JOUR = "5 octobre 2026";

const SECTIONS: SectionJuridique[] = [
  {
    id: "en-bref",
    titre: "En bref",
    corps: (
      <Liste>
        <li>KoppaFoot est gratuit. Si des options payantes apparaissent un jour, elles seront annoncées avant, et jamais imposées pour finir ce que tu as commencé.</li>
        <li>Chacun est responsable de ce qu&apos;il saisit : un score, une feuille de match, une publication.</li>
        <li>Pas de triche sur les scores, pas d&apos;insultes, pas de paris d&apos;argent sur les matchs.</li>
        <li>Les résultats des matchs joués restent, même si un compte part.</li>
      </Liste>
    ),
  },
  {
    id: "service",
    titre: "Le service",
    corps: (
      <>
        <p>
          KoppaFoot permet d&apos;organiser et de suivre le football amateur : équipes, matchs, compétitions, direct des
          matchs, statistiques, terrains et arbitres. En créant un compte ou en utilisant le site, tu acceptes ces conditions
          et la <Lien href="/confidentialite">politique de confidentialité</Lien>.
        </p>
        <p>
          L&apos;utilisation de KoppaFoot est gratuite. Si des options payantes apparaissent, elles seront annoncées à
          l&apos;avance, leur prix sera affiché avant tout paiement, et aucune ne sera exigée pour terminer un match ou une
          compétition déjà commencés.
        </p>
      </>
    ),
  },
  {
    id: "compte",
    titre: "Ton compte",
    corps: (
      <Liste>
        <li>Il faut avoir au moins 13 ans. Entre 13 et 18 ans, il faut l&apos;accord d&apos;un parent.</li>
        <li>Un compte par personne, à ton vrai nom : les feuilles de match et les statistiques en dépendent.</li>
        <li>Tu gardes ton mot de passe pour toi ; ce qui est fait depuis ton compte est fait en ton nom.</li>
        <li>
          Tu peux supprimer ton compte à tout moment depuis ton profil. Si tu gères une équipe, organises une compétition ou
          possèdes un terrain, il faut d&apos;abord passer la main : d&apos;autres en dépendent.
        </li>
      </Liste>
    ),
  },
  {
    id: "roles",
    titre: "Les rôles, et ce qu'ils engagent",
    corps: (
      <Liste>
        <li><strong>Organisateur</strong> : il fixe le règlement de sa compétition et les frais d&apos;inscription éventuels. Il encaisse lui-même ces frais ; KoppaFoot les affiche sans les encaisser.</li>
        <li><strong>Manager</strong> : il tient son effectif. S&apos;il inscrit des joueurs sans compte, il doit avoir leur accord, et celui des parents pour un mineur.</li>
        <li><strong>Scoreur et arbitre</strong> : ils saisissent fidèlement ce qui s&apos;est passé sur le terrain, ni plus ni moins.</li>
        <li><strong>Gérant de terrain</strong> : il donne des informations exactes sur son terrain et ses tarifs. Le paiement se règle entre lui et les équipes : la plateforme n&apos;encaisse rien et ne prend aucune commission sur les réservations.</li>
        <li><strong>Joueur et supporter</strong> : ils suivent, jouent, publient, dans le respect des autres.</li>
      </Liste>
    ),
  },
  {
    id: "interdits",
    titre: "Ce qui est interdit",
    corps: (
      <>
        <Liste>
          <li>Fausser un score, une feuille de match ou des statistiques.</li>
          <li>Se faire passer pour quelqu&apos;un d&apos;autre, ou créer des comptes pour un autre sans son accord.</li>
          <li>Publier des insultes, des menaces, du harcèlement, des propos discriminatoires, des contenus sexuels ou violents.</li>
          <li>Publier la photo ou les informations de quelqu&apos;un sans son accord, en particulier d&apos;un mineur.</li>
          <li>Utiliser KoppaFoot pour organiser des paris d&apos;argent sur des matchs.</li>
          <li>Envoyer du spam, aspirer les données du site, ou tenter de contourner ses protections.</li>
        </Liste>
        <p>
          Tout membre peut signaler un contenu ou un compte. L&apos;équipe peut retirer un contenu et suspendre un compte qui
          enfreint ces règles ; la personne concernée peut s&apos;en expliquer depuis la page{" "}
          <Lien href="/aide">Aide</Lien>.
        </p>
      </>
    ),
  },
  {
    id: "contenus",
    titre: "Ce que tu publies",
    corps: (
      <p>
        Tes textes et tes photos restent à toi. Tu autorises KoppaFoot à les afficher sur la plateforme et dans les aperçus
        de partage (un lien envoyé sur WhatsApp, par exemple), le temps qu&apos;ils sont en ligne. Tu garantis avoir le droit
        de publier ce que tu publies.
      </p>
    ),
  },
  {
    id: "matchs",
    titre: "Les données des matchs",
    corps: (
      <p>
        Les scores, les buteurs, les compositions et les statistiques sont publics : c&apos;est l&apos;objet du service. Ils
        appartiennent à l&apos;histoire des matchs, et donc aussi aux coéquipiers et aux adversaires : ils restent quand un
        compte est supprimé, avec le nom de la personne en copie sur la feuille de match.
      </p>
    ),
  },
  {
    id: "partenaires",
    titre: "Partenaires et sponsors",
    corps: (
      <p>
        Certaines pages peuvent présenter des partenaires, par exemple le sponsor d&apos;une compétition. Ils sont toujours
        signalés comme tels. Leurs offres relèvent d&apos;eux seuls ; KoppaFoot ne vend pas tes données pour les afficher.
      </p>
    ),
  },
  {
    id: "responsabilite",
    titre: "Disponibilité et responsabilité",
    corps: (
      <>
        <p>
          Nous faisons de notre mieux pour que KoppaFoot fonctionne à toute heure, mais nous ne pouvons pas le garantir : une
          panne, une maintenance ou un réseau défaillant peuvent l&apos;interrompre.
        </p>
        <p>
          Les scores et les statistiques sont saisis par la communauté et peuvent contenir des erreurs, qui se corrigent.
          KoppaFoot n&apos;est pas partie aux accords entre organisateurs, équipes, arbitres et gérants : un litige sur un
          paiement, une réservation ou un règlement de compétition se règle entre eux.
        </p>
      </>
    ),
  },
  {
    id: "changements",
    titre: "Si ces conditions changent",
    corps: (
      <p>
        La date en haut de la page indique la version en vigueur. Pour un changement important, nous te prévenons à
        l&apos;avance, par notification ou par e-mail. Continuer à utiliser KoppaFoot après cette date vaut accord ; tu peux
        aussi supprimer ton compte si tu n&apos;es pas d&apos;accord.
      </p>
    ),
  },
  {
    id: "droit",
    titre: "Droit applicable",
    corps: (
      <p>
        Ces conditions sont soumises au droit togolais. En cas de désaccord, écris-nous d&apos;abord depuis la page{" "}
        <Lien href="/aide">Aide</Lien> : nous chercherons une solution à l&apos;amiable avant toute autre démarche.
      </p>
    ),
  },
];

export default function ConditionsPage() {
  return (
    <DocumentJuridique
      surtitre="KoppaFoot · Les règles du jeu"
      titre="Conditions d'utilisation"
      misAJour={MIS_A_JOUR}
      intro={<p>Ce que KoppaFoot te promet, et ce que tu t&apos;engages à respecter en l&apos;utilisant.</p>}
      sections={SECTIONS}
      voirAussi={{ href: "/confidentialite", label: "la politique de confidentialité" }}
    />
  );
}
