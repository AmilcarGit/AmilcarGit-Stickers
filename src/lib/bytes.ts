/** Convierte bytes en Blob (el cast evita incompatibilidades de tipos entre versiones de TypeScript). */
export function blobOf(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as BlobPart], { type });
}

export function bodyOf(bytes: Uint8Array): BodyInit {
  return bytes as unknown as BodyInit;
}

export function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
}

export function isWebpBytes(b: Uint8Array): boolean {
  return (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  );
}

export function isPngBytes(b: Uint8Array): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

export function isJpegBytes(b: Uint8Array): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
