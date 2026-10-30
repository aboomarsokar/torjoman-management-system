import { beforeEach, describe, expect, it, vi } from 'vitest'

// بيئةُ الاختبار بلا IndexedDB: `indexedDB.open` محاكاةٌ تردّ طلباً نكمله بيدنا — والمختبَرُ هنا سلوكُ الغلاف
// حين يطلب لسانٌ آخر ترقيةَ القاعدة (`versionchange`)، لا محرّكُ التخزين
interface FakeDb { close: ReturnType<typeof vi.fn>, onversionchange: (() => void) | null }
const opened: FakeDb[] = []
const open = vi.fn(() => {
  const db: FakeDb = { close: vi.fn(), onversionchange: null }
  opened.push(db)
  const req = { result: db, onsuccess: null as (() => void) | null, onerror: null, onupgradeneeded: null }
  queueMicrotask(() => req.onsuccess?.())
  return req
})
vi.stubGlobal('indexedDB', { open })
const { openOfflineDb } = await import('./offlineDb')

beforeEach(() => {
  open.mockClear()
  opened.length = 0
})

describe('openOfflineDb', () => {
  it('الفتحُ مرّةٌ واحدة ما دامت القاعدةُ مفتوحة', async () => {
    const a = await openOfflineDb()
    const b = await openOfflineDb()
    expect(b).toBe(a)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('لسانٌ آخر يرقّي القاعدةَ: تُغلق هذه، وأوّلُ استعمالٍ بعدها يفتح من جديد', async () => {
    const first = await openOfflineDb() as unknown as FakeDb
    const callsBefore = open.mock.calls.length
    expect(first.onversionchange).toBeTypeOf('function')
    first.onversionchange!()
    expect(first.close).toHaveBeenCalledTimes(1)
    const second = await openOfflineDb()
    expect(open).toHaveBeenCalledTimes(callsBefore + 1)
    expect(second).not.toBe(first)
  })
})
