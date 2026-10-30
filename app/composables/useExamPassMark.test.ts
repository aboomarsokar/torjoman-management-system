import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاة، وتُركَ `useOfflineCopy` الحقيقيُّ بجهازٍ واتصالٍ محاكَيَين —
// فالمختبَرُ هنا تركيبُ الجلب مع النسخة: خطأُ الخادم متّصلاً لا يكتب نسخةً فارغة
const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, { value: init() })
  return states.get(key)
})
vi.stubGlobal('computed', computed)
vi.stubGlobal('useSupabaseClient', () => ({}))
const handle = vi.fn()
vi.stubGlobal('useErrorHandler', () => ({ handle }))
let loading: Promise<unknown> = Promise.resolve()
vi.stubGlobal('useLazyAsyncData', (_key: string, fn: () => Promise<number | null>) => {
  const data = ref<number | null>(null)
  loading = fn().then((v) => {
    data.value = v
  })
  return { data }
})
const store = new Map<string, { savedAt: string, data: unknown }>()
const writes: unknown[] = []
let online = true
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineSnapshot', () => ({
  offlineOwnerUid: () => 'u',
  readSnapshot: async (uid: string, key: string) => store.get(`${uid}|${key}`) ?? null,
  writeSnapshot: async (uid: string, key: string, data: unknown) => {
    writes.push(data)
    store.set(`${uid}|${key}`, { savedAt: 'T', data })
  }
}))
let fetchImpl: () => Promise<number | null> = async () => 80
vi.mock('~/utils/fieldScreens', () => ({ EXAMS_PASSMARK_KEY: 'exams-passmark', fetchPassMark: () => fetchImpl() }))
vi.stubGlobal('useOfflineCopy', (await import('./useOfflineCopy')).useOfflineCopy)
const { useExamPassMark } = await import('./useExamPassMark')

beforeEach(() => {
  states.clear()
  store.clear()
  writes.length = 0
  handle.mockClear()
  online = true
  fetchImpl = async () => 80
})

describe('useExamPassMark', () => {
  it('متّصلاً: يجلب الدرجة ويحفظ نسختها', async () => {
    const { passMark } = useExamPassMark()
    await loading
    expect(passMark.value).toBe(80)
    expect(store.get('u|exams-passmark')?.data).toBe(80)
  })

  it('بلا اتصال: الدرجةُ من النسخة', async () => {
    store.set('u|exams-passmark', { savedAt: 'T', data: 75 })
    online = false
    fetchImpl = async () => {
      throw new Error('Failed to fetch')
    }
    const { passMark } = useExamPassMark()
    await loading
    expect(passMark.value).toBe(75)
    expect(handle).not.toHaveBeenCalled()
  })

  it('بلا اتصالٍ وبلا نسخة: null لا درجةَ افتراضية ولا رسالةَ خطأ', async () => {
    online = false
    fetchImpl = async () => {
      throw new Error('Failed to fetch')
    }
    const { passMark } = useExamPassMark()
    await loading
    expect(passMark.value).toBeNull()
    expect(handle).not.toHaveBeenCalled()
  })

  it('خطأُ الخادم والاتصالُ قائم: يُعرض ولا تُكتب نسخةٌ فوق القديمة', async () => {
    store.set('u|exams-passmark', { savedAt: 'T', data: 75 })
    const err = new Error('500')
    fetchImpl = async () => {
      throw err
    }
    const { passMark } = useExamPassMark()
    await loading
    expect(handle).toHaveBeenCalledWith(err)
    expect(passMark.value).toBeNull()
    expect(writes).toHaveLength(0)
    expect(store.get('u|exams-passmark')?.data).toBe(75)
  })
})
