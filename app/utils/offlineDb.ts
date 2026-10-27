/**
 * قاعدةُ الجهاز (IndexedDB) للحضور بلا إنترنت — غلافٌ صغيرٌ بالوعود حول الواجهة الأصلية (بلا مكتبة).
 * مخزنان: `mirror` نسخةُ حلقة المعلّم وطلابها وأيامها (مفتاحُها `uid`)، و`outbox` صندوقُ الرفع (مفتاحُه `key`)،
 * و`meta` لِما يلزم الإقلاعَ بلا شبكة (آخرُ معلّمٍ فتح الشاشة، ومراجعُ المصحف)، و`quran_mirror`/`quran_outbox` للإنجاز القرآنيّ.
 */
import { OFFLINE_DB_NAME, OFFLINE_DB_VERSION } from '~/constants/offline'

export type StoreName = 'mirror' | 'outbox' | 'meta' | 'quran_mirror' | 'quran_outbox'

let opening: Promise<IDBDatabase> | null = null

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** يفتح القاعدةَ مرّةً واحدة (بنسختها دائماً — الفتحُ بلا نسخةٍ ينشئ قاعدةً فارغةً تكسر الترقية). */
export function openOfflineDb(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('mirror')) db.createObjectStore('mirror', { keyPath: 'uid' })
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      // النسخة 2 (2026-10-27): الإنجازُ القرآنيّ بلا إنترنت — شهورُ الحلقة على الجهاز وصندوقُ رفع سجلّاتها
      if (!db.objectStoreNames.contains('quran_mirror')) db.createObjectStore('quran_mirror', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('quran_outbox')) db.createObjectStore('quran_outbox', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      opening = null
      reject(req.error)
    }
  })
  return opening
}

async function store(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openOfflineDb()
  return db.transaction(name, mode).objectStore(name)
}

export async function idbGet<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return request<T | undefined>((await store(name, 'readonly')).get(key))
}

export async function idbGetAll<T>(name: StoreName): Promise<T[]> {
  return request<T[]>((await store(name, 'readonly')).getAll())
}

/** يحفظ القيمة — `key` للمخزن بلا مفتاحٍ داخليّ (`meta`). القيمةُ تُنسخ نسخاً عميقاً (لا وكلاءَ Vue). */
export async function idbPut(name: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  const plain = JSON.parse(JSON.stringify(value)) as unknown
  await request((await store(name, 'readwrite')).put(plain, key))
}

export async function idbDelete(name: StoreName, key: IDBValidKey): Promise<void> {
  await request((await store(name, 'readwrite')).delete(key))
}

/** هل فتح معلّمٌ شاشةَ الحضور على هذا الجهاز من قبل (فله نسخةٌ تعمل بلا إنترنت)؟ */
export async function hasOfflineTeacher(): Promise<boolean> {
  try {
    return !!(await idbGet<string>('meta', 'current'))
  } catch {
    return false
  }
}
