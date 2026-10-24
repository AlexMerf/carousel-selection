import { DEFAULT_LIST, STATE_VERSION } from "@/lib/items";
import { createSeasons } from "@/lib/seasons";
import type { AppState, Item, ItemList, ItemType, Season, SeasonState, Settings } from "@/types";

const TYPES: ItemType[] = ["film", "series", "anime"];
const LISTS: ItemList[] = ["pool", "history", "hidden"];
const STATES: SeasonState[] = ["not_aired", "not_started", "watching", "watched", "dropped"];

/** v1 kept where the position lived and how it was going in a single `status`. */
type LegacyStatus = "pool" | "watching" | "watched" | "dropped" | "hidden";

const LEGACY_STATUSES: LegacyStatus[] = ["pool", "watching", "watched", "dropped", "hidden"];

const LEGACY_LIST: Record<LegacyStatus, ItemList> = {
  pool: "pool",
  hidden: "hidden",
  watching: "history",
  watched: "history",
  dropped: "history",
};

const LEGACY_SEASON: Record<LegacyStatus, SeasonState> = {
  pool: "not_started",
  hidden: "not_started",
  watching: "watching",
  watched: "watched",
  dropped: "dropped",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asSeason(value: unknown, fallbackAt: number): Season | null {
  const record = asRecord(value);
  if (!record) return null;
  const state = STATES.includes(record.state as SeasonState)
    ? (record.state as SeasonState)
    : "not_started";
  const changedAt = typeof record.changedAt === "number" ? record.changedAt : fallbackAt;
  return { state, changedAt };
}

/**
 * One item from any schema version. v1 items carry `status` and no seasons;
 * v2 items carry `list` and `seasons`. Anything broken is repaired to a sane
 * v2 shape instead of being dropped, so a half-corrupted backup still opens.
 */
function asItem(value: unknown): Item | null {
  const record = asRecord(value);
  if (!record) return null;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;

  const type = TYPES.includes(record.type as ItemType) ? (record.type as ItemType) : "film";
  const createdAt = typeof record.createdAt === "number" ? record.createdAt : Date.now();
  const legacy: LegacyStatus = LEGACY_STATUSES.includes(record.status as LegacyStatus)
    ? (record.status as LegacyStatus)
    : "pool";
  const legacyChangedAt =
    typeof record.statusChangedAt === "number" ? record.statusChangedAt : createdAt;

  const list = LISTS.includes(record.list as ItemList)
    ? (record.list as ItemList)
    : LEGACY_LIST[legacy];

  const parsed: Season[] = Array.isArray(record.seasons)
    ? record.seasons
        .map((season) => asSeason(season, legacyChangedAt))
        .filter((season): season is Season => season !== null)
        .slice(0, 100)
    : [];

  let seasons =
    parsed.length > 0 ? parsed : createSeasons(1, LEGACY_SEASON[legacy], legacyChangedAt);
  if (type === "film") seasons = seasons.slice(0, 1);

  const statusChangedAt = Math.max(
    legacyChangedAt,
    ...seasons.map((season) => season.changedAt),
  );

  const posterUrl =
    typeof record.posterUrl === "string" && record.posterUrl.trim().length > 0
      ? record.posterUrl.trim()
      : undefined;

  return {
    id: typeof record.id === "string" && record.id ? record.id : crypto.randomUUID(),
    title,
    type,
    posterUrl,
    list,
    seasons,
    createdAt,
    statusChangedAt,
  };
}

function asSettings(value: unknown): Settings {
  const settings = asRecord(value);
  const sound = typeof settings?.sound === "boolean" ? settings.sound : true;
  const omdbKey =
    typeof settings?.omdbKey === "string" && settings.omdbKey.trim().length > 0
      ? settings.omdbKey.trim()
      : undefined;
  const activeList = TYPES.includes(settings?.activeList as ItemType)
    ? (settings?.activeList as ItemType)
    : DEFAULT_LIST;
  return { sound, omdbKey, activeList };
}

/**
 * Loads any state we have ever written (v1 `status` or v2 `list` + `seasons`)
 * into the current shape. Unknown versions are still read field by field.
 */
export function migrateState(value: unknown): AppState | null {
  const record = asRecord(value);
  if (!record) return null;

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(asItem).filter((item): item is Item => item !== null);

  return {
    version: STATE_VERSION,
    items,
    settings: asSettings(record.settings),
    lastWinnerId: typeof record.lastWinnerId === "string" ? record.lastWinnerId : null,
  };
}
