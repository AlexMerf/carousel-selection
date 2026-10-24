import { createEmptyState, STATE_VERSION } from "@/lib/items";
import type { AppState, Item, ItemStatus, ItemType } from "@/types";

const STORAGE_KEY = "kinokoltso.v1";

const TYPES: ItemType[] = ["film", "series", "anime"];
const STATUSES: ItemStatus[] = ["pool", "watching", "watched", "dropped", "hidden"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asItem(value: unknown): Item | null {
  const record = asRecord(value);
  if (!record) return null;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;

  const type = TYPES.includes(record.type as ItemType) ? (record.type as ItemType) : "film";
  const status = STATUSES.includes(record.status as ItemStatus)
    ? (record.status as ItemStatus)
    : "pool";

  const createdAt = typeof record.createdAt === "number" ? record.createdAt : Date.now();
  const statusChangedAt =
    typeof record.statusChangedAt === "number" ? record.statusChangedAt : createdAt;

  const posterUrl =
    typeof record.posterUrl === "string" && record.posterUrl.trim().length > 0
      ? record.posterUrl.trim()
      : undefined;

  return {
    id: typeof record.id === "string" && record.id ? record.id : crypto.randomUUID(),
    title,
    type,
    posterUrl,
    status,
    createdAt,
    statusChangedAt,
  };
}

export function normalizeState(value: unknown): AppState | null {
  const record = asRecord(value);
  if (!record) return null;

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(asItem).filter((item): item is Item => item !== null);

  const settings = asRecord(record.settings);
  const sound = typeof settings?.sound === "boolean" ? settings.sound : true;

  return {
    version: STATE_VERSION,
    items,
    settings: { sound },
    lastWinnerId: typeof record.lastWinnerId === "string" ? record.lastWinnerId : null,
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    return normalizeState(JSON.parse(raw)) ?? createEmptyState();
  } catch {
    return createEmptyState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or disabled; the app keeps working in memory.
  }
}

export function exportStateFile(state: AppState): void {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `kinokoltso-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readStateFile(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const state = normalizeState(parsed);
        if (!state) reject(new Error("Файл не похож на резервную копию Кинокольца"));
        else resolve(state);
      } catch {
        reject(new Error("Файл повреждён или это не JSON"));
      }
    };
    reader.readAsText(file);
  });
}
