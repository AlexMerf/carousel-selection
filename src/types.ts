export type ItemType = "film" | "series" | "anime";

export type ItemStatus = "pool" | "watching" | "watched" | "dropped" | "hidden";

export interface Item {
  id: string;
  title: string;
  type: ItemType;
  posterUrl?: string;
  status: ItemStatus;
  createdAt: number;
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
