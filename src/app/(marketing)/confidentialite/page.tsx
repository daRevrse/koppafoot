import { DocumentJuridique, Liste, Lien, type SectionJuridique } from "@/components/legal/DocumentJuridique";

// ============================================
// La politique de confidentialité.
//
// ELLE DÉCRIT CE QUE LE CODE FAIT, PAS UN MODÈLE GÉNÉRIQUE. Chaque donnée
// citée ici existe dans l'application (voir types/index.ts, FirestoreUser),
// chaque prestataire est réellement appelé (Firebase, Vercel, Brevo ou
// Resend, et YouTube dès qu'un tutoriel a sa vidéo : voir
// components/aide/VideoYoutube), et ce qui part avec un compte supprimé est ce que
// lib/account-purge efface. Un ajout dans l'un de ces endroits (un champ de
// profil, un prestataire, un cookie) se reporte ici, ou la page ment.
//
// CE QU'ELLE NE PROMET PAS : un chiffrement de bout en bout, un hébergement au
// Togo, une absence totale de transfert. Rien de cela n'est vrai aujourd'hui.
//
// À FAIRE VALIDER par un juriste avant publication, et à compléter de
// l'identité de l'éditeur (raison sociale, adresse, immatriculation) dès que
// la société existe.
// ============================================

export const metadata = {
  title: "Politique de confidentialité, KoppaFoot",
  description: "Quelles données KoppaFoot collecte, pourquoi, avec qui elles sont partagées, et comment exercer tes droits.",
};

const MIS_A_JOUR = "6 octobre 2026";

const SECTIONS: SectionJuridique[] = [
  {
    id: "en-bref",
    titre: "En bref",
    corps: (
      <Liste>
        <li>Nous collectons ce qu&apos;il faut pour faire tourner tes équipes, tes matchs et tes compétitions, et rien pour te vendre quoi que ce soit.</li>
        <li>Les résultats, les statistiques et ta fiche de joueur sont publics. Ton e-mail et ton téléphone n&apos;y apparaissent jamais.</li>
        <li>Nous ne vendons pas tes données et n&apos;utilisons aucun cookie publicitaire.</li>
        <li>Tu peux corriger ton profil à tout moment et supprimer ton compte toi-même.</li>
        <li>Une question ? Écris-nous depuis la page <Lien href="/aide">Aide</Lien>, même sans compte.</li>
      </Liste>
    ),
  },
  {
    id: "responsable",
    titre: "Qui est responsable de tes données",
    corps: (
      <>
        <p>
          KoppaFoot, la plateforme du football amateur, basée à Lomé (Togo), décide de l&apos;usage de tes données. Elle est
          soumise à la loi togolaise n° 2019-014 du 29 octobre 2019 relative à la protection des données à caractère personnel.
        </p>
        <p>
          Pour toute question ou demande sur tes données, utilise le formulaire de la page <Lien href="/aide">Aide</Lien>. Il
          fonctionne sans compte, et chaque message arrive directement à l&apos;équipe.
        </p>
      </>
    ),
  },
  {
    id: "donnees",
    titre: "Ce que nous collectons",
    corps: (
      <>
        <p><strong>Ton compte.</strong> Prénom, nom, e-mail, genre (il accorde le nom de ton rôle : joueur ou joueuse), le rôle que tu choisis, et, si tu les donnes, ta ville et ton téléphone. Ton mot de passe est géré par notre prestataire d&apos;authentification : nous ne le voyons jamais. Si tu te connectes avec Google, nous recevons ton nom et ton e-mail. Si tu te connectes par SMS, ton numéro est transmis à ce même prestataire, qui t&apos;envoie le code et vérifie que la demande ne vient pas d&apos;un robot cherchant à envoyer des SMS frauduleux.</p>
        <p><strong>Ton profil sportif, s&apos;il te plaît de le remplir.</strong> Poste, niveau, pied fort, taille, poids, date de naissance, présentation, photos, palmarès. Pour un arbitre : niveau, années d&apos;expérience et numéro de licence. Ton état de forme (apte, incertain, blessé, suspendu, indisponible), si tu le déclares.</p>
        <p><strong>Ton activité sur KoppaFoot.</strong> Tes équipes, tes matchs et leurs feuilles, les buts, passes, cartons et notes qui te concernent, tes statistiques, tes compétitions, tes réservations de terrain, tes pronostics, les matchs et compétitions que tu suis.</p>
        <p><strong>Ce que tu publies ou nous envoies.</strong> Messages et commentaires de la Tribune, photos, signalements, messages envoyés à l&apos;équipe.</p>
        <p><strong>Les joueurs sans compte.</strong> Un manager peut inscrire dans son effectif un joueur qui n&apos;a pas de compte : nom, poste, numéro, statistiques. Il le fait sous sa responsabilité et doit avoir l&apos;accord du joueur, ou de ses parents s&apos;il est mineur.</p>
        <p><strong>Les données techniques.</strong> L&apos;identifiant de notifications de ton appareil, tes préférences de notification, et des statistiques de fréquentation anonymes (pages vues, type d&apos;appareil), qui ne te désignent pas.</p>
      </>
    ),
  },
  {
    id: "usages",
    titre: "Pourquoi nous les utilisons",
    corps: (
      <>
        <Liste>
          <li>Faire fonctionner le service : ton compte, tes équipes, les matchs, la console du direct, les compétitions, les réservations.</li>
          <li>Publier les résultats, les classements et les statistiques, qui sont l&apos;objet même de KoppaFoot.</li>
          <li>Te prévenir : notifications du direct, invitations, réponses à tes demandes, e-mails de service.</li>
          <li>Protéger la plateforme : traiter les signalements, suspendre un compte qui enfreint les <Lien href="/conditions">conditions d&apos;utilisation</Lien>.</li>
          <li>Améliorer KoppaFoot, à partir des statistiques de fréquentation anonymes et de tes retours.</li>
        </Liste>
        <p>
          Nous ne vendons pas tes données. Nous ne construisons pas de profil publicitaire à partir d&apos;elles. Si un jour
          des publicités de partenaires extérieurs apparaissent, cette page le dira avant, et ton accord sera demandé là où la
          loi l&apos;exige.
        </p>
      </>
    ),
  },
  {
    id: "public",
    titre: "Ce qui est public",
    corps: (
      <>
        <p>
          Le football se joue devant tout le monde : les scores, les buteurs, les compositions, les cartons, les statistiques
          et les classements sont visibles par tous, avec ou sans compte.
        </p>
        <p>
          Ta fiche publique montre, si tu les as remplis : prénom, nom, photos, ville, poste, niveau, pied fort, taille, poids,
          date de naissance, présentation, genre, nombre d&apos;abonnés, et pour un arbitre son niveau et son expérience (le
          numéro de licence y est masqué).
        </p>
        <p>
          Ton e-mail et ton téléphone n&apos;apparaissent jamais sur ta fiche ni sur les pages publiques. Ton état de forme,
          si tu le déclares, s&apos;affiche sur ta fiche pour les membres connectés seulement, pas pour les visiteurs. Quand tu réserves un terrain, le gérant reçoit ton nom et les coordonnées que tu joins à ta demande ; quand tu gères un
          terrain, le numéro que tu donnes pour ce terrain est montré à ceux qui le réservent.
        </p>
      </>
    ),
  },
  {
    id: "partage",
    titre: "Avec qui nous les partageons",
    corps: (
      <>
        <p>Avec les prestataires techniques qui font tourner KoppaFoot, et seulement pour cela :</p>
        <Liste>
          <li><strong>Google Firebase</strong> et <strong>reCAPTCHA</strong> : connexion (dont l&apos;envoi des codes par SMS et la vérification anti-robot), base de données, stockage des photos, envoi des notifications.</li>
          <li><strong>Vercel</strong> : hébergement du site et statistiques de fréquentation anonymes.</li>
          <li><strong>Brevo</strong> ou <strong>Resend</strong> : envoi des e-mails.</li>
          <li>
            <strong>YouTube</strong> (Google) : les vidéos des tutoriels, seulement si tu en lances une. Avant, rien ne
            lui est envoyé : la miniature passe par nos serveurs. Au moment où tu appuies sur lecture, la vidéo se charge
            depuis youtube-nocookie.com, le mode de YouTube qui limite les traceurs ; YouTube reçoit alors ton adresse IP
            et applique sa propre politique de confidentialité pendant la lecture.
          </li>
        </Liste>
        <p>
          Ces prestataires peuvent conserver les données sur des serveurs situés hors du Togo, notamment en Europe et aux
          États-Unis. Ils n&apos;ont le droit de s&apos;en servir que pour le service qu&apos;ils nous rendent.
        </p>
        <p>
          Les autres membres voient ce que leur rôle leur montre : l&apos;organisateur d&apos;une compétition voit les
          effectifs inscrits, un gérant voit les demandes faites sur son terrain. Enfin, nous répondons aux autorités quand la loi nous y oblige.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    titre: "Cookies et stockage sur ton appareil",
    corps: (
      <>
        <Liste>
          <li><strong>Un cookie de session</strong>, valable une heure et renouvelé tant que tu restes connecté : il permet au site de te reconnaître.</li>
          <li><strong>Un cookie de langue</strong>, qui retient le français ou l&apos;anglais pendant un an.</li>
          <li><strong>Le stockage local de ton navigateur</strong>, pour des préférences d&apos;affichage : thème, rappels déjà vus, invitation à installer l&apos;application.</li>
        </Liste>
        <p>
          Aucun cookie publicitaire ni de pistage d&apos;un site à l&apos;autre. Les statistiques de fréquentation fonctionnent
          sans cookie. Seule exception, et à ton initiative : une vidéo YouTube que tu lances peut enregistrer ses propres
          données dans ton navigateur pendant la lecture (voir plus haut).
        </p>
      </>
    ),
  },
  {
    id: "conservation",
    titre: "Combien de temps nous les gardons",
    corps: (
      <>
        <p>Tes données restent tant que ton compte existe.</p>
        <p>
          Quand tu supprimes ton compte, partent avec lui : ton profil, tes photos, tes notifications, tes réservations, tes
          invitations et demandes, les notes que tu as données, tes pronostics, tes publications et tes commentaires.
        </p>
        <p>
          Restent ce qui décrit les matchs joués : les scores et les feuilles de match, qui portent ton nom en copie. Ces
          matchs appartiennent aussi à tes coéquipiers et à tes adversaires, et leurs statistiques n&apos;auraient plus de sens
          sans eux.
        </p>
        <p>Les messages envoyés à l&apos;équipe sont conservés pour pouvoir y donner suite.</p>
      </>
    ),
  },
  {
    id: "droits",
    titre: "Tes droits",
    corps: (
      <>
        <Liste>
          <li><strong>Accéder</strong> à tes données et en obtenir une copie : demande-le depuis la page <Lien href="/aide">Aide</Lien>.</li>
          <li><strong>Les corriger</strong> : directement dans ton profil.</li>
          <li><strong>Les effacer</strong> : « Supprimer mon compte », en bas de ton profil, efface tout ce qui est décrit plus haut.</li>
          <li><strong>T&apos;opposer</strong> à un usage : les notifications se règlent catégorie par catégorie dans les réglages de ton compte ; pour le reste, écris-nous.</li>
        </Liste>
        <p>
          Nous répondons dans un délai d&apos;un mois. Si notre réponse ne te convient pas, tu peux saisir l&apos;Instance de
          protection des données à caractère personnel du Togo (<Lien href="https://ipdcp.tg/">IPDCP</Lien>).
        </p>
      </>
    ),
  },
  {
    id: "mineurs",
    titre: "Les mineurs",
    corps: (
      <p>
        Il faut avoir au moins 13 ans pour créer un compte. Entre 13 et 18 ans, il faut l&apos;accord d&apos;un parent. Un
        manager qui inscrit un joueur mineur sans compte doit avoir l&apos;accord de ses parents, et ne publie sa photo
        qu&apos;avec cet accord.
      </p>
    ),
  },
  {
    id: "securite",
    titre: "Sécurité",
    corps: (
      <p>
        Les échanges avec KoppaFoot sont chiffrés (HTTPS). L&apos;accès aux données est limité par des règles qui vérifient
        qui a le droit de lire ou d&apos;écrire chaque information, et les mots de passe ne sont jamais stockés par nous. Aucun
        système n&apos;est infaillible : si une fuite te concernait, nous te préviendrions.
      </p>
    ),
  },
  {
    id: "changements",
    titre: "Si cette politique change",
    corps: (
      <p>
        La date en haut de la page indique la version en vigueur. Pour un changement important, nous te prévenons à
        l&apos;avance, par notification ou par e-mail.
      </p>
    ),
  },
];

export default function ConfidentialitePage() {
  return (
    <DocumentJuridique
      surtitre="KoppaFoot · Tes données"
      titre="Politique de confidentialité"
      misAJour={MIS_A_JOUR}
      intro={
        <p>
          Ce que nous savons de toi, pourquoi, avec qui c&apos;est partagé, et comment le corriger ou l&apos;effacer. Écrit
          pour être lu jusqu&apos;au bout.
        </p>
      }
      sections={SECTIONS}
      voirAussi={{ href: "/conditions", label: "les conditions d'utilisation" }}
    />
  );
}
