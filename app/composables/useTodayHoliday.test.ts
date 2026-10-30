/**
 * اختبارُ `useTodayHoliday` بلا Nuxt (الاستيراداتُ التلقائيّة محاكاة): يقرأ إجازةَ اليوم بسببها، وبلا إجازةٍ أو عند الفشل
 * `null` بلا رسالة، وبلا اتصالٍ لا يُرسَل طلبٌ أصلاً، وتُعاد القراءةُ حين يعود الاتصال.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'

const online = ref(true)
let result: { data: { reason: string } | null, error: unknown } = { data: null, error: null }
let throwOnRead = false
const eqDay = vi.fn()
const from = vi.fn()
let mounted: (() => void) | null = null

vi.mock('~/composables/useOfflineQueue', () => ({ queueOnline: online }))
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online.value }))
vi.mock('~/utils/reportWindow', () => ({ gazaToday: () => '2026-10-30' }))
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onMounted', (fn: () => void) => {
  mounted = fn
})
vi.stubGlobal('useSupabaseClient', () => ({
  from: (t: string) => {
    from(t)
    return {
      select: () => ({
        eq: (_c: string, day: string) => {
          eqDay(day)
          return { maybeSingle: () => (throwOnRead ? Promise.reject(new Error('شبكة')) : Promise.resolve(result)) }
        }
      })
    }
  }
}))
const { useTodayHoliday } = await import('./useTodayHoliday')

const flush = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

beforeEach(() => {
  online.value = true
  result = { data: null, error: null }
  throwOnRead = false
  eqDay.mockClear()
  from.mockClear()
  mounted = null
})

describe('useTodayHoliday', () => {
  it('يقرأ سببَ إجازة اليوم من attendance_holidays بيوم غزة', async () => {
    result = { data: { reason: 'عيد الفطر' }, error: null }
    const { reason } = useTodayHoliday()
    mounted?.()
    await flush()
    expect(from).toHaveBeenCalledWith('attendance_holidays')
    expect(eqDay).toHaveBeenCalledWith('2026-10-30')
    expect(reason.value).toBe('عيد الفطر')
  })

  it('يومٌ بلا إجازة: null', async () => {
    const { reason } = useTodayHoliday()
    mounted?.()
    await flush()
    expect(reason.value).toBeNull()
  })

  it('فشلُ القراءة (خطأٌ أو استثناء): null بلا ارتفاع خطأ', async () => {
    result = { data: null, error: { message: 'x' } }
    const { reason } = useTodayHoliday()
    mounted?.()
    await flush()
    expect(reason.value).toBeNull()
    throwOnRead = true
    mounted?.()
    await flush()
    expect(reason.value).toBeNull()
  })

  it('بلا اتصال: لا طلبَ أبداً', async () => {
    online.value = false
    const { reason } = useTodayHoliday()
    mounted?.()
    await flush()
    expect(from).not.toHaveBeenCalled()
    expect(reason.value).toBeNull()
  })

  it('عودةُ الاتصال تعيد القراءة', async () => {
    online.value = false
    result = { data: { reason: 'ظرف أمني' }, error: null }
    const { reason } = useTodayHoliday()
    mounted?.()
    await flush()
    expect(reason.value).toBeNull()
    online.value = true
    await flush()
    expect(reason.value).toBe('ظرف أمني')
  })
})
