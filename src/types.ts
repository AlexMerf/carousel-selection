export type ItemType = "film" | "series" | "anime";

/** Where a position lives. Watch progress lives in `seasons`, not here. */
export type ItemList = "pool" | "history" | "hidden";

/**
 * Progress of one season. `not_aired` means the season exists but has not
 * been released yet — that is the whole point of the field: "we haven't
 * watched S3" and "S3 does not exist yet" must not look the same.
 */
export type SeasonState = "not_aired" | "not_started" | "watching" | "watched" | "dropped";

export interface Season {
  state: SeasonState;
  /** When this season's state last changed — the history sorts by the max. */
  changedAt: number;
}

export interface Item {
  id: string;
  title: string;
  type: ItemType;
  posterUrl?: string;
  list: ItemList;
  /** One entry per season, in order; the season number is the index + 1. */
  seasons: Season[];
  createdAt: number;
  /** Last change of the position: the latest season change or list move. */
  statusChangedAt: number;
}

export interface Settings {
  sound: boolean;
  omdbKey?: string;
  /** Which list (by item type) the wheel draws from and the pool shows. */
  activeList: ItemType;
}

export interface AppState {
  version: number;
  items: Item[];
  settings: Settings;
  lastWinnerId: string | null;
}

export type TabId = "wheel" | "pool" | "history" | "hidden";
