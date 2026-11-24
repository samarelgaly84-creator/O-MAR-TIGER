// IndexedDB helper for reading files shared into TIGER via Web Share Target

const SHARE_DB_NAME = 'tiger-share-target-db';
const SHARE_STORE_NAME = 'pending-shares';

export interface StoredSharedPayload {
  title: string;
  text: string;
  url: string;
  files: File[];
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(SHARE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function consumePendingOsShare(): Promise<StoredSharedPayload | null> {
  try {
    const db = await openShareDb();
    const record: any = await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE_NAME, 'readonly');
      const req = tx.objectStore(SHARE_STORE_NAME).get('latest');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!record) return null;

    // Clear consumed record
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
      tx.objectStore(SHARE_STORE_NAME).delete('latest');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    const files: File[] = (record.files || []).map(
      (f: { buffer: ArrayBuffer; name: string; type: string }) =>
        new File([f.buffer], f.name, { type: f.type || 'application/octet-stream' })
    );

    return {
      title: String(record.title || ''),
      text: String(record.text || ''),
      url: String(record.url || ''),
      files,
    };
  } catch {
    return null;
  }
}
