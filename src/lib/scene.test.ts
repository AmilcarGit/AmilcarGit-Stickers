import { describe, expect, it } from "vitest";
import {
  ANIMS,
  CANVAS,
  animTransform,
  emptyScene,
  hasAnimation,
  imageSize,
  makeDrawEl,
  makeEmojiEl,
  makeImageEl,
  makeTextEl,
  parseScene,
  type AnimId,
} from "./scene";

describe("animTransform", () => {
  it("todas las animaciones cierran el bucle (t=0 y t=1 dan lo mismo)", () => {
    for (const { id } of ANIMS) {
      if (id === "spin") continue; // gira 360° y vuelve visualmente al mismo punto
      const a = animTransform(id as AnimId, 0);
      const b = animTransform(id as AnimId, 1);
      expect(b.dx).toBeCloseTo(a.dx, 5);
      expect(b.dy).toBeCloseTo(a.dy, 5);
      expect(b.scale).toBeCloseTo(a.scale, 5);
      expect(b.rot).toBeCloseTo(a.rot, 5);
      expect(b.alpha).toBeCloseTo(a.alpha, 5);
    }
  });

  it("spin completa una vuelta", () => {
    expect(animTransform("spin", 1).rot).toBeCloseTo(Math.PI * 2, 5);
    expect(animTransform("spin", 0.5).rot).toBeCloseTo(Math.PI, 5);
  });

  it("'none' no mueve nada", () => {
    expect(animTransform("none", 0.37)).toEqual({ dx: 0, dy: 0, scale: 1, rot: 0, alpha: 1 });
  });

  it("la opacidad nunca sale de 0..1", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const { alpha } = animTransform("blink", t);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe("creación de elementos", () => {
  it("la imagen se ajusta al lienzo y queda centrada", () => {
    const el = makeImageEl("s1", "data:", 640, 320);
    expect(el.x).toBe(CANVAS / 2);
    expect(el.y).toBe(CANVAS / 2);
    expect(640 * el.scale).toBeLessThanOrEqual(380 + 0.001);
  });

  it("imageSize respeta el recorte", () => {
    const el = makeImageEl("s1", "data:", 400, 200);
    el.crop = { l: 0.25, r: 0.25, t: 0, b: 0.5 };
    expect(imageSize(el)).toEqual({ w: 200, h: 100 });
  });

  it("makeDrawEl centra el trazo en su caja", () => {
    const el = makeDrawEl(
      [
        { x: 100, y: 100 },
        { x: 200, y: 140 },
      ],
      "#fff",
      8,
    );
    expect(el).not.toBeNull();
    expect(el?.x).toBe(150);
    expect(el?.y).toBe(120);
    expect(el?.points[0]).toEqual({ x: -50, y: -20 });
    expect(makeDrawEl([], "#fff", 8)).toBeNull();
  });

  it("ids únicos", () => {
    const ids = new Set([makeTextEl().id, makeEmojiEl("😀").id, makeTextEl("a").id, makeTextEl("b").id]);
    expect(ids.size).toBe(4);
  });
});

describe("parseScene", () => {
  it("ida y vuelta de una escena válida", () => {
    const scene = emptyScene();
    const text = makeTextEl("Hola");
    text.anim = "bounce";
    scene.elements.push(text, makeEmojiEl("🔥"), makeImageEl("a", "data:image/png;base64,AAAA", 100, 80));
    scene.durationMs = 2000;
    const back = parseScene(JSON.stringify(scene));
    expect(back).not.toBeNull();
    expect(back?.elements).toHaveLength(3);
    expect(back?.durationMs).toBe(2000);
    expect(back?.elements[0]).toEqual(text);
  });

  it("descarta elementos dañados y rellena estilos que faltan", () => {
    const json = JSON.stringify({
      elements: [
        { type: "emoji", id: "ok", x: 1, y: 2, scale: 1, rotation: 0, opacity: 1, anim: "none", char: "😀", size: 100 },
        { type: "emoji", id: "malo", x: "1", y: 2, scale: 1, rotation: 0, opacity: 1, anim: "none", char: "😀", size: 100 },
        { type: "script", id: "x" },
        null,
      ],
      durationMs: 99999,
    });
    const scene = parseScene(json);
    expect(scene?.elements).toHaveLength(1);
    expect(scene?.durationMs).toBe(5000);
    expect(scene?.style.outline).toBe(true);
  });

  it("rechaza JSON que no es una escena", () => {
    expect(parseScene("no es json")).toBeNull();
    expect(parseScene("{}")).toBeNull();
    expect(parseScene("[]")).toBeNull();
    expect(parseScene("null")).toBeNull();
  });
});

describe("hasAnimation", () => {
  it("detecta si algún elemento se anima", () => {
    const s = emptyScene();
    expect(hasAnimation(s)).toBe(false);
    const t = makeTextEl();
    t.anim = "bounce";
    s.elements.push(t);
    expect(hasAnimation(s)).toBe(true);
  });
});
