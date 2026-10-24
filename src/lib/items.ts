import type { AppState, Item, ItemStatus, ItemType } from "@/types";

export const ITEM_TYPES: ItemType[] = ["film", "series", "anime"];

/** Series first: the couple's ritual starts with a show, then an anime. */
export const DEFAULT_LIST: ItemType = "series";

export const TYPE_LABEL: Record<ItemType, string> = {
  film: "Фильм",
  series: "Сериал",
  anime: "Аниме",
};

export const TYPE_ACCENT: Record<ItemType, string> = {
  film: "text-amber-300/90",
  series: "text-sky-300/90",
  anime: "text-violet-300/90",
};

export const TYPE_BADGE: Record<ItemType, string> = {
  film: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  series: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  anime: "border-violet-300/30 bg-violet-300/10 text-violet-200",
};

export const TYPE_GRADIENT: Record<ItemType, string> = {
  film: "from-amber-500/35 via-amber-500/10 to-transparent",
  series: "from-sky-500/35 via-sky-500/10 to-transparent",
  anime: "from-violet-500/35 via-violet-500/10 to-transparent",
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  pool: "В пуле",
  watching: "Смотрю",
  watched: "Досмотрел",
  dropped: "Бросил",
  hidden: "Скрыт",
};

export const HISTORY_STATUSES: ItemStatus[] = ["watching", "watched", "dropped"];

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isHistoryItem(item: Item): boolean {
  return item.status === "watching" || item.status === "watched" || item.status === "dropped";
}

/** How many pool entries each list holds — drives the switcher counters. */
export function countByType(items: Item[]): Record<ItemType, number> {
  const counts: Record<ItemType, number> = { film: 0, series: 0, anime: 0 };
  for (const item of items) counts[item.type] += 1;
  return counts;
}

/** First non-empty list other than `active` — the "switch to the other one" hint. */
export function nextListWithItems(items: Item[], active: ItemType): ItemType | null {
  const counts = countByType(items);
  return ITEM_TYPES.find((type) => type !== active && counts[type] > 0) ?? null;
}

export function pickUniform(list: Item[]): Item | null {
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)] ?? null;
}

/**
 * Uniform draw over the eligible pool, with one guard: the same title does not
 * win twice in a row while there is something else to pick.
 */
export function pickWinner(candidates: Item[], lastWinnerId: string | null): Item | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  const withoutLast = candidates.filter((item) => item.id !== lastWinnerId);
  return pickUniform(withoutLast.length > 0 ? withoutLast : candidates);
}

export function sortByStatusChange(items: Item[]): Item[] {
  return [...items].sort((a, b) => b.statusChangedAt - a.statusChangedAt);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function posterFallbackInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
}

export const STATE_VERSION = 1;

export const EXAMPLE_ITEMS: Array<Pick<Item, "title" | "type">> = [
  { title: "Криминальное чтиво", type: "film" },
  { title: "Очень странные дела", type: "series" },
  { title: "Атака титанов", type: "anime" },
  { title: "Интерстеллар", type: "film" },
  { title: "Чёрное зеркало", type: "series" },
  { title: "Тетрадь смерти", type: "anime" },
];

export function createEmptyState(): AppState {
  return {
    version: STATE_VERSION,
    items: [],
    settings: { sound: true, activeList: DEFAULT_LIST },
    lastWinnerId: null,
  };
}
