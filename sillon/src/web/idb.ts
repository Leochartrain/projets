// Petite couche IndexedDB : toute la bibliothèque de la version téléphone vit dans le navigateur.
export type StoreName = "tracks" | "files" | "covers" | "playlists" | "plays" | "settings";

let dbPromise: Promise<IDBDatabase> | null = null;

export function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("sillon", 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore("tracks", { keyPath: "id" });
        d.createObjectStore("files"); // id du morceau → Blob audio
        d.createObjectStore("covers"); // "<clé>_<taille>" → Blob JPEG, "<clé>" → couleurs
        d.createObjectStore("playlists", { keyPath: "id" });
        d.createObjectStore("plays", { autoIncrement: true });
        d.createObjectStore("settings"); // clé → valeur JSON
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const d = await db();
  return done(d.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const d = await db();
  return done(d.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function entries<T>(store: StoreName): Promise<[IDBValidKey, T][]> {
  const d = await db();
  const os = d.transaction(store).objectStore(store);
  const [keys, values] = await Promise.all([done(os.getAllKeys()), done(os.getAll())]);
  return keys.map((k, i) => [k, values[i] as T]);
}

export async function put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clear(store: StoreName): Promise<void> {
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  tx.objectStore(store).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
