/** useQuranMidmonth: لا طلبَ ما دام التسليمُ معطَّلاً، والتسليمُ يستدعي الدالّة برأس الشهر ويحفظ وقتَه. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { useQuranMidmonth } from './useQuranMidmonth'

/** بدائلُ ref/computed/watch (بيئةُ الاختبار بلا Vue): قيمٌ عاديّة، والمحسوبُ يُقرأ عند الطلب. */
const ref = <T>(value: T) => ({ value }) as unknown as Ref<T>
function stubReactivity() {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', <T>(fn: () => T) => ({
    get value() {
      return fn()
    }
  }))
  vi.stubGlobal('watch', (_s: unknown, cb: () => void, opts?: { immediate?: boolean }) => {
    if (opts?.immediate) cb()
  })
}

function stub(rpc = vi.fn(async () => ({ data: 3, error: null }))) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) chain[m] = () => chain
  chain.maybeSingle = async () => ({ data: null, error: null })
  vi.stubGlobal('useSupabaseClient', () => ({ from: () => chain, rpc }))
  vi.stubGlobal('useErrorHandler', () => ({ handle: vi.fn() }))
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  stubReactivity()
  return rpc
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const base = () => ({
  reportId: ref<string | null>('r1'),
  year: ref(2026),
  month: ref(11),
  status: ref<string | null>('draft'),
  online: ref(true),
  pending: ref(0)
})

describe('useQuranMidmonth', () => {
  it('لا طلبَ في شهرٍ غير جارٍ', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-20T10:00:00Z'), toFake: ['Date'] })
    const rpc = stub()
    const o = { ...base(), month: ref(10) }
    const m = useQuranMidmonth(o)
    expect(m.block.value).toBe('رصدُ المنتصف للشهر الجاري وحده.')
    expect(await m.submit()).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('يسلّم برأس الشهر حين يُتاح', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-20T10:00:00Z'), toFake: ['Date'] })
    const rpc = stub()
    const m = useQuranMidmonth(base())
    expect(m.block.value).toBeNull()
    expect(await m.submit()).toBe(true)
    expect(rpc).toHaveBeenCalledWith('submit_quran_midmonth', { p_report: 'r1' })
    expect(m.submittedAt.value).not.toBeNull()
  })
})
