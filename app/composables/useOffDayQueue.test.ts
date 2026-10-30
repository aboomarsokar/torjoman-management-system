/**
 * طابورُ بلاغات «لم تنعقد» المعلّقة (2026-10-30): التصفيةُ بالدور والجنس (نقيّة)، وسطرُ اليوم، وقراءةُ الطابور واعتمادُه ورفضُه
 * بلا Nuxt (الاستيراداتُ التلقائيّة محاكاة). الحكمُ الأخير للخادم؛ هنا نثبّت ما تفعله الواجهة.
 */
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const roleRef = ref<string | null>('field_supervisor')
const handle = vi.fn()
const blockIfReadOnly = vi.fn()
let rows: unknown[] = []
let queryError: unknown = null
let rpcError: unknown = null
const rpc = vi.fn(async () => ({ error: rpcError }))
const select = vi.fn()

/** باني استعلامٍ ينتظره `await` كما يفعل supabase-js. */
function builder() {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'returns']) {
    b[m] = (...args: unknown[]) => {
      if (m === 'select') select(...args)
      return b
    }
  }
  b.then = (ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: queryError }).then(ok, bad)
  return b
}
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useProfile', () => ({ role: roleRef }))
vi.stubGlobal('useSupabaseClient', () => ({ from: builder, rpc }))
vi.stubGlobal('useErrorHandler', () => ({ handle }))
vi.stubGlobal('useImpersonation', () => ({ blockIfReadOnly }))
const { useOffDayQueue, visibleQueue, offDayLine } = await import('./useOffDayQueue')

const row = (id: string, gender: string | null, over: Record<string, unknown> = {}) => ({
  id, halaqa_id: `h-${id}`, day: '2026-10-28', reason: 'security', note: null, reported_at: '2026-10-28T06:00:00Z',
  halaqa: { name: `حلقة ${id}`, gender }, reporter: { full_name: 'أحمد' }, ...over
})
const item = (id: string, gender: string | null) => ({
  id, halaqaId: `h-${id}`, halaqaName: id, halaqaGender: gender, day: '2026-10-28', reason: 'security' as const,
  note: null, reporterName: null, reportedAt: '2026-10-28T06:00:00Z'
})

describe('visibleQueue — ما للدور وحده', () => {
  const all = [item('m', 'male'), item('f', 'female'), item('x', null)]
  it('المدير الفنيّ يرى حلقات البنين وحدها', () => {
    expect(visibleQueue(all, 'technical_manager').map(i => i.id)).toEqual(['m'])
  })
  it('المديرة الإدارية ترى حلقات البنات وحدها', () => {
    expect(visibleQueue(all, 'women_admin').map(i => i.id)).toEqual(['f'])
  })
  it('المدير الإداريّ والمشرف الميداني يريان الكلّ', () => {
    expect(visibleQueue(all, 'admin_manager')).toHaveLength(3)
    expect(visibleQueue(all, 'field_supervisor')).toHaveLength(3)
  })
  it('مشرف المشروع والمعلّم وبلا دور: لا شيء', () => {
    expect(visibleQueue(all, 'project_supervisor')).toEqual([])
    expect(visibleQueue(all, 'teacher')).toEqual([])
    expect(visibleQueue(all, null)).toEqual([])
  })
})

describe('offDayLine', () => {
  it('dd/mm واسمُ اليوم (الشهر بالرقم)', () => {
    expect(offDayLine('2026-10-28')).toBe('28/10 · الأربعاء')
    expect(offDayLine('2026-09-05')).toBe('05/09 · السبت')
  })
})

describe('useOffDayQueue', () => {
  it('load: يقرأ المعلّق ويحوّل الصفوف، ويسقط ما سببُه مجهول', async () => {
    roleRef.value = 'admin_manager'
    rows = [row('a', 'male', { note: 'مطر' }), row('b', 'female', { reason: 'bogus' })]
    const q = useOffDayQueue()
    await q.load()
    expect(q.items.value).toHaveLength(1)
    expect(q.items.value[0]).toMatchObject({ id: 'a', halaqaName: 'حلقة a', halaqaGender: 'male', note: 'مطر', reporterName: 'أحمد' })
    expect(q.loading.value).toBe(false)
  })

  it('load: مشرفُ المشروع لا يسأل القاعدة أصلاً', async () => {
    roleRef.value = 'project_supervisor'
    select.mockClear()
    const q = useOffDayQueue()
    await q.load()
    expect(select).not.toHaveBeenCalled()
    expect(q.items.value).toEqual([])
  })

  it('load: الخطأ يُعرض والقائمةُ فارغة', async () => {
    roleRef.value = 'admin_manager'
    queryError = { message: 'boom' }
    handle.mockClear()
    const q = useOffDayQueue()
    await q.load()
    expect(handle).toHaveBeenCalled()
    expect(q.items.value).toEqual([])
    queryError = null
  })

  it('review بالقبول: يخرج البندُ فوراً ولا ملاحظةَ تُرسل', async () => {
    roleRef.value = 'admin_manager'
    rows = [row('a', 'male'), row('b', 'male')]
    const q = useOffDayQueue()
    await q.load()
    rpc.mockClear()
    expect(await q.review('a', true, 'يُهمَل')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('review_off_day', { p_id: 'a', p_approve: true, p_note: undefined })
    expect(q.items.value.map(i => i.id)).toEqual(['b'])
  })

  it('review بالرفض: الملاحظةُ تُشذَّب، وفارغتها لا تُرسل', async () => {
    roleRef.value = 'admin_manager'
    rows = [row('a', 'male'), row('b', 'male')]
    const q = useOffDayQueue()
    await q.load()
    rpc.mockClear()
    await q.review('a', false, '  لم يتبيّن العذر  ')
    expect(rpc).toHaveBeenLastCalledWith('review_off_day', { p_id: 'a', p_approve: false, p_note: 'لم يتبيّن العذر' })
    await q.review('b', false, '   ')
    expect(rpc).toHaveBeenLastCalledWith('review_off_day', { p_id: 'b', p_approve: false, p_note: undefined })
  })

  it('review الفاشل: يبقى البندُ، ويُعرض الخطأ، ويُعاد جلبُ الطابور', async () => {
    roleRef.value = 'admin_manager'
    rows = [row('a', 'male')]
    const q = useOffDayQueue()
    await q.load()
    rpcError = { message: 'denied' }
    handle.mockClear()
    select.mockClear()
    expect(await q.review('a', true, null)).toBe(false)
    expect(handle).toHaveBeenCalled()
    expect(select).toHaveBeenCalledTimes(1)
    expect(q.items.value.map(i => i.id)).toEqual(['a'])
    rpcError = null
  })

  it('review في نيابة القراءة: يُمنع قبل الإرسال', async () => {
    roleRef.value = 'admin_manager'
    rows = [row('a', 'male')]
    const q = useOffDayQueue()
    await q.load()
    blockIfReadOnly.mockImplementationOnce(() => {
      throw new Error('وضع القراءة')
    })
    rpc.mockClear()
    expect(await q.review('a', true, null)).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
    expect(handle).toHaveBeenCalled()
  })
})
