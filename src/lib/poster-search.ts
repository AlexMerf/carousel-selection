import type { ItemType } from "@/types";

export type PosterSource = "wikipedia" | "anilist" | "omdb";

export interface PosterCandidate {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  source: PosterSource;
  pageUrl?: string;
}

export interface PosterSearchReport {
  candidates: PosterCandidate[];
  errors: string[];
}

export const SOURCE_LABEL: Record<PosterSource, string> = {
  wikipedia: "Википедия",
  anilist: "AniList",
  omdb: "OMDb",
};

const RU_WIKI = "https://ru.wikipedia.org/w/api.php";
const EN_WIKI = "https://en.wikipedia.org/w/api.php";

/**
 * The word the user searches for is often the name of a book or a historical
 * figure ("Ганнибал" — the Carthaginian general, not the NBC series). Adding
 * the type word to the query is what pushes the right article to the top.
 */
const TYPE_HINT: Record<ItemType, { ru: string; en: string }> = {
  film: { ru: "фильм", en: "film" },
  series: { ru: "телесериал", en: "TV series" },
  anime: { ru: "аниме", en: "anime" },
};

const SKIP_FILE = /(logo|icon|flag|signature|commons|barnstar|symbol|\.svg)/i;
const RASTER_FILE = /\.(jpe?g|png)$/i;

/** Categories of articles about people and characters — never a poster source. */
const NOT_MEDIA =
  /(персоналии|родившиеся|умершие|вымышленн|персонажи|саундтрек|soundtrack|fictional|\bbirths\b|\bdeaths\b|people from)/i;

/** Categories of articles about a film or a series — these deserve a bonus. */
const MEDIA =
  /(фильм|телесериал|мультфильм|аниме|кино|сезон|television series|television seasons?|\bfilms?\b|animated (series|film))/i;

const FILM_CATEGORY = /(фильм|\bfilms?\b|\bmovies?\b)/i;
const SERIES_CATEGORY = /(телесериал|television series|web series|miniseries)/i;

/** A photo of a person or of a sculpture is never key art, however 2:3 it is. */
const PERSON_PICTURE =
  /(bust|sculpt|statue|engraving|gravure|гравюр|портрет|portrait|painting|monument|памятник|headshot|festival|cannes|premiere|skidmore|cast)/i;

const MAX_PAGES = 6;
const MAX_FILES_PER_PAGE = 8;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "ошибка запроса";
}

/** "Ганнибал (телесериал)" → "Ганнибал": search engines handle the bare title better. */
function bareTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title.trim();
}

function fileScore(name: string): number {
  const lower = name.toLowerCase();
  if (/(постер|poster|обложка|cover|афиш|afisha)/i.test(lower)) return 3;
  if (/\.(jpe?g)$/.test(lower)) return 2;
  if (/\.png$/.test(lower)) return 1;
  return 0;
}

/** "Denis Villeneuve 2017 crop.jpg" on the Dune article is a director photo, not key art. */
function fileMentionsTitle(file: string, terms: string[]): boolean {
  const normalized = normalizeTitle(file.replace(/\.(jpe?g|png)$/i, ""));
  if (!normalized) return false;
  return terms.some((term) => term.length >= 3 && normalized.includes(term));
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact article titles beat "actor name" pages that match the same words. */
function titleScore(queries: string[], title: string): number {
  const normalized = normalizeTitle(title);
  if (!normalized) return 0;
  let best = 0;
  for (const query of queries) {
    if (!query) continue;
    if (normalized === query) return 3;
    if (normalized.startsWith(query) || query.startsWith(normalized)) {
      best = Math.max(best, 2.5);
    } else if (normalized.includes(query)) {
      best = Math.max(best, 2);
    }
  }
  return best;
}

function scoreFile(file: string, ratio: number, terms: string[]): number {
  let score = fileScore(file) * 3;
  if (ratio >= 1.25 && ratio <= 1.85) score += 24;
  else if (ratio >= 1.1) score += 8;
  if (/(poster|постер|season|сезон|обложка|cover|title card)/i.test(file)) score += 8;
  if (fileMentionsTitle(file, terms)) score += 14;
  // A negative total drops the picture: a bust in portrait orientation would
  // otherwise outrank every real poster.
  if (PERSON_PICTURE.test(file)) score -= 60;
  return score;
}

interface WikiPage {
  pageid?: number;
  title?: string;
  images?: Array<{ title?: string }>;
  categories?: Array<{ title?: string }>;
  langlinks?: Array<{ "*"?: string }>;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    thumbwidth?: number;
    thumbheight?: number;
    width?: number;
    height?: number;
  }>;
}

interface WikiResponse {
  query?: { pages?: Record<string, WikiPage> };
  error?: { info?: string };
}

function wikiPages(data: WikiResponse): WikiPage[] {
  return Object.values(data.query?.pages ?? {});
}

async function wikiQuery(
  apiBase: string,
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<WikiResponse> {
  const response = await fetch(`${apiBase}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Википедия ответила ${response.status}`);
  return (await response.json()) as WikiResponse;
}

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: search,
    gsrlimit: "5",
    gsrnamespace: "0",
    prop: "images|categories|langlinks",
    imlimit: "40",
    cllimit: "max",
    lllang: "en",
    lllimit: "max",
  });
}

/** Plain and type-hinted searches at once; the hinted results come first. */
async function searchPages(
  apiBase: string,
  queries: string[],
  signal: AbortSignal,
): Promise<WikiPage[]> {
  const settled = await Promise.allSettled(
    queries.map((search) => wikiQuery(apiBase, searchParams(search), signal)),
  );

  const pages: WikiPage[] = [];
  const seen = new Set<string>();
  let failure: unknown = null;

  for (const result of settled) {
    if (result.status === "rejected") {
      failure ??= result.reason;
      continue;
    }
    for (const page of wikiPages(result.value)) {
      const key = page.title ?? String(page.pageid ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      pages.push(page);
    }
  }

  if (pages.length === 0 && failure && !signal.aborted) throw failure;
  return pages;
}

function categoriesOf(page: WikiPage): string[] {
  return (page.categories ?? []).map((category) => category.title ?? "");
}

/** People, characters and lists: the images there are never the poster. */
function keepMediaPages(pages: WikiPage[], type: ItemType): WikiPage[] {
  return pages.filter((page) => {
    const title = page.title ?? "";
    if (!title || /список|list of|\(franchise\)|\(франшиза\)/i.test(title)) return false;
    const categories = categoriesOf(page);
    if (categories.some((category) => NOT_MEDIA.test(category))) return false;
    // A sand dune or a band called "Дюна" is not the film the user is adding.
    if (type !== "anime" && !categories.some((category) => MEDIA.test(category))) return false;
    // The user said "series", so a film article is about a different work.
    const film = categories.some((category) => FILM_CATEGORY.test(category));
    const series = categories.some((category) => SERIES_CATEGORY.test(category));
    if (type === "series" && film && !series) return false;
    if (type === "film" && series && !film) return false;
    return true;
  });
}

function isMediaPage(page: WikiPage): boolean {
  return categoriesOf(page).some((category) => MEDIA.test(category));
}

/** Pages whose title is the searched title — a page that merely mentions it is not. */
function matchingPages(pages: WikiPage[], queries: string[]): WikiPage[] {
  const normalizedQueries = queries.map(normalizeTitle).filter(Boolean);
  return pages.filter((page) => titleScore(normalizedQueries, page.title ?? "") > 0);
}

function englishTitles(pages: WikiPage[]): string[] {
  return unique(
    pages.flatMap((page) => (page.langlinks ?? []).map((link) => link["*"] ?? "")),
  );
}

async function wikiCandidates(
  apiBase: string,
  pages: WikiPage[],
  queries: string[],
  signal: AbortSignal,
): Promise<PosterCandidate[]> {
  const normalizedQueries = queries.map(normalizeTitle).filter(Boolean);
  const entries: Array<{ title: string; media: boolean; files: string[] }> = [];

  for (const page of pages.slice(0, MAX_PAGES)) {
    const title = page.title ?? "";
    if (!title) continue;
    const files = (page.images ?? [])
      .map((image) => image.title ?? "")
      .filter((file) => file && !SKIP_FILE.test(file) && RASTER_FILE.test(file))
      .sort((a, b) => fileScore(b) - fileScore(a))
      .slice(0, MAX_FILES_PER_PAGE);
    if (files.length > 0) entries.push({ title, media: isMediaPage(page), files });
  }

  if (entries.length === 0) return [];

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: entries.flatMap((entry) => entry.files).join("|"),
    prop: "imageinfo",
    iiprop: "url|size",
    iiurlwidth: "420",
  });
  const infoData = await wikiQuery(apiBase, params, signal);

  const byFile = new Map<string, { url: string; ratio: number }>();
  for (const page of wikiPages(infoData)) {
    const file = page.title ?? "";
    const infoEntry = page.imageinfo?.[0];
    const rawUrl = infoEntry?.thumburl ?? infoEntry?.url;
    if (!file || !rawUrl) continue;
    const width =
      typeof infoEntry?.thumbwidth === "number" ? infoEntry.thumbwidth : infoEntry?.width;
    const height =
      typeof infoEntry?.thumbheight === "number" ? infoEntry.thumbheight : infoEntry?.height;
    const ratio = width && height ? height / width : 0;
    byFile.set(file, { url: rawUrl.split("?")[0] ?? rawUrl, ratio });
  }

  const scored: Array<{ file: string; page: string; score: number }> = [];
  for (const entry of entries) {
    let best: { file: string; score: number } | null = null;
    for (const file of entry.files) {
      const info = byFile.get(file);
      if (!info) continue;
      const score = scoreFile(file, info.ratio, normalizedQueries);
      if (!best || score > best.score) best = { file, score };
    }
    // Negative score means the best image on the page is a person photo, not artwork.
    if (!best || best.score <= 0) continue;
    // An article that only mentions the title in its text ("Команда-А" mentions
    // Ганнибал Smith) is not the article about this title: the poster there is
    // some other film's key art.
    const relevance = titleScore(normalizedQueries, entry.title);
    if (relevance === 0) continue;
    const mediaBonus = entry.media ? 12 : 0;
    scored.push({
      file: best.file,
      page: entry.title,
      score: relevance * 10 + mediaBonus + best.score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const host = apiBase.includes("ru.wikipedia") ? "ru.wikipedia.org" : "en.wikipedia.org";

  return scored.slice(0, 4).flatMap((pick) => {
    const info = byFile.get(pick.file);
    if (!info) return [];
    return [
      {
        id: `wiki:${pick.file}`,
        title: pick.page,
        subtitle: pick.file.replace(/^Файл:|^File:/, ""),
        imageUrl: info.url,
        source: "wikipedia" as const,
        pageUrl: `https://${host}/wiki/${encodeURIComponent(pick.page.replace(/ /g, "_"))}`,
      },
    ];
  });
}

interface WikipediaResult {
  candidates: PosterCandidate[];
  /** Original title from the article's English version — used for the OMDb query. */
  englishTitle?: string;
}

async function fetchWikipedia(
  query: string,
  type: ItemType,
  signal: AbortSignal,
): Promise<WikipediaResult> {
  const ruQueries = unique([`${bareTitle(query)} ${TYPE_HINT[type].ru}`, query]);
  const ruPages = keepMediaPages(await searchPages(RU_WIKI, ruQueries, signal), type);
  const english = englishTitles(matchingPages(ruPages, ruQueries)).slice(0, 2);
  const englishTitle = english[0] ? bareTitle(english[0]) : undefined;

  const ruTask = wikiCandidates(RU_WIKI, ruPages, ruQueries, signal);
  // Russian Wikipedia does not host non-free posters, so the article about the
  // same title in English is the source that actually has one.
  const enTask = (async () => {
    if (!english[0]) return [];
    const enQueries = unique([`${bareTitle(english[0])} ${TYPE_HINT[type].en}`, ...english]);
    const enPages = keepMediaPages(await searchPages(EN_WIKI, enQueries, signal), type);
    return wikiCandidates(EN_WIKI, enPages, enQueries, signal);
  })();

  const settled = await Promise.allSettled([ruTask, enTask]);
  const candidates = settled.flatMap((part) => (part.status === "fulfilled" ? part.value : []));
  if (candidates.length === 0) {
    const failed = settled.find(
      (part): part is PromiseRejectedResult => part.status === "rejected",
    );
    if (failed && !signal.aborted) throw failed.reason;
  }

  return { candidates, englishTitle };
}

interface AniListMedia {
  id?: number;
  title?: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
  siteUrl?: string;
  startDate?: { year?: number };
}

interface AniListResponse {
  data?: { Page?: { media?: AniListMedia[] } };
  errors?: Array<{ message?: string }>;
}

const ANILIST_QUERY = `
  query ($search: String) {
    Page(perPage: 6) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { large extraLarge }
        siteUrl
        startDate { year }
      }
    }
  }
`;

async function fetchAniList(query: string, signal: AbortSignal): Promise<PosterCandidate[]> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: query } }),
    signal,
  });
  if (!response.ok) throw new Error(`AniList ответил ${response.status}`);
  const data = (await response.json()) as AniListResponse;
  const media = data.data?.Page?.media ?? [];
  return media.flatMap((entry) => {
    const imageUrl = entry.coverImage?.extraLarge ?? entry.coverImage?.large;
    if (!imageUrl) return [];
    const title = entry.title?.native || entry.title?.romaji || entry.title?.english || "Без названия";
    const year = entry.startDate?.year;
    return [
      {
        id: `anilist:${entry.id ?? imageUrl}`,
        title,
        subtitle: [entry.title?.romaji, year ? String(year) : ""].filter(Boolean).join(" · "),
        imageUrl,
        source: "anilist" as const,
        pageUrl: entry.siteUrl,
      },
    ];
  });
}

interface OmdbSearchItem {
  Title?: string;
  Year?: string;
  imdbID?: string;
  Type?: string;
  Poster?: string;
}

interface OmdbResponse {
  Response?: string;
  Search?: OmdbSearchItem[];
  Error?: string;
  totalResults?: string;
}

async function fetchOmdb(
  query: string,
  type: ItemType,
  key: string,
  signal: AbortSignal,
): Promise<PosterCandidate[]> {
  const params = new URLSearchParams({
    apikey: key.trim(),
    s: query,
    type: type === "series" ? "series" : "movie",
    page: "1",
  });
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { signal });
  const data = (await response.json()) as OmdbResponse;
  if (data.Response !== "True") {
    // "Movie not found!" is a normal empty answer — only real problems are errors.
    if (/not found/i.test(data.Error ?? "")) return [];
    throw new Error(data.Error ?? "OMDb не ответил");
  }
  return (data.Search ?? []).flatMap((item) => {
    const poster = item.Poster;
    if (!poster || poster === "N/A") return [];
    return [
      {
        id: `omdb:${item.imdbID ?? poster}`,
        title: item.Title ?? "Без названия",
        subtitle: item.Year,
        imageUrl: poster,
        source: "omdb" as const,
        pageUrl: item.imdbID ? `https://www.imdb.com/title/${item.imdbID}/` : undefined,
      },
    ];
  });
}

function dedupe(candidates: PosterCandidate[]): PosterCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.imageUrl)) return false;
    seen.add(candidate.imageUrl);
    return true;
  });
}

/**
 * Looks for poster candidates in every source that can answer:
 * ru/en Wikipedia for any title, AniList for anime, OMDb when the user added a key.
 * A source that fails (no key, blocked, empty) never fails the whole search.
 */
export async function findPosters(options: {
  query: string;
  type: ItemType;
  omdbKey?: string;
  signal: AbortSignal;
}): Promise<PosterSearchReport> {
  const { query, type, omdbKey, signal } = options;
  const trimmed = query.trim();
  if (!trimmed) return { candidates: [], errors: [] };

  const errors: string[] = [];
  const buckets: Record<PosterSource, PosterCandidate[]> = {
    wikipedia: [],
    anilist: [],
    omdb: [],
  };

  const [wiki, anilist] = await Promise.allSettled([
    fetchWikipedia(trimmed, type, signal),
    type === "anime" ? fetchAniList(trimmed, signal) : Promise.resolve<PosterCandidate[]>([]),
  ]);

  if (wiki.status === "fulfilled") {
    buckets.wikipedia = wiki.value.candidates;
  } else if (!signal.aborted) {
    errors.push(`Википедия: ${describeError(wiki.reason)}`);
  }

  if (anilist.status === "fulfilled") {
    buckets.anilist = anilist.value;
  } else if (!signal.aborted) {
    errors.push(`AniList: ${describeError(anilist.reason)}`);
  }

  // OMDb only knows original titles, so it waits for the English one.
  const englishTitle = wiki.status === "fulfilled" ? wiki.value.englishTitle : undefined;
  if (omdbKey?.trim() && !signal.aborted) {
    try {
      buckets.omdb = await fetchOmdb(englishTitle ?? trimmed, type, omdbKey, signal);
    } catch (error) {
      if (!signal.aborted) errors.push(`OMDb: ${describeError(error)}`);
    }
  }

  // OMDb wins when the key works: it is the only source that knows the exact title.
  const order: PosterSource[] =
    type === "anime" ? ["anilist", "omdb", "wikipedia"] : ["omdb", "wikipedia", "anilist"];
  let candidates: PosterCandidate[] = order.flatMap((source) => buckets[source]);

  if (candidates.length === 0 && !signal.aborted) {
    try {
      const queries = unique([`${bareTitle(trimmed)} ${TYPE_HINT[type].en}`, trimmed]);
      const pages = keepMediaPages(await searchPages(EN_WIKI, queries, signal), type);
      candidates = await wikiCandidates(EN_WIKI, pages, queries, signal);
    } catch (error) {
      if (!signal.aborted) errors.push(`Википедия (en): ${describeError(error)}`);
    }
  }

  return { candidates: dedupe(candidates).slice(0, 12), errors };
}
