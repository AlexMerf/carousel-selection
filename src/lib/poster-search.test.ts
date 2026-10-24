import { afterEach, describe, expect, it, vi } from "vitest";

import { findPosters } from "@/lib/poster-search";

type Payload = Record<string, unknown>;

/** ru-wiki, search "Ганнибал телесериал": the series article itself has no images. */
const RU_HINTED: Payload = {
  query: {
    pages: {
      "1": {
        pageid: 1,
        title: "Ганнибал (телесериал)",
        index: 1,
        categories: [{ title: "Категория:Телесериалы США" }],
        langlinks: [{ lang: "en", "*": "Hannibal (TV series)" }],
      },
      "2": {
        pageid: 2,
        title: "Ганнибал Лектер",
        index: 2,
        images: [{ title: "Файл:Flag of France.svg" }],
        categories: [{ title: "Категория:Вымышленные серийные убийцы" }],
        langlinks: [{ lang: "en", "*": "Hannibal Lecter" }],
      },
    },
  },
};

/** ru-wiki, search "Ганнибал": the commander and Peter the Great's godson. */
const RU_PLAIN: Payload = {
  query: {
    pages: {
      "10": {
        pageid: 10,
        title: "Ганнибал",
        index: 1,
        images: [
          { title: "Файл:Hannibal Barca bust from Capua photo.jpg" },
          { title: "Файл:Hannibal Slodtz Louvre MR2093.jpg" },
        ],
        categories: [
          { title: "Категория:Персоналии по алфавиту" },
          { title: "Категория:Родившиеся в 247 году до н. э." },
        ],
        langlinks: [{ lang: "en", "*": "Hannibal" }],
      },
      "11": {
        pageid: 11,
        title: "Ганнибал, Абрам Петрович",
        index: 2,
        images: [{ title: "Файл:Portrait of Isaac Abramovich Hannibal.jpg" }],
        categories: [{ title: "Категория:Умершие в 1781 году" }],
        langlinks: [{ lang: "en", "*": "Abram Petrovich Gannibal" }],
      },
      "12": {
        pageid: 12,
        title: "Ганнибал (фильм, 2001)",
        index: 5,
        categories: [{ title: "Категория:Фильмы 2001 года" }],
        langlinks: [{ lang: "en", "*": "Hannibal (2001 film)" }],
      },
    },
  },
};

/** en-wiki: the series article only has a cast photo, the season articles have posters. */
const EN_SEARCH: Payload = {
  query: {
    pages: {
      "20": {
        pageid: 20,
        title: "Hannibal (TV series)",
        index: 1,
        images: [
          { title: "File:Hannibalcast.jpg" },
          { title: "File:Hannibal (Universal Television series) main title.svg" },
        ],
        categories: [{ title: "Category:2013 American television series debuts" }],
      },
      "21": {
        pageid: 21,
        title: "Hannibal season 1",
        index: 4,
        images: [
          { title: "File:Hannibal season 1.png" },
          { title: "File:Mads Mikkelsen Cannes 2013 2.jpg" },
        ],
        categories: [{ title: "Category:2013 American television seasons" }],
      },
    },
  },
};

const EN_IMAGEINFO: Payload = {
  query: {
    pages: {
      "30": {
        pageid: 30,
        title: "File:Hannibal season 1.png",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/en/8/85/Hannibal_season_1.png",
            thumburl: "https://upload.wikimedia.org/wikipedia/en/8/85/Hannibal_season_1.png",
            thumbwidth: 420,
            thumbheight: 526,
          },
        ],
      },
      "31": {
        pageid: 31,
        title: "File:Hannibalcast.jpg",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/en/5/5f/Hannibalcast.jpg",
            thumburl: "https://upload.wikimedia.org/wikipedia/en/5/5f/Hannibalcast.jpg",
            thumbwidth: 420,
            thumbheight: 236,
          },
        ],
      },
      "32": {
        pageid: 32,
        title: "File:Mads Mikkelsen Cannes 2013 2.jpg",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Mads_Mikkelsen_Cannes.jpg",
            thumburl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Mads_Mikkelsen_Cannes.jpg",
            thumbwidth: 420,
            thumbheight: 630,
          },
        ],
      },
    },
  },
};

/** A Russian film article that does carry a poster — the English detour is not needed. */
const RU_FILM: Payload = {
  query: {
    pages: {
      "40": {
        pageid: 40,
        title: "Дюна (фильм, 2021)",
        index: 1,
        images: [{ title: "Файл:Dune 2021 poster.jpg" }],
        categories: [{ title: "Категория:Фильмы 2021 года" }],
        langlinks: [{ lang: "en", "*": "Dune (2021 film)" }],
      },
    },
  },
};

const RU_FILM_IMAGEINFO: Payload = {
  query: {
    pages: {
      "50": {
        pageid: 50,
        title: "Файл:Dune 2021 poster.jpg",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/ru/1/1a/Dune_2021_poster.jpg",
            thumburl: "https://upload.wikimedia.org/wikipedia/ru/1/1a/Dune_2021_poster.jpg",
            thumbwidth: 420,
            thumbheight: 630,
          },
        ],
      },
    },
  },
};

const EMPTY: Payload = { query: { pages: {} } };

function stubFetch(route: (url: URL) => Payload | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = route(url);
    if (!payload) throw new Error(`unexpected request: ${url.href}`);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requests(fetchMock: ReturnType<typeof stubFetch>): URL[] {
  return fetchMock.mock.calls.map((call) => new URL(String(call[0])));
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findPosters", () => {
  it("does not offer historical figures for a series title", async () => {
    stubFetch((url) => {
      if (url.hostname === "ru.wikipedia.org") {
        if (url.searchParams.get("prop") === "imageinfo") return EMPTY;
        const search = url.searchParams.get("gsrsearch") ?? "";
        return search.includes("телесериал") ? RU_HINTED : RU_PLAIN;
      }
      if (url.hostname === "en.wikipedia.org") {
        return url.searchParams.get("prop") === "imageinfo" ? EN_IMAGEINFO : EN_SEARCH;
      }
      return undefined;
    });

    const report = await findPosters({ query: "Ганнибал", type: "series", signal: signal() });

    expect(report.errors).toEqual([]);
    expect(report.candidates.length).toBeGreaterThan(0);

    const urls = report.candidates.map((candidate) => candidate.imageUrl);
    expect(urls.join(" ")).not.toMatch(/bust|Capua|Gannibal|Portrait/i);
    expect(report.candidates[0]?.title).toBe("Hannibal season 1");
    expect(report.candidates[0]?.imageUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/en/8/85/Hannibal_season_1.png",
    );
    // The cast photo is a person picture, not key art.
    expect(urls).not.toContain("https://upload.wikimedia.org/wikipedia/en/5/5f/Hannibalcast.jpg");
  });

  it("asks Wikipedia with the type word, not just the title", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.hostname === "ru.wikipedia.org") {
        if (url.searchParams.get("prop") === "imageinfo") return EMPTY;
        const search = url.searchParams.get("gsrsearch") ?? "";
        return search.includes("телесериал") ? RU_HINTED : RU_PLAIN;
      }
      return url.hostname === "en.wikipedia.org"
        ? url.searchParams.get("prop") === "imageinfo"
          ? EN_IMAGEINFO
          : EN_SEARCH
        : undefined;
    });

    await findPosters({ query: "Ганнибал", type: "series", signal: signal() });

    const searches = requests(fetchMock)
      .filter((url) => url.searchParams.get("generator") === "search")
      .map((url) => url.searchParams.get("gsrsearch"));
    expect(searches).toContain("Ганнибал телесериал");
    expect(searches).toContain("Hannibal TV series");
  });

  it("keeps the Russian poster first when ru-wiki has one", async () => {
    stubFetch((url) => {
      if (url.hostname === "ru.wikipedia.org") {
        return url.searchParams.get("prop") === "imageinfo" ? RU_FILM_IMAGEINFO : RU_FILM;
      }
      if (url.hostname === "en.wikipedia.org") return EMPTY;
      return undefined;
    });

    const report = await findPosters({ query: "Дюна", type: "film", signal: signal() });

    expect(report.candidates[0]?.imageUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/ru/1/1a/Dune_2021_poster.jpg",
    );
  });

  it("still finds the poster when the list type disagrees with the article", async () => {
    stubFetch((url) => {
      if (url.hostname === "ru.wikipedia.org") {
        return url.searchParams.get("prop") === "imageinfo" ? RU_FILM_IMAGEINFO : RU_FILM;
      }
      if (url.hostname === "en.wikipedia.org") return EMPTY;
      return undefined;
    });

    // A film sits in the "series" list: the poster is still better than nothing.
    const report = await findPosters({ query: "Дюна", type: "series", signal: signal() });

    expect(report.candidates[0]?.imageUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/ru/1/1a/Dune_2021_poster.jpg",
    );
  });

  it("queries OMDb with the original title taken from Wikipedia", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.hostname === "ru.wikipedia.org") {
        if (url.searchParams.get("prop") === "imageinfo") return EMPTY;
        const search = url.searchParams.get("gsrsearch") ?? "";
        return search.includes("телесериал") ? RU_HINTED : RU_PLAIN;
      }
      if (url.hostname === "en.wikipedia.org") {
        return url.searchParams.get("prop") === "imageinfo" ? EN_IMAGEINFO : EN_SEARCH;
      }
      if (url.hostname === "www.omdbapi.com") {
        return {
          Response: "True",
          Search: [
            {
              Title: "Hannibal",
              Year: "2013–2015",
              imdbID: "tt2243973",
              Type: "series",
              Poster: "https://m.media-amazon.com/images/M/hannibal.jpg",
            },
          ],
        };
      }
      return undefined;
    });

    const report = await findPosters({
      query: "Ганнибал",
      type: "series",
      omdbKey: "secret",
      signal: signal(),
    });

    const omdb = requests(fetchMock).find((url) => url.hostname === "www.omdbapi.com");
    expect(omdb?.searchParams.get("s")).toBe("Hannibal");
    expect(omdb?.searchParams.get("type")).toBe("series");
    expect(report.candidates[0]?.source).toBe("omdb");
  });

  it("treats «Movie not found!» as an empty result, not as an error", async () => {
    stubFetch((url) => {
      if (url.hostname === "www.omdbapi.com") {
        return { Response: "False", Error: "Movie not found!" };
      }
      return EMPTY;
    });

    const report = await findPosters({
      query: "Несуществующее кино",
      type: "film",
      omdbKey: "secret",
      signal: signal(),
    });

    expect(report.candidates).toEqual([]);
    expect(report.errors).toEqual([]);
  });
});
