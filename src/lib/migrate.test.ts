import { describe, expect, it } from "vitest";

import { migrateState } from "@/lib/migrate";
import { STATE_VERSION } from "@/lib/items";

const legacy = (over: Record<string, unknown> = {}) => ({
  id: "a",
  title: "Монолог Фармацевта",
  type: "series",
  status: "watched",
  createdAt: 10,
  statusChangedAt: 20,
  ...over,
});

const wrap = (items: unknown[]) => ({
  version: 1,
  items,
  settings: { sound: false, activeList: "anime" },
  lastWinnerId: "a",
});

describe("migrateState: v1 → v2", () => {
  it("maps a watched series into history with one watched season", () => {
    const state = migrateState(wrap([legacy()]));
    expect(state).not.toBeNull();
    const item = state!.items[0]!;
    expect(item.list).toBe("history");
    expect(item.seasons).toEqual([{ state: "watched", changedAt: 20 }]);
    expect(item.statusChangedAt).toBe(20);
    expect(item.createdAt).toBe(10);
  });

  it("does not keep the legacy status field", () => {
    const item = migrateState(wrap([legacy()]))!.items[0]!;
    expect("status" in item).toBe(false);
  });

  it("maps every legacy status", () => {
    const cases = [
      ["pool", "pool", "not_started"],
      ["hidden", "hidden", "not_started"],
      ["watching", "history", "watching"],
      ["watched", "history", "watched"],
      ["dropped", "history", "dropped"],
    ] as const;
    for (const [status, list, season] of cases) {
      const item = migrateState(wrap([legacy({ status })]))!.items[0]!;
      expect([status, item.list, item.seasons[0]!.state]).toEqual([status, list, season]);
    }
  });

  it("gives a film exactly one season", () => {
    const item = migrateState(wrap([legacy({ type: "film", status: "watched" })]))!.items[0]!;
    expect(item.seasons).toHaveLength(1);
    expect(item.seasons[0]!.state).toBe("watched");
  });

  it("stamps the current schema version and keeps settings", () => {
    const state = migrateState(wrap([legacy()]))!;
    expect(state.version).toBe(STATE_VERSION);
    expect(state.version).toBe(2);
    expect(state.settings.sound).toBe(false);
    expect(state.settings.activeList).toBe("anime");
    expect(state.lastWinnerId).toBe("a");
  });
});

describe("migrateState: v2 and broken input", () => {
  it("keeps a v2 item as is", () => {
    const season = { state: "not_aired", changedAt: 5 };
    const state = migrateState({
      version: 2,
      items: [
        {
          id: "b",
          title: "Тетрадь смерти",
          type: "anime",
          list: "history",
          seasons: [{ state: "watched", changedAt: 7 }, season],
          createdAt: 1,
          statusChangedAt: 8,
        },
      ],
    })!;
    expect(state.items[0]!.seasons).toEqual([{ state: "watched", changedAt: 7 }, season]);
    expect(state.items[0]!.list).toBe("history");
    expect(state.items[0]!.statusChangedAt).toBe(8);
  });

  it("repairs unknown season states to not_started", () => {
    const item = migrateState({
      version: 2,
      items: [
        {
          id: "c",
          title: "X",
          type: "series",
          list: "pool",
          seasons: [{ state: "banana", changedAt: 3 }],
          createdAt: 1,
          statusChangedAt: 1,
        },
      ],
    })!.items[0]!;
    expect(item.seasons[0]!.state).toBe("not_started");
  });

  it("gives an empty seasons array one season instead of zero", () => {
    const item = migrateState({
      version: 2,
      items: [{ id: "d", title: "Y", type: "series", list: "pool", seasons: [], createdAt: 1 }],
    })!.items[0]!;
    expect(item.seasons).toHaveLength(1);
    expect(item.seasons[0]!.state).toBe("not_started");
  });

  it("trims a film to a single season", () => {
    const item = migrateState({
      version: 2,
      items: [
        {
          id: "e",
          title: "Z",
          type: "film",
          list: "pool",
          seasons: [
            { state: "watched", changedAt: 1 },
            { state: "watched", changedAt: 2 },
            { state: "watched", changedAt: 3 },
          ],
          createdAt: 1,
        },
      ],
    })!.items[0]!;
    expect(item.seasons).toHaveLength(1);
  });

  it("drops items without a title and survives garbage", () => {
    const state = migrateState({
      version: 1,
      items: [{ title: "   " }, null, 42, legacy()],
    })!;
    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.title).toBe("Монолог Фармацевта");
  });

  it("rejects non-objects and missing items", () => {
    expect(migrateState(null)).toBeNull();
    expect(migrateState("nope")).toBeNull();
    const empty = migrateState({})!;
    expect(empty.items).toEqual([]);
    expect(empty.settings.activeList).toBe("series");
    expect(empty.settings.sound).toBe(true);
  });

  it("takes the latest season change as the position timestamp", () => {
    const item = migrateState({
      version: 2,
      items: [
        {
          id: "f",
          title: "R",
          type: "series",
          list: "history",
          seasons: [
            { state: "watched", changedAt: 100 },
            { state: "watching", changedAt: 300 },
          ],
          createdAt: 1,
          statusChangedAt: 2,
        },
      ],
    })!.items[0]!;
    expect(item.statusChangedAt).toBe(300);
  });
});
