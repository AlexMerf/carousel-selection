import { createEmptyState } from "@/lib/items";
import { migrateState } from "@/lib/migrate";
import type { AppState } from "@/types";

/** Key stays `kinokoltso.v1` on purpose: renaming it would orphan everyone's data. */
const STORAGE_KEY = "kinokoltso.v1";

export { migrateState };

export function loadState(): AppState {
  if (typeof window === "undefined") return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    return migrateState(JSON.parse(raw)) ?? createEmptyState();
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
        const state = migrateState(parsed);
        if (!state) reject(new Error("Файл не похож на резервную копию «Саша + Лера»"));
        else resolve(state);
      } catch {
        reject(new Error("Файл повреждён или это не JSON"));
      }
    };
    reader.readAsText(file);
  });
}
