// Server-only. Lecteur de flux d'actualité pour la page Actus.
//
// Pourquoi Google Actualités plutôt que les sites eux-mêmes : sur huit flux
// candidats testés (RFI, BBC Sport Afrique, L'Équipe, Foot Mercato, RMC,
// CAF, Republic of Togo, Afrikfoot), un seul répondait encore, les autres
// rendent 404, 406 ou une page d'atterrissage. Un agrégateur reste joignable
// et, surtout, il est fait pour ça.
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
   * Vignette de l'article. Toujours `null` aujourd'hui, et le champ reste
   * pour le jour où une source en fournira.
   *
   * Ce qui a été essayé : gratter la balise og:image de la page Google
   * Actualités. Ça rend bien une image, mais LA MÊME pour tous les articles,
   * parce que la page intermédiaire sert une vignette générique et non celle
   * du sujet. Et elle ne s'affichait pas une fois posée dans la page. Aucun
   * des flux atteignables ne porte media:content, enclosure ni <img>.
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

/** Les entités que ces flux utilisent réellement. */
function decode(x: string): string {
  return x
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
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

async function readFeed(q: string): Promise<Article[]> {
  try {
    const res = await fetch(FEED(q), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoppaFoot/1.0)" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const out: Article[] = [];
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of items) {
      const raw = tag(block, "title");
      const url = tag(block, "link");
      if (!raw || !url) continue;
      const { title, source } = splitTitle(raw, tag(block, "source"));
      out.push({
        id: tag(block, "guid") || url,
        title,
        source: source || "Source",
        url,
        at: toIso(tag(block, "pubDate")),
        image: null,
      });
    }
    return out;
  } catch (err) {
    console.error(`readFeed(${q}) failed:`, err);
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
  const batches = await Promise.all(QUERIES.map((x) => readFeed(x.q)));

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
