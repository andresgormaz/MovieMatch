import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { computeMergedPreferences, getTasteKeywords, type TasteKeyword } from "@/lib/preferenceCounts";

// A handful of movie/series news RSS feeds -- mixes English trade press with
// a Spanish-language outlet since our users read es-LatAm. Each entry is
// fetched independently (see refreshNewsIfStale) so one dead/renamed feed
// never blocks the others.
export const NEWS_SOURCES: { name: string; url: string }[] = [
  { name: "Variety", url: "https://variety.com/feed/" },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/" },
  { name: "IndieWire", url: "https://www.indiewire.com/feed/" },
  { name: "/Film", url: "https://www.slashfilm.com/feed/" },
  { name: "Espinof", url: "https://www.espinof.com/feed" },
];

const NEWS_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2h -- plenty fresh for a personal app, cheap on the feeds
const NEWS_RETENTION_DAYS = 21;
const FEED_TIMEOUT_MS = 8000;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#text",
  trimValues: true,
});

export interface ParsedArticle {
  title: string;
  link: string;
  summary: string;
  imageUrl: string | null;
  publishedAt: Date;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// fast-xml-parser's exact output shape for a text node varies with feed
// quirks (plain string, {#text: "..."} , an attribute-holder object) --
// this pulls a plain string out of whichever shape shows up instead of
// assuming one.
function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).find(Boolean) ?? "";
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"].trim();
    if (typeof obj["@_href"] === "string") return obj["@_href"].trim(); // Atom <link href="..."/>
    if (typeof obj["@_url"] === "string") return obj["@_url"].trim(); // RSS <enclosure url="..."/>
    return "";
  }
  return "";
}

// Named entities beyond the XML-standard 5 (those plus &#NNNN;/&#xNNNN; are
// handled generically below) -- curly quotes, dashes, and ellipses show up
// constantly in real headlines ("It’s", em dashes, "...") and were rendering
// as literal "&#8217;" etc. before this decoded them.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code[0] === "#") {
      const isHex = code[1] === "x" || code[1] === "X";
      const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractLink(item: Record<string, unknown>): string {
  const raw = item.link;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    // Atom feeds can list several <link> entries -- prefer rel="alternate"
    // (the actual article page) over other relations like "self".
    const alternate = raw.find((l) => {
      const obj = l as Record<string, unknown>;
      return typeof obj === "object" && (obj["@_rel"] === "alternate" || !("@_rel" in obj));
    });
    return textOf(alternate ?? raw[0]);
  }
  return textOf(raw);
}

function extractImage(item: Record<string, unknown>, rawSummaryHtml: string): string | null {
  const media = textOf(item["media:thumbnail"]) || textOf(item["media:content"]);
  if (media) return media;
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (enclosure) {
    const type = String(enclosure["@_type"] ?? "");
    const url = String(enclosure["@_url"] ?? "");
    if (url && (!type || type.startsWith("image"))) return url;
  }
  const imgMatch = rawSummaryHtml.match(/<img[^>]+src="([^"]+)"/i);
  return imgMatch?.[1] ?? null;
}

// Parses either RSS 2.0 (<rss><channel><item>) or Atom (<feed><entry>) --
// different outlets use either, and there's no way to know which ahead of
// time without fetching first.
export function parseFeedXml(xml: string): ParsedArticle[] {
  const doc = xmlParser.parse(xml);
  const items: Record<string, unknown>[] = doc?.rss?.channel ? asArray(doc.rss.channel.item) : asArray(doc?.feed?.entry);

  const articles: ParsedArticle[] = [];
  for (const item of items) {
    const title = stripHtml(textOf(item.title));
    const link = extractLink(item);
    if (!title || !link) continue;

    const rawSummary = textOf(item["content:encoded"]) || textOf(item.description) || textOf(item.summary) || textOf(item.content);
    const dateRaw = textOf(item.pubDate) || textOf(item.published) || textOf(item.updated) || textOf(item["dc:date"]);
    const publishedAt = dateRaw ? new Date(dateRaw) : new Date();

    articles.push({
      title,
      link,
      summary: stripHtml(rawSummary).slice(0, 240),
      imageUrl: extractImage(item, rawSummary),
      publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    });
  }
  return articles;
}

// Refetches every feed and upserts into NewsArticle, but only when the
// cache is actually stale -- most /news page loads just read what's
// already there, no network involved. Per-feed failures (a renamed URL, a
// timeout) are swallowed independently via allSettled so one bad source
// never empties out the rest.
export async function refreshNewsIfStale(): Promise<void> {
  const latest = await prisma.newsArticle.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
  if (latest && Date.now() - latest.fetchedAt.getTime() < NEWS_REFRESH_INTERVAL_MS) return;

  const results = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "MovieMatchBot/1.0 (personal use, not a crawler)" },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${source.name} -> ${res.status}`);
      const xml = await res.text();
      return parseFeedXml(xml).map((a) => ({ ...a, source: source.name }));
    }),
  );

  const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  await Promise.all(
    articles.map((a) =>
      prisma.newsArticle.upsert({
        where: { link: a.link },
        update: { title: a.title, summary: a.summary, imageUrl: a.imageUrl, publishedAt: a.publishedAt, source: a.source, fetchedAt: new Date() },
        create: { title: a.title, link: a.link, summary: a.summary, imageUrl: a.imageUrl, publishedAt: a.publishedAt, source: a.source },
      }),
    ),
  );

  await prisma.newsArticle.deleteMany({
    where: { publishedAt: { lt: new Date(Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
  });
}

const MIN_KEYWORD_LENGTH = 3;
const TOP_LOVED_TITLES = 40;

// This user's positive taste signal, reduced to a flat list of names to
// match article text against: getTasteKeywords' actors/directors/genres,
// plus titles they rated 4-5 stars by name (so news about a sequel/spinoff
// of something they loved still surfaces) -- the title part only makes
// sense here, not in the shared getTasteKeywords helper.
async function buildUserNewsKeywords(userId: string, useOriginalTitles: boolean): Promise<TasteKeyword[]> {
  const prefs = await computeMergedPreferences(userId, useOriginalTitles);
  const [tasteKeywords, lovedTitles] = await Promise.all([
    getTasteKeywords(prefs),
    prisma.userTitleRating.findMany({
      where: { userId, seen: true, score: { gte: 4 } },
      include: { title: { select: { name: true, originalName: true } } },
      orderBy: { ratedAt: "desc" },
      take: TOP_LOVED_TITLES,
    }),
  ]);

  const keywords: TasteKeyword[] = [...tasteKeywords];
  for (const r of lovedTitles) {
    const name = useOriginalTitles && r.title.originalName ? r.title.originalName : r.title.name;
    keywords.push({ name, weight: r.score ?? 4 });
  }

  return keywords.filter((k) => k.name.trim().length >= MIN_KEYWORD_LENGTH && k.weight > 0);
}

function scoreArticleRelevance(text: string, keywords: TasteKeyword[]): { score: number; matched: string[] } {
  const haystack = text.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const kw of keywords) {
    if (haystack.includes(kw.name.toLowerCase())) {
      score += kw.weight;
      matched.push(kw.name);
    }
  }
  return { score, matched };
}

export interface NewsListItem {
  id: string;
  source: string;
  title: string;
  link: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  relevant: boolean;
  matched: string[];
}

const NEWS_POOL_SIZE = 150;
const NEWS_PAGE_SIZE = 60;

// Relevant-first, then chronological -- computed fresh per request instead
// of stored, so it can never go stale the way a precomputed flag would.
export async function getNewsForUser(userId: string, useOriginalTitles: boolean): Promise<NewsListItem[]> {
  const [keywords, articles] = await Promise.all([
    buildUserNewsKeywords(userId, useOriginalTitles),
    prisma.newsArticle.findMany({ orderBy: { publishedAt: "desc" }, take: NEWS_POOL_SIZE }),
  ]);

  const scored = articles.map((a) => {
    const { score, matched } = scoreArticleRelevance(`${a.title} ${a.summary ?? ""}`, keywords);
    return { article: a, score, matched: [...new Set(matched)] };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.article.publishedAt.getTime() - a.article.publishedAt.getTime();
  });

  return scored.slice(0, NEWS_PAGE_SIZE).map(({ article, score, matched }) => ({
    id: article.id,
    source: article.source,
    title: article.title,
    link: article.link,
    summary: article.summary,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
    relevant: score > 0,
    matched: matched.slice(0, 4),
  }));
}
