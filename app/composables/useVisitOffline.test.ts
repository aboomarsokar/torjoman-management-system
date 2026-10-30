import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { VisitEntry } from '~/utils/visitOutbox'
import { groupCriteria, visitTotals } from '~/utils/visitForm'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاةٌ بعلب قيم، والصندوقُ والاتصالُ وصاحبُ الجهاز محاكَون —
// والمختبَرُ هنا قرارُ «أين يُحفظ التقييم» وما يُحفظ في سطره؛ ورفعُ السطر في utils/visitOutbox.test.ts
vi.stubGlobal('computed', computed)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('watch', watch)
const queued: VisitEntry[] = []
const pendingRows = ref<VisitEntry[]>([])
const lastUploaded = ref<{ entry: VisitEntry, data: unknown, at: number } | null>(null)
const put = vi.fn(async (e: VisitEntry) => void queued.push(e))
vi.stubGlobal('useOfflineQueue', () => ({
  pending: computed(() => pendingRows.value),
  rejected: computed(() => [{ key: 'u|v9', visitId: 'v9', error: 'x' }]),
  lastUploaded, retry: vi.fn(), discard: vi.fn(), put
}))
const listCopy = ref<{ id: string, halaqa: { name: string } | null }[] | undefined>(undefined)
vi.stubGlobal('useNuxtData', () => ({ data: listCopy }))
let owner: string | null = 'u'
let online = true
vi.mock('~/utils/offlineSnapshot', () => ({ offlineOwnerUid: () => owner }))
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineQueues', () => ({ VISIT_QUEUE: 'visits' }))
const { useVisitOffline, PENDING_UPLOAD_BADGE, VISIT_SAVED_ON_DEVICE } = await import('./useVisitOffline')
const { newVisitEntry } = await import('~/utils/visitOutbox')

const entry = (visitId: string) => newVisitEntry('u', visitId, { executedAt: '2026-10-20T12:00:00.000Z', deductions: { a: 1 }, notes: 'ن' })

beforeEach(() => {
  owner = 'u'
  online = true
  queued.length = 0
  pendingRows.value = []
  lastUploaded.value = null
  listCopy.value = undefined
  put.mockClear()
})

describe('useVisitOffline', () => {
  it('النصّان الظاهران حرفياً', () => {
    expect(PENDING_UPLOAD_BADGE).toBe('على جهازك — بانتظار الرفع')
    expect(VISIT_SAVED_ON_DEVICE).toBe('حُفظ التقييم على جهازك، ويُرفع حين يعود الاتصال.')
  })

  it('shouldQueue بلا اتصال للمشرف', () => {
    online = false
    expect(useVisitOffline().shouldQueue('v1')).toBe(true)
  })

  it('shouldQueue متّصلاً بلا سطرٍ معلَّق', () => {
    expect(useVisitOffline().shouldQueue('v1')).toBe(false)
  })

  it('shouldQueue متّصلاً وللزيارة سطرٌ معلَّق: كي لا يتخطّى حفظٌ جديدٌ قديمَه', () => {
    pendingRows.value = [entry('v1')]
    const v = useVisitOffline()
    expect(v.shouldQueue('v1')).toBe(true)
    expect(v.shouldQueue('v2')).toBe(false)
  })

  it('shouldQueue للمدير الفنيّ: false بلا uid ولو بلا اتصال', () => {
    owner = null
    online = false
    expect(useVisitOffline().shouldQueue('v1')).toBe(false)
  })

  it('saveOnDevice يضع سطراً بمفتاح uid|visitId ويومِ التنفيذ المختار', async () => {
    // يومٌ قبل اليوم: يبقى في السطر كما اختاره المشرف، لا يومَ الرفع
    const executedAt = '2026-10-20T12:00:00.000Z'
    await useVisitOffline().saveOnDevice('v1', { executedAt, deductions: { a: 2 }, notes: null })
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ key: 'u|v1', uid: 'u', visitId: 'v1', executedAt, deductions: { a: 2 }, notes: null, status: 'pending' })
  })

  it('pendingFor يردّ السطرَ لإعادة الفتح للقراءة', () => {
    const e = entry('v1')
    pendingRows.value = [e]
    const v = useVisitOffline()
    expect(v.pendingFor('v1')).toEqual(e)
    expect(v.pendingFor('v2')).toBeNull()
  })

  it('rejected: اسمُ الحلقة من نسخة القائمة إن وُجد وإلا «زيارة»', () => {
    expect(useVisitOffline().rejected.value).toEqual([{ key: 'u|v9', label: 'زيارة', error: 'x' }])
    listCopy.value = [{ id: 'v9', halaqa: { name: 'الفرقان' } }]
    expect(useVisitOffline().rejected.value[0]!.label).toBe('زيارة الفرقان')
  })

  it('badgeFor: شارةُ الانتظار للمعلَّق وحالةُ القاعدة لغيره', () => {
    pendingRows.value = [entry('v1')]
    const v = useVisitOffline()
    expect(v.badgeFor('v1', { label: 'مجدولة', color: 'info' })).toEqual({ label: PENDING_UPLOAD_BADGE, color: 'warning' })
    expect(v.badgeFor('v2', { label: 'مجدولة', color: 'info' })).toEqual({ label: 'مجدولة', color: 'info' })
  })

  describe('rowsFor', () => {
    const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, executed_at: null, locked_at: null, score: null, deductions: null, notes: null, status: 'scheduled', ...extra }) as never
    const items = ref([{ key: 'a', criterion: 1, criterion_label: 'م', criterion_hint: null, label: 'a', per_time: 1, sort_order: 1 }])

    it('يطبّق ما على الجهاز على صفّه وحده', () => {
      const e = entry('v1')
      pendingRows.value = [e]
      const rows = useVisitOffline().rowsFor(ref([row('v1'), row('v2')]), items)
      expect(rows.value[0]).toMatchObject({ id: 'v1', executed_at: e.executedAt, locked_at: e.recordedAt, score: visitTotals(groupCriteria(items.value), e.deductions).score })
      expect(rows.value[1]).toMatchObject({ id: 'v2', locked_at: null })
    })

    it('بعد الرفع: نتيجةُ القاعدة فوراً بلا رمشةٍ قبل refresh، ثم تُمحى حين تصل نسخةٌ جديدة', async () => {
      const e = entry('v1')
      pendingRows.value = [e]
      const fetched = ref([row('v1')])
      const rows = useVisitOffline().rowsFor(fetched, items)
      // رُفع السطرُ: يُحذف من الصندوق ويصل ردُّ القاعدة، والشاشةُ لم تجلب بعد
      pendingRows.value = []
      lastUploaded.value = { entry: e, data: { id: 'v1', executed_at: e.executedAt, locked_at: 'SERVER', score: 30, deductions: { a: 1 }, notes: 'ن', status: 'done' }, at: 1 }
      await nextTick()
      expect(rows.value[0]).toMatchObject({ locked_at: 'SERVER', score: 30, status: 'done' })
      // وصل الجلبُ (المدير فتح المقفلة في الأثناء): لا ترقيعَ قديماً فوقه
      fetched.value = [row('v1', { locked_at: null, status: 'done' })]
      await nextTick()
      expect(rows.value[0]).toMatchObject({ locked_at: null })
    })
  })
})
