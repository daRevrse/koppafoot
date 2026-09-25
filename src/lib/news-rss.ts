// Server-only. Lecteur de flux d'actualité pour la page Actus.
//
// Deux familles de sources. Google Actualités d'abord, pour le foot togolais :
// aucun média togolais testé ne publie de flux joignable, et un agrégateur
// est fait pour ça. Mais il ne porte AUCUNE image. D'où, à côté, des flux
// d'éditeurs qui en donnent une par article (retestés en septembre 2026 :
// Africa Top Sports et la rubrique CAN de RMC Sport répondent, avec photo).
//
// Ce qu'on affiche et pourquoi c'est limité à ça : le titre, l'éditeur, la
// date, le lien. Le flux ne porte pas de corps d'article, sa `description`
// n'est qu'une ancre HTML vers la source, et c'est très bien ainsi : on
// renvoie le lecteur chez celui qui a écrit, on ne recopie pas son travail.
//
// Dégrade en silence (renvoie []) : la page ne doit pas casser parce qu'un
// serveur tiers tousse au moment du rendu.

export interface Article {
  id: string;
  title: string;
  /** Le média qui publie, affiché, et c'est la moindre des choses. */
  source: string;
  url: string;
  /** ISO, ou "" si le flux n'a pas donné de date lisible. */
  at: string;
  /**
   * Vignette de l'article, telle que le flux de l'éditeur la donne.
   *
   * Toujours `null` pour Google Actualités. Ce qui a été essayé de ce côté :
   * gratter la balise og:image de la page intermédiaire. Ça rend LA MÊME
   * vignette générique pour tous les articles, pas celle du sujet.
   */
  image: string | null;
}

/**
 * Les requêtes qui composent le fil. L'ordre compte : en cas de doublon, la
 * première rencontrée gagne, donc le foot togolais passe avant le continent.
 */
const QUERIES: { q: string; label: string }[] = [
  { q: "football Togo", label: "Togo" },
  { q: "Éperviers du Togo", label: "Éperviers" },
  { q: "football africain CAN", label: "Afrique" },
];

const FEED = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=TG&ceid=TG:fr`;

/**
 * Les flux d'éditeurs, ceux qui illustrent leurs articles. Le nom est fixé
 * ici : sans balise <source>, deviner le média en coupant le titre au dernier
 * tiret amputerait les titres qui en contiennent un.
 */
const PUBLISHER_FEEDS: { url: string; source: string }[] = [
  { url: "https://africatopsports.com/feed/", source: "Africa Top Sports" },
  { url: "https://rmcsport.bfmtv.com/rss/football/coupe-d-afrique-des-nations/", source: "RMC Sport" },
];

/** Les entités que ces flux utilisent réellement. */
function decode(x: string): string {
  return x
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

/**
 * L'image que l'éditeur attache à l'article : `enclosure` ou `media:*` s'il y
 * en a, sinon la première <img> du corps (les flux WordPress la mettent là).
 */
function imageOf(block: string): string | null {
  const attached = block.match(
    /<(?:enclosure|media:content|media:thumbnail)[^>]*\burl="([^"]+)"/,
  );
  if (attached && !/\.(mp3|mp4|m4a)(\?|$)/i.test(attached[1])) return decode(attached[1]);
  const body = decode(tag(block, "content:encoded") || tag(block, "description"));
  const img = body.match(/<img[^>]*\bsrc="(https:[^"]+)"/);
  return img ? img[1] : null;
}

function toIso(rfc822: string): string {
  if (!rfc822) return "";
  const d = new Date(rfc822);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Google Actualités suffixe le titre du nom du média : « Titre - Le Monde ».
 * On préfère la balise <source>, et on ne retombe sur la découpe que si elle
 * manque, un titre peut légitimement contenir un tiret.
 */
function splitTitle(rawTitle: string, sourceTag: string): { title: string; source: string } {
  if (sourceTag) {
    const suffix = ` - ${sourceTag}`;
    return {
      title: rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle,
      source: sourceTag,
    };
  }
  const cut = rawTitle.lastIndexOf(" - ");
  if (cut > 0) {
    return { title: rawTitle.slice(0, cut), source: rawTitle.slice(cut + 3) };
  }
  return { title: rawTitle, source: "" };
}

/**
 * `source` absent : flux Google, le média se lit dans la balise <source>.
 * Présent : flux d'éditeur, c'est lui.
 */
async function readFeed(url: string, fixedSource?: string): Promise<Article[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoppaFoot/1.0)" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const out: Article[] = [];
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of items) {
      const raw = tag(block, "title");
      const link = tag(block, "link");
      if (!raw || !link) continue;
      const { title, source } = fixedSource
        ? { title: raw, source: fixedSource }
        : splitTitle(raw, tag(block, "source"));
      out.push({
        id: tag(block, "guid") || link,
        title,
        source: source || "Source",
        url: link,
        at: toIso(tag(block, "pubDate")),
        image: fixedSource ? imageOf(block) : null,
      });
    }
    return out;
  } catch (err) {
    console.error(`readFeed(${url}) failed:`, err);
    return [];
  }
}

/**
 * Le fil, plus récent d'abord.
 *
 * Les requêtes se recoupent volontiers, un match des Éperviers sort dans les
 * trois, donc on dédoublonne sur le titre normalisé plutôt que sur le lien :
 * deux médias reprenant la même dépêche ont des URL différentes, mais le même
 * titre à la casse près.
 */
export async function getSportsArticles(max = 30): Promise<Article[]> {
  // Les éditeurs d'abord : au dédoublonnage, la première version gagne, et
  // c'est la leur qui porte la photo, pas sa reprise par Google.
  const batches = await Promise.all([
    ...PUBLISHER_FEEDS.map((f) => readFeed(f.url, f.source)),
    ...QUERIES.map((x) => readFeed(FEED(x.q))),
  ]);

  const seen = new Set<string>();
  return batches
    .flat()
    .filter((a) => {
      const key = a.title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
      if (key === "" || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, max);
}
