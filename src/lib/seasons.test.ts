import { describe, expect, it } from "vitest";

import {
  addSeason,
  createSeasons,
  currentSeasonIndex,
  dropSeason,
  isWatchable,
  markAllWatched,
  removeSeason,
  seasonBadge,
  seasonHasProgress,
  setSeasonState,
  startWatching,
  titleStatus,
  upcomingSeasonNumber,
} from "@/lib/seasons";
import type { Item, Season, SeasonState } from "@/types";

const season = (state: SeasonState, changedAt = 1): Season => ({ state, changedAt });

const item = (seasons: Season[], over: Partial<Item> = {}): Item => ({
  id: "id",
  title: "Монолог Фармацевта",
  type: "series",
  list: "pool",
  seasons,
  createdAt: 1,
  statusChangedAt: 1,
  ...over,
});

describe("titleStatus", () => {
  it("is «Смотрю» while a season is being watched", () => {
    expect(titleStatus(item([season("watched"), season("watching")]))).toBe("watching");
  });

  it("is «Не начат» when nothing has aired yet", () => {
    expect(titleStatus(item([season("not_aired")]))).toBe("not_started");
  });

  it("is «Досмотрел» when every released season is watched", () => {
    expect(titleStatus(item([season("watched"), season("watched"), season("not_aired")]))).toBe(
      "watched",
    );
  });

  it("is «Смотрю» when a released season is not started and nothing was dropped", () => {
    expect(titleStatus(item([season("watched"), season("not_started")]))).toBe("watching");
  });

  it("is «Бросил» when the only released seasons were dropped", () => {
    expect(titleStatus(item([season("dropped")]))).toBe("dropped");
  });

  it("stays «Бросил» when a new season airs after a drop", () => {
    expect(titleStatus(item([season("dropped"), season("not_started")]))).toBe("dropped");
  });

  it("is «Бросил» for watched + dropped mixes", () => {
    expect(titleStatus(item([season("watched"), season("dropped")]))).toBe("dropped");
  });
});

describe("season badge and pointers", () => {
  it("points at the watching season first", () => {
    expect(currentSeasonIndex(item([season("watched"), season("watching"), season("not_started")]))).toBe(1);
  });

  it("falls back to the first unwatched season", () => {
    expect(currentSeasonIndex(item([season("watched"), season("not_started")]))).toBe(1);
  });

  it("returns -1 when everything released is closed", () => {
    expect(currentSeasonIndex(item([season("watched"), season("watched")]))).toBe(-1);
  });

  it("counts only released seasons in the badge", () => {
    const show = item([season("watched"), season("not_started"), season("not_aired"), season("not_aired")]);
    expect(seasonBadge(show)).toBe("S2/2");
  });

  it("shows the last season when everything is watched", () => {
    expect(seasonBadge(item([season("watched"), season("watched")]))).toBe("S2/2");
  });

  it("has no badge for films and for nothing released", () => {
    expect(seasonBadge(item([season("not_started")], { type: "film" }))).toBeNull();
    expect(seasonBadge(item([season("not_aired")]))).toBeNull();
  });

  it("flags a dropped title with a new season", () => {
    const dropped = item([season("dropped"), season("not_started")], { list: "history" });
    expect(upcomingSeasonNumber(dropped)).toBe(2);
    expect(upcomingSeasonNumber(item([season("watched"), season("watched")]))).toBeNull();
    expect(upcomingSeasonNumber(item([season("watching")]))).toBeNull();
  });
});

describe("wheel eligibility", () => {
  it("keeps titles with something to watch", () => {
    expect(isWatchable(item([season("not_started")]))).toBe(true);
    expect(isWatchable(item([season("watching")]))).toBe(true);
    expect(isWatchable(item([season("watched"), season("not_started")]))).toBe(true);
  });

  it("drops titles with nothing left to watch", () => {
    expect(isWatchable(item([season("watched"), season("watched")]))).toBe(false);
    expect(isWatchable(item([season("dropped")]))).toBe(false);
    expect(isWatchable(item([season("not_aired")]))).toBe(false);
  });
});

describe("season mutations", () => {
  it("«Смотрю» starts the current season and moves the title to history", () => {
    const next = startWatching(item([season("watched"), season("not_started")]), 50);
    expect(next.seasons.map((s) => s.state)).toEqual(["watched", "watching"]);
    expect(next.list).toBe("history");
    expect(next.statusChangedAt).toBe(50);
  });

  it("does nothing for a title with nothing to start", () => {
    const closed = item([season("watched")]);
    expect(startWatching(closed)).toBe(closed);
  });

  it("«Уже смотрел» marks every released season and leaves announced ones alone", () => {
    const next = markAllWatched(item([season("not_started"), season("not_aired")]), 70);
    expect(next.seasons.map((s) => s.state)).toEqual(["watched", "not_aired"]);
    expect(next.list).toBe("history");
  });

  it("«Бросил» drops the season in progress", () => {
    const next = dropSeason(item([season("watched"), season("watching")]), 80);
    expect(next.seasons.map((s) => s.state)).toEqual(["watched", "dropped"]);
    expect(next.list).toBe("history");
  });

  it("«Бросил» on a fully watched title drops the last season", () => {
    const next = dropSeason(item([season("watched"), season("watched")]));
    expect(next.seasons.map((s) => s.state)).toEqual(["watched", "dropped"]);
  });

  it("sets a single season state with its own timestamp", () => {
    const next = setSeasonState(item([season("watched"), season("not_started")]), 1, "watched", 90);
    expect(next.seasons[1]).toEqual({ state: "watched", changedAt: 90 });
    expect(next.statusChangedAt).toBe(90);
    expect(next.seasons[0]!.changedAt).toBe(1);
  });

  it("adds a season, announced by default", () => {
    const next = addSeason(item([season("watched")]));
    expect(next.seasons).toHaveLength(2);
    expect(next.seasons[1]!.state).toBe("not_aired");
  });

  it("renumbers after removal — the number is the index", () => {
    const next = removeSeason(item([season("watched"), season("not_started"), season("not_aired")]), 1);
    expect(next.seasons.map((s) => s.state)).toEqual(["watched", "not_aired"]);
    expect(next.seasons).toHaveLength(2);
  });

  it("never removes the last season", () => {
    const one = item([season("watched")]);
    expect(removeSeason(one, 0)).toBe(one);
  });

  it("filters out films when adding a season", () => {
    const film = item([season("watched")], { type: "film" });
    expect(addSeason(film)).toBe(film);
  });

  it("knows which seasons carry progress", () => {
    expect(seasonHasProgress(season("not_started"))).toBe(false);
    expect(seasonHasProgress(season("not_aired"))).toBe(false);
    expect(seasonHasProgress(season("watching"))).toBe(true);
    expect(seasonHasProgress(season("watched"))).toBe(true);
    expect(seasonHasProgress(season("dropped"))).toBe(true);
  });
});

describe("createSeasons", () => {
  it("creates the requested count of not-started seasons", () => {
    const seasons = createSeasons(3, "not_started", 5);
    expect(seasons).toHaveLength(3);
    expect(seasons.every((s) => s.state === "not_started" && s.changedAt === 5)).toBe(true);
  });

  it("clamps nonsense counts to at least one season", () => {
    expect(createSeasons(0)).toHaveLength(1);
    expect(createSeasons(-5)).toHaveLength(1);
    expect(createSeasons(Number.NaN)).toHaveLength(1);
    expect(createSeasons(1000)).toHaveLength(100);
  });
});
