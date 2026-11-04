import { describe, expect, it } from "vitest";
import { History } from "./history";

describe("History", () => {
  it("deshace y rehace en orden", () => {
    const h = new History(1);
    h.push(2);
    h.push(3);
    expect(h.current).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBe(1);
    expect(h.redo()).toBe(2);
    expect(h.redo()).toBe(3);
    expect(h.canRedo).toBe(false);
  });

  it("un nuevo cambio borra el futuro", () => {
    const h = new History("a");
    h.push("b");
    h.undo();
    h.push("c");
    expect(h.canRedo).toBe(false);
    expect(h.current).toBe("c");
  });

  it("replace + commitFrom agrupa un gesto en un solo paso", () => {
    const h = new History({ x: 0 });
    const before = h.current;
    h.replace({ x: 1 });
    h.replace({ x: 2 });
    h.replace({ x: 3 });
    h.commitFrom(before);
    expect(h.current.x).toBe(3);
    expect(h.undo().x).toBe(0);
  });

  it("commitFrom no registra nada si el estado no cambió", () => {
    const h = new History({ x: 0 });
    h.commitFrom(h.current);
    expect(h.canUndo).toBe(false);
  });

  it("respeta el límite de pasos", () => {
    const h = new History(0, 3);
    for (let i = 1; i <= 10; i++) h.push(i);
    let steps = 0;
    while (h.canUndo) {
      h.undo();
      steps++;
    }
    expect(steps).toBe(3);
  });
});
