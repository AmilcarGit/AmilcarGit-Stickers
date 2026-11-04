export type BlobKind = "sticker" | "tray" | "avatar";

export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Solo se aceptan archivos que esta misma cuenta subió a nuestro Blob:
 * la ruta es `<tipo>s/<uid>/<id>.<ext>`, así nadie puede publicar archivos de otra persona ni enlaces externos.
 */
export function isOwnBlobUrl(url: unknown, uid: string, kind: BlobKind): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX) && u.pathname.startsWith(`/${kind}s/${uid}/`);
  } catch {
    return false;
  }
}
