/**
 * Borrador local del paquete (IndexedDB). Los stickers exportados se guardan aquí,
 * en el dispositivo, hasta que el usuario descarga o publica el paquete.
 */
export type DraftSticker = {
  id: string;
  bytes: ArrayBuffer;
  animated: boolean;
  emojis: string[];
  createdAt: number;
};

const DB_NAME = "amilcargit-stickers";
const STORE = "draft";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Tu navegador no permite guardar el borrador del paquete."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listDraft(): Promise<DraftSticker[]> {
  const all = await run<DraftSticker[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addToDraft(item: DraftSticker): Promise<void> {
  await run("readwrite", (s) => s.put(item));
}

export async function updateDraft(id: string, patch: Partial<Pick<DraftSticker, "emojis">>): Promise<void> {
  const current = await run<DraftSticker | undefined>("readonly", (s) => s.get(id));
  if (!current) return;
  await run("readwrite", (s) => s.put({ ...current, ...patch }));
}

export async function removeFromDraft(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export async function clearDraft(): Promise<void> {
  await run("readwrite", (s) => s.clear());
}
