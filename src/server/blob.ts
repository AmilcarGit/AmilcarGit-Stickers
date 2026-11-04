import { del } from "@vercel/blob";

/** Borra archivos del almacenamiento. Si falla no se interrumpe la operación principal. */
export async function deleteBlobs(urls: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || urls.length === 0) return;
  try {
    await del(urls);
  } catch (err) {
    console.error("No se pudieron borrar archivos del almacenamiento:", err instanceof Error ? err.message : "error");
  }
}
