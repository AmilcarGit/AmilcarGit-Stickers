import { describe, expect, it } from "vitest";
import { dragonBallCharacter, dragonBallCharacters, dragonBallPlanets, randomContent, type ContentFetcher } from "./content";

const response = (payload: unknown, status = 200): ContentFetcher =>
  async () => new Response(JSON.stringify(payload), { status });

describe("contenido Dragon Ball", () => {
  it("normaliza personajes y sus transformaciones", async () => {
    const fetcher = response({ items: [{ id: 1, name: "Goku", ki: "60.000.000", image: "https://img/goku.png", transformations: [{ id: 2, name: "Super Saiyan", image: "https://img/ss.png", ki: "150.000.000" }] }] });
    const result = await dragonBallCharacters(fetcher, "Goku", 5);
    expect(result[0]).toMatchObject({ id: 1, name: "Goku", transformations: [{ id: 2, name: "Super Saiyan" }] });
  });

  it("valida el id de personaje y devuelve el detalle", async () => {
    await expect(dragonBallCharacter(response({}), "../1")).rejects.toMatchObject({ status: 400 });
    await expect(dragonBallCharacter(response({ id: 1, name: "Goku" }), "1")).resolves.toMatchObject({ name: "Goku" });
  });

  it("normaliza planetas", async () => {
    const result = await dragonBallPlanets(response({ items: [{ id: 1, name: "Tierra", isDestroyed: false, characters: [{ id: 1, name: "Goku" }] }] }), 5);
    expect(result[0]).toMatchObject({ id: 1, name: "Tierra", isDestroyed: false });
  });
});

describe("contenido aleatorio", () => {
  it("devuelve contenido propio sin llamar proveedores", async () => {
    const fetcher = response({});
    expect((await randomContent(fetcher, "quote")).source).toContain("YuiAPI");
    expect((await randomContent(fetcher, "fact")).text).toBeTruthy();
    expect((await randomContent(fetcher, "joke")).text).toBeTruthy();
  });

  it("rechaza categorías desconocidas", async () => {
    await expect(randomContent(response({}), "unknown")).rejects.toMatchObject({ status: 404 });
  });
});
