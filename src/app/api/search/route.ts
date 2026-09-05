import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// ============================================
// Public search, one server-side query for every kind.
//
// Why a route and not client Firestore: `teams` and `users` sit behind
// isAuthenticated() in firestore.rules, so a signed-out visitor searching
// from the modal got two silently empty sections and an invitation to log
// in. Searching is how someone decides whether the product is worth an
// account; asking for the account first has it backwards. Reading here with
// admin credentials opens the search without opening the collections.
//
// Only public-facing fields are returned, no email, no phone, no tokens.
// That list is explicit below and must stay that way.
//
// Scale note: this reads whole collections and filters in memory. At the
// current size (tens of users, single-digit teams and competitions) that is
// one cheap read per kind and far simpler than maintaining search indexes.
// It needs revisiting somewhere in the thousands.
// ============================================

export const revalidate = 120;

const MAX = 6;

type Row = Record<string, unknown>;

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Accent- and case-insensitive, so "miabe" finds "Miabé". */
const fold = (x: string): string =>
  x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const POSITION_FR: Record<string, string> = {
  goalkeeper: "Gardien", defender: "Défenseur", midfielder: "Milieu", forward: "Attaquant",
};

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image: string | null;
  /** Shown as a chip on the right of the row. */
  badge?: string;
}

export interface SearchPayload {
  competitions: SearchHit[];
  teams: SearchHit[];
  players: SearchHit[];
  terrains: SearchHit[];
  arbitres: SearchHit[];
  /** True when no query was given and these are popularity picks. */
  suggestions: boolean;
}

interface Ranked {
  hit: SearchHit;
  rank: number;
  haystack: string;
}

const fullName = (x: Row): string =>
  `${s(x.first_name)} ${s(x.last_name)}`.trim() || "Joueur";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const needle = fold(q);
  const searching = needle.length >= 2;

  try {
    const [compsSnap, teamsSnap, usersSnap, venuesSnap] = await Promise.all([
      adminDb.collection("competitions").get(),
      adminDb.collection("teams").get(),
      adminDb.collection("users").get(),
      adminDb.collection("venues").get(),
    ]);

    // Competitions carry no follower counter of their own; the truth lives
    // on each profile's followed_competition_ids. Counted here so "popular"
    // means something rather than falling back to alphabetical.
    const compFollowers = new Map<string, number>();
    usersSnap.docs.forEach((d) => {
      const ids = d.data().followed_competition_ids;
      if (Array.isArray(ids)) {
        ids.forEach((id) => {
          if (typeof id === "string") compFollowers.set(id, (compFollowers.get(id) ?? 0) + 1);
        });
      }
    });

    // LE BAC A SABLE N'EST PAS UNE COMPETITION. `/api/live-training` en cree
    // une pour faire tourner la console a blanc, marquee `is_sandbox`. Elle
    // remontait dans « competitions populaires » sous le nom « Match
    // d'entrainement », a cote de la CAN : ce qu'elle contient sont des
    // amicaux, qui ne s'annoncent pas comme une competition.
    const competitions: Ranked[] = compsSnap.docs
      .filter((d) => (d.data() as Row).is_sandbox !== true)
      .map((d) => {
      const x = d.data() as Row;
      const followers = compFollowers.get(d.id) ?? 0;
      return {
        hit: {
          id: d.id,
          title: s(x.name) || "Compétition",
          subtitle: s(x.venue_city) || s(x.organizer_name) || "",
          href: `/c/${s(x.slug) || d.id}`,
          image: s(x.logo_url) || null,
          badge: followers > 0 ? `${followers} abonné${followers > 1 ? "s" : ""}` : undefined,
        },
        rank: followers,
        haystack: fold(`${s(x.name)} ${s(x.venue_city)} ${s(x.organizer_name)}`),
      };
    });

    const teams: Ranked[] = teamsSnap.docs.map((d) => {
      const x = d.data() as Row;
      const followers = n(x.followers_count);
      const members = Array.isArray(x.member_ids) ? x.member_ids.length : 0;
      return {
        hit: {
          id: d.id,
          title: s(x.name) || "Équipe",
          subtitle: s(x.city) || "",
          href: `/teams/${d.id}`,
          image: s(x.logo_url) || null,
          badge: x.is_recruiting === true ? "Recrute" : undefined,
        },
        // Followers first, then squad size, a club with people in it is a
        // better suggestion than an empty shell created five minutes ago.
        rank: followers * 100 + members,
        haystack: fold(`${s(x.name)} ${s(x.city)}`),
      };
    });

    // Les terrains referencés, lus dans `venues` — et seulement la.
    //
    // La categorie « terrains » ne montrait au depart que des COMPTES de
    // proprietaires, avec leurs champs `venue_name`/`venue_city` : un compte
    // ne pouvait donc porter qu'un seul terrain, et la collection `venues`,
    // pourtant complete, n'etait lue nulle part. Les deux sources ont
    // coexiste le temps que les anciens comptes soient repris. Ils l'ont ete
    // (scripts/migrate-user-type.ts), plus aucun `user_type` ne vaut
    // « venue_owner », et la source unique est desormais `venues`.
    const venueHits: Ranked[] = venuesSnap.docs.map((d) => {
      const x = d.data() as Row;
      const city = s(x.city);
      return {
        hit: {
          id: d.id,
          title: s(x.name) || "Terrain",
          subtitle: [s(x.address), city].filter(Boolean).join(", ") || "",
          href: `/terrains/${d.id}`,
          image: s(x.photo_url) || null,
          badge: x.available === false ? "Fermé" : undefined,
        },
        // Un terrain ouvert passe devant un terrain ferme.
        rank: x.available === false ? 0 : 1,
        haystack: fold(`${s(x.name)} ${city} ${s(x.address)}`),
      };
    });

    // One pass over the profiles, split by role.
    const players: Ranked[] = [];
    const terrains: Ranked[] = [...venueHits];
    const arbitres: Ranked[] = [];

    usersSnap.docs.forEach((d) => {
      const x = d.data() as Row;
      if (x.is_active === false) return;
      // Le role Evolution passe AVANT le type de compte. `user_type` dit ce
      // qu'est le compte, un organisateur reste `organizer` meme quand il
      // active l'espace arbitre, parce que l'activation preserve les types
      // privilegies. Classer sur lui seul rendait invisible tout arbitre qui
      // est aussi autre chose, et la recherche est justement l'endroit ou un
      // organisateur cherche quelqu'un pour siffler.
      //
      // Repli sur `user_type` pour les comptes d'avant Evolution, qui n'ont
      // pas de role active mais portent deja `manager` ou `referee`. Il ne
      // porte plus AUCUNE casquette : celles-ci sont des drapeaux.
      const type = s(x.evolution_role) || s(x.user_type);
      const name = fullName(x);
      const city = s(x.location_city);
      const photo = s(x.profile_picture_url) || null;
      const followers = n(x.followers_count);

      if (type === "referee") {
        const level = s(x.license_level);
        arbitres.push({
          hit: {
            id: d.id,
            title: name,
            subtitle: city || "",
            href: `/profile/${d.id}`,
            image: photo,
            badge: level ? `Licence ${level}` : undefined,
          },
          rank: followers,
          haystack: fold(`${name} ${city} ${level}`),
        });
        return;
      }

      // Le reste est cherchable comme personne. Un compte « user » — un
      // spectateur qui n'a activé aucun rôle — n'y entre PAS : il n'a ni
      // poste, ni statistiques, et le proposer sous « joueurs » remplissait
      // la recherche de fiches vides.
      if (type === "user") return;

      const pos = POSITION_FR[s(x.position)] ?? s(x.position);
      players.push({
        hit: {
          id: d.id,
          title: name,
          subtitle: [pos, city].filter(Boolean).join(" · ") || "",
          href: `/profile/${d.id}`,
          image: photo,
          badge: followers > 0 ? `${followers} abonné${followers > 1 ? "s" : ""}` : undefined,
        },
        rank: followers * 100 + n(x.goals),
        haystack: fold(`${name} ${city} ${pos}`),
      });
    });

    const finish = (rows: Ranked[]): SearchHit[] =>
      rows
        .filter((r) => (searching ? r.haystack.includes(needle) : true))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, MAX)
        .map((r) => r.hit);

    const payload: SearchPayload = {
      competitions: finish(competitions),
      teams: finish(teams),
      players: finish(players),
      terrains: finish(terrains),
      arbitres: finish(arbitres),
      suggestions: !searching,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("search failed:", err);
    const empty: SearchPayload = {
      competitions: [], teams: [], players: [], terrains: [], arbitres: [],
      suggestions: !searching,
    };
    return NextResponse.json(empty, { status: 200 });
  }
}
