/**
 * Operaciones de píxeles puras (sin DOM) para el editor.
 * Se hacen a mano y no con ctx.filter porque Safari/iPhone no soporta ctx.filter en canvas.
 */

export const FILTERS = [
  { id: "none", label: "Original" },
  { id: "grayscale", label: "Blanco y negro" },
  { id: "sepia", label: "Sepia" },
  { id: "vivid", label: "Vívido" },
  { id: "warm", label: "Cálido" },
  { id: "cool", label: "Frío" },
  { id: "pop", label: "Pop art" },
  { id: "invert", label: "Invertir" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];

/**
 * Quita el fondo con un relleno por inundación desde los bordes: solo se borran los
 * píxeles parecidos al color del fondo que están conectados con el borde de la imagen,
 * así los detalles interiores del mismo color (ojos blancos, por ejemplo) se conservan.
 * Modifica `data` en el sitio y devuelve cuántos píxeles se hicieron transparentes.
 */
export function removeBackground(data: Uint8ClampedArray, width: number, height: number, tolerance = 40): number {
  if (width < 2 || height < 2) return 0;
  const px = (x: number, y: number) => (y * width + x) * 4;

  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of corners) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= 4;
  g /= 4;
  b /= 4;

  const maxDist2 = tolerance * tolerance;
  const isBackground = (p: number) => {
    const i = p * 4;
    if (data[i + 3] === 0) return true;
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    return dr * dr + dg * dg + db * db <= maxDist2;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * width + x;
    if (!visited[p] && isBackground(p)) {
      visited[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let removed = 0;
  while (stack.length > 0) {
    const p = stack.pop() as number;
    data[p * 4 + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return removed;
}

export function applyFilter(data: Uint8ClampedArray, filter: FilterId): void {
  if (filter === "none") return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    switch (filter) {
      case "grayscale":
        data[i] = data[i + 1] = data[i + 2] = gray;
        break;
      case "sepia":
        data[i] = 0.393 * r + 0.769 * g + 0.189 * b;
        data[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
        data[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
        break;
      case "vivid":
        data[i] = (gray + (r - gray) * 1.4 - 128) * 1.1 + 128;
        data[i + 1] = (gray + (g - gray) * 1.4 - 128) * 1.1 + 128;
        data[i + 2] = (gray + (b - gray) * 1.4 - 128) * 1.1 + 128;
        break;
      case "warm":
        data[i] = r * 1.08 + 8;
        data[i + 2] = b * 0.9;
        break;
      case "cool":
        data[i] = r * 0.92;
        data[i + 2] = b * 1.1 + 8;
        break;
      case "pop":
        data[i] = Math.round(r / 85) * 85;
        data[i + 1] = Math.round(g / 85) * 85;
        data[i + 2] = Math.round(b / 85) * 85;
        break;
      case "invert":
        data[i] = 255 - r;
        data[i + 1] = 255 - g;
        data[i + 2] = 255 - b;
        break;
    }
  }
}
