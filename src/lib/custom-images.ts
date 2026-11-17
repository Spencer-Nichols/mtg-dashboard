// Custom proxy fronts live in this browser's IndexedDB, keyed "<scope>|<cardId>".
// Nothing is uploaded, so they don't follow a deck to another device.
const DB_NAME = 'tnk-proxies'
const STORE = 'custom-images'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const scopeRange = (scope: string) => IDBKeyRange.bound(`${scope}|`, `${scope}|￿`)

export async function loadCustomImages(scope: string): Promise<Map<string, Blob>> {
  const keys = await withStore('readonly', store => store.getAllKeys(scopeRange(scope)))
  const blobs = await withStore('readonly', store => store.getAll(scopeRange(scope)))
  const prefix = `${scope}|`
  return new Map(keys.map((key, i) => [String(key).slice(prefix.length), blobs[i] as Blob]))
}

export async function saveCustomImage(scope: string, cardId: string, image: Blob) {
  await withStore('readwrite', store => store.put(image, `${scope}|${cardId}`))
}

export async function removeCustomImage(scope: string, cardId: string) {
  await withStore('readwrite', store => store.delete(`${scope}|${cardId}`))
}

export async function clearCustomImages(scope: string) {
  await withStore('readwrite', store => store.delete(scopeRange(scope)))
}
