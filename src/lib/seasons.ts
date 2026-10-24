import type { Item, ItemList, Season, SeasonState } from "@/types";

export const SEASON_STATES: SeasonState[] = [
  "not_aired",
  "not_started",
  "watching",
  "watched",
  "dropped",
];

export const SEASON_LABEL: Record<SeasonState, string> = {
  not_aired: "Не вышел",
  not_started: "Не смотрел",
  watching: "Смотрю",
  watched: "Смотрел",
  dropped: "Бросил",
};

export const SEASON_STYLE: Record<SeasonState, string> = {
  not_aired: "border-white/15 bg-white/5 text-muted-foreground",
  not_started: "border-white/15 bg-white/5 text-muted-foreground",
  watching: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  watched: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  dropped: "border-rose-300/30 bg-rose-300/10 text-rose-200",
};

/** Title-level verdict derived from the seasons — never stored in the state. */
export type TitleStatus = "not_started" | "watching" | "watched" | "dropped";

export const TITLE_STATUS_LABEL: Record<TitleStatus, string> = {
  not_started: "Не начат",
  watching: "Смотрю",
  watched: "Досмотрел",
  dropped: "Бросил",
};

export const TITLE_STATUS_STYLE: Record<TitleStatus, string> = {
  not_started: "border-white/15 bg-white/5 text-muted-foreground",
  watching: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  watched: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  dropped: "border-rose-300/30 bg-rose-300/10 text-rose-200",
};

/** Films have one implicit season; only series and anime show season numbers. */
export function hasSeasons(item: Item): boolean {
  return item.type !== "film";
}

export function isReleased(season: Season): boolean {
  return season.state !== "not_aired";
}

export function releasedSeasons(item: Item): Season[] {
  return item.seasons.filter(isReleased);
}

/**
 * Title status, derived in this order:
 * 1. a season is being watched            → «Смотрю»
 * 2. nothing released yet                 → «Не начат»
 * 3. every released season is watched     → «Досмотрел»
 * 4. a released season is not started yet → «Бросил» if the title was dropped,
 *    otherwise «Смотрю» (there is something to continue with)
 * 5. everything released is closed        → «Бросил»
 */
export function titleStatus(item: Item): TitleStatus {
  const released = releasedSeasons(item);
  if (released.length === 0) return "not_started";
  if (released.some((season) => season.state === "watching")) return "watching";
  if (released.every((season) => season.state === "watched")) return "watched";

  const pending = released.some((season) => season.state === "not_started");
  if (pending) {
    // A dropped show must not silently turn into "watching" when a new season airs.
    return released.some((season) => season.state === "dropped") ? "dropped" : "watching";
  }
  return "dropped";
}

/** Index of the season the couple is on: the one being watched, else the first unwatched. */
export function currentSeasonIndex(item: Item): number {
  const watching = item.seasons.findIndex((season) => season.state === "watching");
  if (watching >= 0) return watching;
  return item.seasons.findIndex((season) => season.state === "not_started");
}

/** Something in this title can still be watched right now. */
export function hasPendingSeason(item: Item): boolean {
  return item.seasons.some(
    (season) => season.state === "not_started" || season.state === "watching",
  );
}

/** The wheel only draws titles with something to watch, everything else is dead weight. */
export function isWatchable(item: Item): boolean {
  return hasPendingSeason(item);
}

/** `S2/4` — the season to continue with out of the released ones. `null` for films. */
export function seasonBadge(item: Item): string | null {
  if (!hasSeasons(item)) return null;
  const released = releasedSeasons(item).length;
  if (released === 0) return null;
  const index = currentSeasonIndex(item);
  return `S${index >= 0 ? index + 1 : released}/${released}`;
}

/** A dropped title that got a new season: the history shows a nudge, no auto-moves. */
export function upcomingSeasonNumber(item: Item): number | null {
  if (titleStatus(item) !== "dropped") return null;
  const index = item.seasons.findIndex((season) => isReleased(season) && season.state === "not_started");
  return index >= 0 ? index + 1 : null;
}

export function createSeasons(count = 1, state: SeasonState = "not_started", now = Date.now()): Season[] {
  const safe = Number.isFinite(count) ? Math.min(100, Math.max(1, Math.floor(count))) : 1;
  return Array.from({ length: safe }, () => ({ state, changedAt: now }));
}

/**
 * Whatever comes back from the editor: at least one season, never more than
 * 100, and a film always holds exactly one (its UI has no season list).
 */
export function normalizeSeasons(type: Item["type"], parsed: Season[]): Season[] {
  const list = parsed.length > 0 ? parsed.slice(0, 100) : createSeasons(1);
  return type === "film" ? list.slice(0, 1) : list;
}

export function touchSeason(item: Item, seasons: Season[], now = Date.now()): Item {
  return { ...item, seasons, statusChangedAt: now };
}

export function moveToList(item: Item, list: ItemList, now = Date.now()): Item {
  return { ...item, list, statusChangedAt: now };
}

export function setSeasonState(
  item: Item,
  index: number,
  state: SeasonState,
  now = Date.now(),
): Item {
  if (index < 0 || index >= item.seasons.length) return item;
  const seasons = item.seasons.map((season, i) => (i === index ? { state, changedAt: now } : season));
  return touchSeason(item, seasons, now);
}

/** «Уже смотрел»: every released season is watched, announced ones stay untouched. */
export function markAllWatched(item: Item, now = Date.now()): Item {
  const seasons = item.seasons.map((season) =>
    isReleased(season) ? { state: "watched" as const, changedAt: now } : season,
  );
  return { ...touchSeason(item, seasons, now), list: "history" };
}

/** «Смотрю» after the spin: the current season starts playing, the title moves to history. */
export function startWatching(item: Item, now = Date.now()): Item {
  const index = currentSeasonIndex(item);
  if (index < 0) return item;
  return { ...setSeasonState(item, index, "watching", now), list: "history" };
}

/** «Бросил»: the season being watched (or the last one) is dropped. */
export function dropSeason(item: Item, now = Date.now()): Item {
  const current = currentSeasonIndex(item);
  const target = current >= 0 ? current : item.seasons.length - 1;
  if (target < 0) return moveToList(item, "history", now);
  return { ...setSeasonState(item, target, "dropped", now), list: "history" };
}

export function addSeason(item: Item, state: SeasonState = "not_aired", now = Date.now()): Item {
  if (!hasSeasons(item) || item.seasons.length >= 100) return item;
  return touchSeason(item, [...item.seasons, { state, changedAt: now }], now);
}

/** Removing a season renumbers the rest — the number is the index, not data. */
export function removeSeason(item: Item, index: number, now = Date.now()): Item {
  if (index < 0 || index >= item.seasons.length) return item;
  if (item.seasons.length <= 1) return item;
  const seasons = item.seasons.filter((_, i) => i !== index);
  return touchSeason(item, seasons, now);
}

/** A season with real progress needs a confirmation before it can be deleted. */
export function seasonHasProgress(season: Season): boolean {
  return season.state === "watching" || season.state === "watched" || season.state === "dropped";
}
