import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاة، و`useOfflineCopy` الحقيقيُّ بجهازٍ واتصالٍ محاكَيَين —
// فالمختبَرُ تركيبُ الجلب مع النسخة: خطأُ الخادم متّصلاً لا يكتب نسخةً فارغة (كان يبتلعه فيحلّ الفراغُ محلّ النسخة)
const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, { value: init() })
  return states.get(key)
})
vi.stubGlobal('useSupabaseClient', () => ({}))
const handle = vi.fn()
vi.stubGlobal('useErrorHandler', () => ({ handle }))
const loading: Record<string, Promise<unknown>> = {}
vi.stubGlobal('useLazyAsyncData', (key: string, fn: () => Promise<unknown[]>) => {
  const data = ref<unknown[]>([])
  loading[key] = fn().then((v) => {
    data.value = v
  })
  return { data, refresh: vi.fn(), pending: ref(false) }
})
const store = new Map<string, { savedAt: string, data: unknown }>()
const writes: unknown[] = []
let online = true
let owner: string | null = 'u'
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineSnapshot', () => ({
  offlineOwnerUid: () => owner,
  readSnapshot: async (uid: string, key: string) => store.get(`${uid}|${key}`) ?? null,
  writeSnapshot: async (uid: string, key: string, data: unknown) => {
    writes.push(data)
    store.set(`${uid}|${key}`, { savedAt: 'T', data })
  }
}))
let visitsImpl: () => Promise<unknown[]> = async () => []
let halqatImpl: () => Promise<unknown[]> = async () => []
vi.mock('~/utils/teacherScreens', () => ({
  SCREEN_KEYS: { visits: 'visits-list', visitHalqat: 'visits-halqat' },
  fetchVisits: () => visitsImpl(),
  fetchVisitHalqat: () => halqatImpl()
}))
vi.stubGlobal('useOfflineCopy', (await import('./useOfflineCopy')).useOfflineCopy)
const { useVisitsData } = await import('./useVisitsData')

const settle = () => Promise.all(Object.values(loading))

beforeEach(() => {
  states.clear()
  store.clear()
  writes.length = 0
  handle.mockClear()
  online = true
  owner = 'u'
  visitsImpl = async () => [{ id: 'v1' }]
  halqatImpl = async () => [{ id: 'h1' }]
})

describe('useVisitsData', () => {
  it('متّصلاً: يجلب الزيارات والحلقات ويحفظ نسخةً لكلٍّ', async () => {
    const { fetched, halqat } = useVisitsData()
    await settle()
    expect(fetched.value).toEqual([{ id: 'v1' }])
    expect(halqat.value).toEqual([{ id: 'h1' }])
    expect(store.get('u|visits-list')?.data).toEqual([{ id: 'v1' }])
    expect(store.get('u|visits-halqat')?.data).toEqual([{ id: 'h1' }])
  })

  it('خطأُ الخادم متّصلاً (زيارات وحلقات): لا نسخةَ فارغة فوق القديمة، ويُعرض الخطأ', async () => {
    store.set('u|visits-list', { savedAt: 'S', data: [{ id: 'old' }] })
    store.set('u|visits-halqat', { savedAt: 'S', data: [{ id: 'oldh' }] })
    visitsImpl = async () => {
      throw new Error('500')
    }
    halqatImpl = async () => {
      throw new Error('57014')
    }
    const { fetched, halqat } = useVisitsData()
    await settle()
    expect(writes).toEqual([])
    expect(store.get('u|visits-list')?.data).toEqual([{ id: 'old' }])
    expect(store.get('u|visits-halqat')?.data).toEqual([{ id: 'oldh' }])
    expect(handle).toHaveBeenCalledTimes(2)
    expect(fetched.value).toEqual([])
    expect(halqat.value).toEqual([])
  })

  it('بلا اتصالٍ تُقرأ النسخةُ ولا جلب ولا رسالة', async () => {
    store.set('u|visits-list', { savedAt: 'S', data: [{ id: 'old' }] })
    store.set('u|visits-halqat', { savedAt: 'S', data: [{ id: 'oldh' }] })
    online = false
    visitsImpl = vi.fn(async () => [{ id: 'new' }])
    const { fetched, halqat } = useVisitsData()
    await settle()
    expect(fetched.value).toEqual([{ id: 'old' }])
    expect(halqat.value).toEqual([{ id: 'oldh' }])
    expect(visitsImpl).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it('تعثّر الجلبُ فصار الجهازُ منقطعاً: النسخةُ لا الفراغ ولا رسالة خطأ', async () => {
    store.set('u|visits-list', { savedAt: 'S', data: [{ id: 'old' }] })
    visitsImpl = async () => {
      online = false
      throw new Error('Failed to fetch')
    }
    const { fetched } = useVisitsData()
    await settle()
    expect(fetched.value).toEqual([{ id: 'old' }])
    expect(writes).toEqual([])
    expect(handle).not.toHaveBeenCalled()
  })

  it('الإدارةُ (بلا uid): الخطأُ يُعرض ولو بلا اتصال، كما كان', async () => {
    owner = null
    online = false
    visitsImpl = async () => {
      throw new Error('Failed to fetch')
    }
    const { fetched } = useVisitsData()
    await settle()
    expect(handle).toHaveBeenCalledTimes(1)
    expect(fetched.value).toEqual([])
  })
})
