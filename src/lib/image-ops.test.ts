import { describe, expect, it } from "vitest";
import { applyFilter, removeBackground } from "./image-ops";

function solid(w: number, h: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(rgba, i * 4);
  return d;
}

function setPx(d: Uint8ClampedArray, w: number, x: number, y: number, rgba: [number, number, number, number]) {
  d.set(rgba, (y * w + x) * 4);
}

const alphaAt = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("removeBackground", () => {
  it("borra el fondo conectado al borde y conserva el sujeto", () => {
    const w = 5;
    const d = solid(w, w, [255, 255, 255, 255]);
    setPx(d, w, 2, 2, [255, 0, 0, 255]);
    const removed = removeBackground(d, w, w, 40);
    expect(removed).toBe(24);
    expect(alphaAt(d, w, 0, 0)).toBe(0);
    expect(alphaAt(d, w, 2, 2)).toBe(255);
  });

  it("conserva zonas del color del fondo encerradas por el sujeto", () => {
    const w = 7;
    const d = solid(w, w, [255, 255, 255, 255]);
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) setPx(d, w, x, y, [200, 0, 0, 255]);
    setPx(d, w, 3, 3, [255, 255, 255, 255]); // "ojo" blanco encerrado
    removeBackground(d, w, w, 30);
    expect(alphaAt(d, w, 0, 0)).toBe(0);
    expect(alphaAt(d, w, 3, 3)).toBe(255);
    expect(alphaAt(d, w, 2, 2)).toBe(255);
  });

  it("con tolerancia 0 solo borra el color exacto", () => {
    const w = 4;
    const d = solid(w, w, [10, 10, 10, 255]);
    setPx(d, w, 1, 1, [14, 10, 10, 255]);
    removeBackground(d, w, w, 0);
    expect(alphaAt(d, w, 1, 1)).toBe(255);
    expect(alphaAt(d, w, 0, 0)).toBe(0);
  });
});

describe("applyFilter", () => {
  it("escala de grises iguala los canales y conserva el alfa", () => {
    const d = new Uint8ClampedArray([200, 100, 50, 180]);
    applyFilter(d, "grayscale");
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[3]).toBe(180);
  });

  it("invertir es su propio inverso", () => {
    const d = new Uint8ClampedArray([10, 20, 30, 255]);
    applyFilter(d, "invert");
    expect(Array.from(d)).toEqual([245, 235, 225, 255]);
    applyFilter(d, "invert");
    expect(Array.from(d)).toEqual([10, 20, 30, 255]);
  });

  it("no toca los píxeles transparentes ni cambia nada con 'none'", () => {
    const d = new Uint8ClampedArray([10, 20, 30, 0]);
    applyFilter(d, "invert");
    expect(Array.from(d)).toEqual([10, 20, 30, 0]);
    const e = new Uint8ClampedArray([10, 20, 30, 255]);
    applyFilter(e, "none");
    expect(Array.from(e)).toEqual([10, 20, 30, 255]);
  });
});
