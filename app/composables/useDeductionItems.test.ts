import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { DeductionItem } from '~/utils/visitForm'

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
vi.stubGlobal('useLazyAsyncData', (_key: string, fn: () => Promise<DeductionItem[]>) => {
  const data = ref<DeductionItem[]>([])
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
let fetchImpl: () => Promise<DeductionItem[]> = async () => []
vi.mock('~/utils/fieldScreens', () => ({ VISIT_ITEMS_KEY: 'visit-deduction-items', fetchDeductionItems: () => fetchImpl() }))
vi.stubGlobal('useOfflineCopy', (await import('./useOfflineCopy')).useOfflineCopy)
const { useDeductionItems } = await import('./useDeductionItems')

const item = (key: string): DeductionItem => ({ key, criterion: 1, criterion_label: 'معيار', criterion_hint: null, label: key, per_time: 1, sort_order: 1 })

beforeEach(() => {
  states.clear()
  store.clear()
  writes.length = 0
  handle.mockClear()
  online = true
  fetchImpl = async () => [item('a')]
})

describe('useDeductionItems', () => {
  it('متّصلاً: يجلب البنود ويحفظ نسختها ويجمعها في معايير', async () => {
    const { items, criteria } = useDeductionItems()
    await loading
    expect(items.value.map(i => i.key)).toEqual(['a'])
    expect(criteria.value).toHaveLength(1)
    expect(store.get('u|visit-deduction-items')?.data).toEqual([item('a')])
  })

  it('خطأُ الخادم متّصلاً لا يكتب نسخةً فارغة ويُعرض للمستخدم', async () => {
    store.set('u|visit-deduction-items', { savedAt: 'S', data: [item('old')] })
    fetchImpl = async () => {
      throw new Error('500')
    }
    const { items } = useDeductionItems()
    await loading
    expect(writes).toEqual([])
    expect(store.get('u|visit-deduction-items')?.data).toEqual([item('old')])
    expect(handle).toHaveBeenCalledTimes(1)
    expect(items.value).toEqual([])
  })

  it('بلا اتصالٍ تُقرأ النسخةُ ولا جلب', async () => {
    store.set('u|visit-deduction-items', { savedAt: 'S', data: [item('old')] })
    online = false
    fetchImpl = vi.fn(async () => [item('new')])
    const { items } = useDeductionItems()
    await loading
    expect(items.value.map(i => i.key)).toEqual(['old'])
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it('تعثّر الجلبُ فصار الجهازُ منقطعاً: النسخةُ لا الفراغ ولا رسالة خطأ', async () => {
    store.set('u|visit-deduction-items', { savedAt: 'S', data: [item('old')] })
    fetchImpl = async () => {
      online = false
      throw new Error('Failed to fetch')
    }
    const { items } = useDeductionItems()
    await loading
    expect(items.value.map(i => i.key)).toEqual(['old'])
    expect(writes).toEqual([])
    expect(handle).not.toHaveBeenCalled()
  })
})
