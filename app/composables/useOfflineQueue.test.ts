import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueEntry } from './useOfflineQueue'

// الصندوقُ يستعمل `ref` من استيراد Nuxt التلقائيّ (بيئةُ الاختبار بلا Vue — تكفي علبةُ قيمة)؛ والجهازُ والاتصالُ محاكَيان
vi.stubGlobal('ref', <T>(value: T) => ({ value }))
const db = new Map<string, QueueEntry>()
vi.mock('~/utils/offlineDb', () => ({
  idbGet: async (_s: string, k: string) => db.get(k),
  idbGetAll: async () => [...db.values()],
  idbPut: async (_s: string, v: QueueEntry) => void db.set(v.key, v),
  idbDelete: async (_s: string, k: string) => void db.delete(k)
}))
let online = true
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))

const { defineOfflineQueue, flushQueue, loadQueue } = await import('./useOfflineQueue')

type E = QueueEntry & { n: number }
const entry = (n: number, at = '2026-10-27T08:00:00Z'): E =>
  ({ key: `k${n}`, uid: 'u', recordedAt: at, attempts: 0, status: 'pending', n })

type Reply = { data: unknown, error: { code?: string, message?: string } | null }
let replies: Record<number, Reply> = {}
const settled: number[] = []
const uploaded: number[] = []
let duringUpload: ((e: E) => void) | null = null
defineOfflineQueue<E>('t', {
  store: 'quran_outbox',
  order: (a, b) => a.n - b.n,
  upload: async (_s, e) => {
    uploaded.push(e.n)
    duringUpload?.(e)
    return replies[e.n] ?? { data: null, error: null }
  },
  settle: async (e) => {
    settled.push(e.n)
  }
})
let sessionUid: string | null = 'u'
// الرفعُ محاكًى فلا يُمسّ العميل: جلسةٌ وتجديدٌ فقط
const supabase = {
  auth: {
    refreshSession: async () => ({}),
    getSession: async () => ({ data: { session: sessionUid ? { user: { id: sessionUid } } : null } })
  }
} as unknown as Parameters<typeof flushQueue>[1]

async function seed(...es: E[]) {
  db.clear()
  for (const e of es) db.set(e.key, e)
  await loadQueue('t')
}

beforeEach(() => {
  vi.useFakeTimers()
  online = true
  sessionUid = 'u'
  replies = {}
  settled.length = 0
  uploaded.length = 0
  duringUpload = null
})

describe('flushQueue', () => {
  it('يرفع الأقدمَ أوّلاً ويمحو المرفوعَ ويُتمّه', async () => {
    await seed(entry(2), entry(1))
    await flushQueue('t', supabase)
    expect(uploaded).toEqual([1, 2])
    expect(settled).toEqual([1, 2])
    expect(db.size).toBe(0)
  })

  it('المرفوضُ يُعلَّم ويمضي الرفعُ إلى غيره', async () => {
    replies[1] = { data: null, error: { code: 'P0001', message: 'الشهر معتمد' } }
    await seed(entry(1), entry(2))
    await flushQueue('t', supabase)
    expect(db.get('k1')?.status).toBe('rejected')
    expect(db.has('k2')).toBe(false)
  })

  it('فشلُ الشبكة يقف ويُعاد لاحقاً بمحاولةٍ محسوبة', async () => {
    replies[1] = { data: null, error: { message: 'Failed to fetch' } }
    await seed(entry(1), entry(2))
    await flushQueue('t', supabase)
    expect(uploaded).toEqual([1])
    expect(db.get('k1')?.attempts).toBe(1)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('منقطعاً لا يطلب شيئاً ويعيد الفحصَ بعد مهلة', async () => {
    online = false
    await seed(entry(1))
    await flushQueue('t', supabase)
    expect(uploaded).toEqual([])
    expect(vi.getTimerCount()).toBe(1)
  })

  it('بلا جلسةٍ لا يُرفع شيءٌ ولا يُعلَّم مرفوضاً (صفحةُ الدخول)', async () => {
    sessionUid = null
    await seed(entry(1))
    await flushQueue('t', supabase)
    expect(uploaded).toEqual([])
    expect(db.get('k1')?.status).toBe('pending')
  })

  it('لا يُرفع سطرُ معلّمٍ آخر بجلسةٍ ليست له', async () => {
    sessionUid = 'other'
    await seed(entry(1))
    await flushQueue('t', supabase)
    expect(uploaded).toEqual([])
  })

  it('سطرٌ أُعيد حفظُه أثناء الرفع لا يُمحى بنجاح نسخته القديمة', async () => {
    await seed(entry(1))
    duringUpload = e => void db.set(e.key, { ...e, recordedAt: '2026-10-27T09:00:00Z' })
    await flushQueue('t', supabase)
    expect(db.get('k1')?.recordedAt).toBe('2026-10-27T09:00:00Z')
  })
})
