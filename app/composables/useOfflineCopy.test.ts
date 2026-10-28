import { beforeEach, describe, expect, it, vi } from 'vitest'

// `useState` من استيراد Nuxt التلقائيّ — علبةُ قيمةٍ تكفي؛ والجهازُ والاتصالُ محاكَيان
const states = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, { value: init() })
  return states.get(key)
})
const store = new Map<string, { savedAt: string, data: unknown }>()
let teacher: string | null = 'u'
let online = true
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineSnapshot', () => ({
  offlineTeacherUid: () => teacher,
  readSnapshot: async (uid: string, key: string) => store.get(`${uid}|${key}`) ?? null,
  writeSnapshot: async (uid: string, key: string, data: unknown) => void store.set(`${uid}|${key}`, { savedAt: 'T', data })
}))
const { useOfflineCopy, useOfflineSavedKeys } = await import('./useOfflineCopy')

beforeEach(() => {
  store.clear()
  states.clear()
  teacher = 'u'
  online = true
})

describe('useOfflineCopy', () => {
  it('متّصلاً: يجلب ويحفظ النسخة', async () => {
    const out = await useOfflineCopy().wrap('k', async () => [1, 2])()
    expect(out).toEqual([1, 2])
    expect(store.get('u|k')?.data).toEqual([1, 2])
    expect(useOfflineSavedKeys().value).toEqual({})
  })

  it('بلا اتصال: النسخةُ بوقتها ولا جلب', async () => {
    store.set('u|k', { savedAt: '2026-10-27T08:00:00Z', data: ['saved'] })
    online = false
    const fetcher = vi.fn(async () => ['fresh'])
    expect(await useOfflineCopy().wrap('k', fetcher)()).toEqual(['saved'])
    expect(fetcher).not.toHaveBeenCalled()
    expect(useOfflineSavedKeys().value).toEqual({ k: '2026-10-27T08:00:00Z' })
  })

  it('تعثّر الجلبُ في الطريق: النسخةُ أصدق من الفراغ، ولا يُكتب الفراغُ فوقها', async () => {
    store.set('u|k', { savedAt: 'S', data: ['saved'] })
    const out = await useOfflineCopy().wrap('k', async () => {
      online = false
      return []
    })()
    expect(out).toEqual(['saved'])
    expect(store.get('u|k')?.data).toEqual(['saved'])
  })

  it('غيرُ المعلّم: جلبٌ عاديٌّ بلا نسخة', async () => {
    teacher = null
    expect(await useOfflineCopy().wrap('k', async () => ['x'])()).toEqual(['x'])
    expect(store.size).toBe(0)
  })

  it('مفتاحٌ يتبع الشهرَ المختار', async () => {
    let m = 10
    const wrapped = useOfflineCopy().wrap(() => `q|${m}`, async () => m)
    await wrapped()
    m = 11
    await wrapped()
    expect([...store.keys()]).toEqual(['u|q|10', 'u|q|11'])
  })
})
