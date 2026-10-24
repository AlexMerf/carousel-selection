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

const SKIP_FILE = /(logo|icon|flag|signature|commons|barnstar|symbol|\.svg)/i;
const RASTER_FILE = /\.(jpe?g|png)$/i;

function fileScore(name: string): number {
  const lower = name.toLowerCase();
  if (/(постер|poster|обложка|cover|афиш|afisha)/i.test(lower)) return 3;
  if (/\.(jpe?g)$/.test(lower)) return 2;
  if (/\.png$/.test(lower)) return 1;
  return 0;
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
function titleScore(query: string, title: string): number {
  if (!query) return 0;
  const normalized = normalizeTitle(title);
  if (!normalized) return 0;
  if (normalized === query) return 3;
  if (normalized.startsWith(query) || query.startsWith(normalized)) return 2.5;
  if (normalized.includes(query)) return 2;
  return 0;
}

interface WikiPage {
  pageid?: number;
  title?: string;
  images?: Array<{ title?: string }>;
  imageinfo?: Array<{ thumburl?: string; url?: string }>;
}

interface WikiResponse {
  query?: { pages?: Record<string, WikiPage> };
  error?: { info?: string };
}

function wikiPages(data: WikiResponse): WikiPage[] {
  return Object.values(data.query?.pages ?? {});
}

async function fetchWiki(apiBase: string, query: string, signal: AbortSignal): Promise<PosterCandidate[]> {
  const search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    gsrnamespace: "0",
    prop: "images",
    imlimit: "40",
  });

  const searchResponse = await fetch(`${apiBase}?${search.toString()}`, { signal });
  if (!searchResponse.ok) throw new Error(`Википедия ответила ${searchResponse.status}`);
  const searchData = (await searchResponse.json()) as WikiResponse;

  const normalizedQuery = normalizeTitle(query);
  const picks: Array<{ file: string; page: string; score: number }> = [];
  for (const page of wikiPages(searchData)) {
    const title = page.title ?? "";
    if (/список|list of|сезон \d|season \d/i.test(title)) continue;
    const files = (page.images ?? [])
      .map((image) => image.title ?? "")
      .filter((file) => file && !SKIP_FILE.test(file) && RASTER_FILE.test(file))
      .sort((a, b) => fileScore(b) - fileScore(a));
    const best = files[0];
    if (!best) continue;
    picks.push({
      file: best,
      page: title,
      score: titleScore(normalizedQuery, title) * 10 + fileScore(best),
    });
  }

  picks.sort((a, b) => b.score - a.score);
  const top = picks.slice(0, 4);

  if (top.length === 0) return [];

  const info = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: top.map((pick) => pick.file).join("|"),
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "420",
  });

  const infoResponse = await fetch(`${apiBase}?${info.toString()}`, { signal });
  if (!infoResponse.ok) throw new Error(`Википедия ответила ${infoResponse.status}`);
  const infoData = (await infoResponse.json()) as WikiResponse;

  const byFile = new Map<string, string>();
  for (const page of wikiPages(infoData)) {
    const file = page.title ?? "";
    const url = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url;
    if (file && url) byFile.set(file, url);
  }

  const host = apiBase.includes("ru.wikipedia") ? "ru.wikipedia.org" : "en.wikipedia.org";
  return top.flatMap((pick) => {
    const rawUrl = byFile.get(pick.file);
    if (!rawUrl) return [];
    const imageUrl = rawUrl.split("?")[0] ?? rawUrl;
    return [
      {
        id: `wiki:${pick.file}`,
        title: pick.page,
        subtitle: pick.file.replace(/^Файл:|^File:/, ""),
        imageUrl,
        source: "wikipedia" as const,
        pageUrl: `https://${host}/wiki/${encodeURIComponent(pick.page.replace(/ /g, "_"))}`,
      },
    ];
  });
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
 * ru-wiki for Russian titles, AniList for anime, OMDb when the user added a key.
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
  const tasks: Array<{ label: string; source: PosterSource; run: () => Promise<PosterCandidate[]> }> =
    [];

  tasks.push({
    label: "Википедия",
    source: "wikipedia",
    run: () => fetchWiki("https://ru.wikipedia.org/w/api.php", trimmed, signal),
  });

  if (type === "anime") {
    tasks.push({ label: "AniList", source: "anilist", run: () => fetchAniList(trimmed, signal) });
  }

  if (omdbKey && omdbKey.trim()) {
    tasks.push({
      label: "OMDb",
      source: "omdb",
      run: () => fetchOmdb(trimmed, type, omdbKey, signal),
    });
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));
  const buckets: Record<PosterSource, PosterCandidate[]> = {
    wikipedia: [],
    anilist: [],
    omdb: [],
  };

  settled.forEach((result, index) => {
    const task = tasks[index];
    if (!task) return;
    if (result.status === "fulfilled") {
      buckets[task.source].push(...result.value);
    } else if (!signal.aborted) {
      const reason = result.reason instanceof Error ? result.reason.message : "ошибка запроса";
      errors.push(`${task.label}: ${reason}`);
    }
  });

  // Anime covers are far better on AniList, while ru-wiki wins for Russian film titles.
  const order: PosterSource[] =
    type === "anime" ? ["anilist", "wikipedia", "omdb"] : ["wikipedia", "anilist", "omdb"];
  let candidates: PosterCandidate[] = order.flatMap((source) => buckets[source]);

  if (candidates.length === 0 && !signal.aborted) {
    try {
      candidates = await fetchWiki("https://en.wikipedia.org/w/api.php", trimmed, signal);
    } catch (error) {
      if (!signal.aborted) {
        errors.push(`Википедия (en): ${error instanceof Error ? error.message : "ошибка запроса"}`);
      }
    }
  }

  return { candidates: dedupe(candidates).slice(0, 12), errors };
}
