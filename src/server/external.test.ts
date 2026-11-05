import { describe, expect, it } from "vitest";
import { cleanLimit, cleanQuery, searchAnime, searchBooks, searchGiphyStickers, searchMusic, searchOpenImages, searchWikipedia, type Fetcher } from "./external";

const jsonFetch =
  (body: unknown, status = 200, seen: string[] = []): Fetcher =>
  async (url) => {
    seen.push(String(url));
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };

async function fails(p: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { status?: number; message: string };
    return { status: err.status ?? 0, message: err.message };
  }
  throw new Error("Se esperaba un error.");
}

describe("parámetros", () => {
  it("cleanQuery exige texto y recorta; cleanLimit acota", () => {
    expect(() => cleanQuery(null)).toThrow();
    expect(() => cleanQuery("   ")).toThrow();
    expect(cleanQuery(" gato ")).toBe("gato");
    expect(cleanQuery("x".repeat(500))).toHaveLength(100);
    expect(cleanLimit(null)).toBe(10);
    expect(cleanLimit("500")).toBe(25);
    expect(cleanLimit("0")).toBe(1);
    expect(cleanLimit("abc", 7)).toBe(7);
  });
});

describe("proveedores externos", () => {
  it("Giphy: exige clave propia, codifica la búsqueda y normaliza", async () => {
    expect((await fails(searchGiphyStickers(jsonFetch({}), undefined, "gato", 5))).status).toBe(503);
    const seen: string[] = [];
    const out = await searchGiphyStickers(
      jsonFetch({ data: [{ id: "a1", title: "Gato", url: "https://giphy.com/a1", images: { original: { url: "https://m/a.gif", webp: "https://m/a.webp" } } }] }, 200, seen),
      "KEY",
      "gato & perro",
      5,
    );
    expect(seen[0]).toContain("q=gato%20%26%20perro");
    expect(seen[0]).toContain("limit=5");
    expect(out).toEqual([{ id: "a1", title: "Gato", gif: "https://m/a.gif", webp: "https://m/a.webp", page: "https://giphy.com/a1" }]);
  });

  it("música (iTunes): normaliza y marca la vista previa", async () => {
    const out = await searchMusic(
      jsonFetch({ results: [{ trackId: 1, trackName: "Canción", artistName: "Ana", previewUrl: "https://a/p.m4a", trackViewUrl: "https://a/v", artworkUrl100: "https://a/c.jpg" }] }),
      "ana",
      3,
    );
    expect(out[0]).toMatchObject({ id: 1, title: "Canción", artist: "Ana", previewUrl: "https://a/p.m4a" });
  });

  it("anime (Jikan), libros (Open Library) e imágenes abiertas (Openverse)", async () => {
    const anime = await searchAnime(jsonFetch({ data: [{ mal_id: 5, title: "Cowboy Bebop", score: 8.7, images: { jpg: { image_url: "https://i/a.jpg" } } }] }), "bebop", 3);
    expect(anime[0]).toMatchObject({ id: 5, title: "Cowboy Bebop", score: 8.7, image: "https://i/a.jpg" });
    const books = await searchBooks(jsonFetch({ docs: [{ key: "/works/OL1W", title: "Don Quijote", author_name: ["Cervantes"], cover_i: 42 }] }), "quijote", 3);
    expect(books[0]).toMatchObject({ title: "Don Quijote", authors: ["Cervantes"], cover: "https://covers.openlibrary.org/b/id/42-M.jpg", url: "https://openlibrary.org/works/OL1W" });
    const imgs = await searchOpenImages(jsonFetch({ results: [{ id: "x", url: "https://i/x.jpg", creator: "Luz", license: "by", license_version: "4.0", license_url: "https://cc/by/4" }] }), "gato", 3);
    expect(imgs[0]).toMatchObject({ creator: "Luz", license: "by", licenseVersion: "4.0" });
  });

  it("Wikipedia: valida el idioma, limpia el HTML y arma el enlace", async () => {
    expect((await fails(searchWikipedia(jsonFetch({}), "x", 3, "es/../evil"))).status).toBe(400);
    const seen: string[] = [];
    const out = await searchWikipedia(
      jsonFetch({ pages: [{ id: 9, key: "Gato_doméstico", title: "Gato", excerpt: "El <span>gato</span> es", thumbnail: { url: "//u/g.jpg" } }] }, 200, seen),
      "gato",
      3,
      "es",
    );
    expect(seen[0].startsWith("https://es.wikipedia.org/")).toBe(true);
    expect(out[0]).toMatchObject({ title: "Gato", excerpt: "El gato es", thumbnail: "https://u/g.jpg", url: "https://es.wikipedia.org/wiki/Gato_dom%C3%A9stico" });
  });

  it("traduce los fallos externos a errores claros", async () => {
    expect((await fails(searchMusic(jsonFetch("no es json"), "x", 1))).status).toBe(502);
    expect((await fails(searchMusic(jsonFetch({}, 500), "x", 1))).status).toBe(502);
    expect((await fails(searchMusic(jsonFetch({}, 429), "x", 1))).status).toBe(503);
    const boom: Fetcher = async () => {
      throw new Error("red caída");
    };
    expect((await fails(searchMusic(boom, "x", 1))).status).toBe(502);
    expect(await searchMusic(jsonFetch({ results: "raro" }), "x", 1)).toEqual([]);
  });
});
