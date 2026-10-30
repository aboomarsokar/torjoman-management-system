import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { VisitEntry } from '~/utils/visitOutbox'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاةٌ بعلب قيم، والصندوقُ والاتصالُ وصاحبُ الجهاز محاكَون —
// والمختبَرُ هنا قرارُ «أين يُحفظ التقييم» وما يُحفظ في سطره؛ ورفعُ السطر في utils/visitOutbox.test.ts
vi.stubGlobal('computed', computed)
const queued: VisitEntry[] = []
const pendingRows = ref<VisitEntry[]>([])
const put = vi.fn(async (e: VisitEntry) => void queued.push(e))
vi.stubGlobal('useOfflineQueue', () => ({
  pending: computed(() => pendingRows.value),
  rejected: computed(() => [{ key: 'u|v9', visitId: 'v9', error: 'x' }]),
  lastUploaded: ref(null), retry: vi.fn(), discard: vi.fn(), put
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
})
