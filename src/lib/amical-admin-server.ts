import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ghostOpponentLineup, totalJoueurs } from "@/lib/effectif-match";
import { notifierComptes } from "@/lib/notifier-serveur";
import { dateLongue } from "@/lib/terrains";
import type { AmicalAdmin } from "@/lib/amical-admin";

// ============================================
// Server-only : l'administration programme un amical.
//
// PROGRAMMÉ, PAS PROPOSÉ. Un manager qui défie un autre club attend sa
// réponse (voir `createMatch`, lib/firestore) ; ici c'est l'administration
// qui pose le match au calendrier des deux clubs, parce qu'ils le lui ont
// demandé ou qu'elle l'organise. Il naît donc « à venir », et les deux
// effectifs sont convoqués dans la foulée — ce que l'acceptation d'un défi
// aurait fait (voir `respondToMatchChallenge`).
//
// LE MATCH RESTE CELUI DES MANAGERS. `manager_id` est le manager du club à
// domicile, `away_manager_id` celui d'en face : ce sont eux qui composent,
// déplacent ou annulent ensuite, exactement comme s'ils l'avaient créé.
// L'administration n'y laisse que sa signature (`created_by_admin`).
//
// Face à un adversaire hors plateforme, même forme qu'un amical de manager :
// pas d'équipe en base, son nom et son onze vivent sur le match.
// ============================================

/** Un refus qui se dit tel quel à l'administrateur : club introuvable, sans manager… */
export class AmicalRefuse extends Error {}

const BATCH_LIMIT = 450;

const texte = (x: unknown) => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);
const uids = (x: unknown) => (Array.isArray(x) ? x.filter((u): u is string => typeof u === "string" && u !== "") : []);

async function club(id: string, lequel: string) {
  const snap = await adminDb.collection("teams").doc(id).get();
  const d = snap.data();
  if (!snap.exists || !d || d.is_ghost === true) throw new AmicalRefuse(`${lequel} introuvable.`);
  const nom = texte(d.name) ?? "Équipe";
  const manager = texte(d.manager_id);
  // Sans manager, personne ne compose ni ne clôt le match : il resterait au
  // calendrier sans que quiconque puisse le tenir.
  if (!manager) throw new AmicalRefuse(`${nom} n'a pas de manager : personne ne pourrait tenir ce match.`);
  return { id, nom, manager, logo: texte(d.logo_url), membres: uids(d.member_ids), feminin: d.category === "women" };
}

export async function creerAmicalAdmin(
  a: AmicalAdmin,
  adminUid: string,
): Promise<{ id: string; convoques: number }> {
  const [domicile, exterieur] = await Promise.all([
    club(a.homeTeamId, "Équipe à domicile"),
    a.awayTeamId ? club(a.awayTeamId, "Adversaire") : Promise.resolve(null),
  ]);

  const nomExterieur = exterieur?.nom ?? a.awayName;
  const libelle = `${domicile.nom} vs ${nomExterieur}`;
  const onzeAdverse = exterieur ? [] : ghostOpponentLineup(a.format, domicile.feminin);

  const ref = adminDb.collection("matches").doc();
  await ref.set({
    home_team_id: domicile.id,
    away_team_id: exterieur?.id ?? "",
    home_team_name: domicile.nom,
    away_team_name: nomExterieur,
    home_team_logo: domicile.logo,
    away_team_logo: exterieur?.logo ?? null,
    manager_id: domicile.manager,
    away_manager_id: exterieur?.manager ?? "",
    date: a.date,
    time: a.time,
    venue_name: a.venueName,
    venue_city: a.venueCity,
    venue_id: null,
    status: "upcoming",
    result: null,
    score_home: null,
    score_away: null,
    referee_id: null,
    referee_name: null,
    referee_status: "none",
    local_referee_name: null,
    format: a.format,
    is_home: true,
    players_confirmed: 0,
    players_total: totalJoueurs(a.format),
    confirmed_home: 0,
    confirmed_away: 0,
    auto_accept_players: false,
    away_ghost_lineup: onzeAdverse.map((e) => ({
      player_id: e.playerId, name: e.name, number: e.number, role: e.role, position: null,
    })),
    away_lineup_ready: onzeAdverse.length > 0,
    created_by_admin: adminUid,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Les convocations des deux camps, une par joueur qui a un compte. Les
  // joueurs sans compte n'en ont pas : leur manager les pose sur la feuille.
  const camps = [
    { equipe: domicile, isHome: true },
    ...(exterieur ? [{ equipe: exterieur, isHome: false }] : []),
  ];
  const tous = [...new Set(camps.flatMap((c) => c.equipe.membres))];
  const profils = tous.length > 0
    ? await adminDb.getAll(...tous.map((uid) => adminDb.collection("users").doc(uid)))
    : [];
  const nomDe = new Map(
    profils.filter((p) => p.exists).map((p) => [
      p.id,
      `${p.data()?.first_name ?? ""} ${p.data()?.last_name ?? ""}`.trim(),
    ]),
  );

  const convocations = camps.flatMap((c) =>
    // Un compte supprimé peut traîner dans `member_ids` : on ne le convoque pas.
    c.equipe.membres.filter((uid) => nomDe.has(uid)).map((uid) => ({
      player_id: uid,
      player_name: nomDe.get(uid) ?? "",
      team_id: c.equipe.id,
      match_id: ref.id,
      match_label: libelle,
      match_date: a.date,
      match_time: a.time,
      venue_name: a.venueName,
      status: "pending",
      goals: 0,
      assists: 0,
      match_format: a.format,
      is_home: c.isHome,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })),
  );
  for (let i = 0; i < convocations.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const c of convocations.slice(i, i + BATCH_LIMIT)) {
      batch.set(adminDb.collection("participations").doc(), c);
    }
    await batch.commit();
  }

  // Awaited on purpose : en fonction serverless, une promesse encore en vol
  // quand la réponse part est abandonnée. `notifierComptes` ne lève jamais.
  const quand = `le ${dateLongue(a.date)} à ${a.time}`;
  await Promise.all([
    notifierComptes([domicile.manager, exterieur?.manager ?? ""], {
      type: "match_challenge",
      title: "Match programmé par KoppaFoot",
      body: `${libelle}, ${quand}${a.venueName ? `, ${a.venueName}` : ""}. Tes joueurs sont convoqués.`,
      link: `/matches/${ref.id}`,
    }),
    notifierComptes(convocations.map((c) => c.player_id), {
      type: "participation_request",
      title: "Convocation à un match",
      body: `Ton équipe te convoque pour ${libelle} ${quand}`,
      link: "/participations",
    }),
  ]);

  return { id: ref.id, convoques: convocations.length };
}
