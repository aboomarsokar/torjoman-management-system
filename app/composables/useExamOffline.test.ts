import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ExamEntry, ExamPayload } from '~/utils/examOutbox'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاةٌ بعلب قيم، والصندوقُ والاتصالُ وصاحبُ الجهاز محاكَون —
// والمختبَرُ هنا قرارُ «أين تُحفظ النتيجة» وما يُعرض من سطورها؛ ورفعُ السطر في utils/examOutbox.test.ts
vi.stubGlobal('computed', computed)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('watch', watch)
const queued: ExamEntry[] = []
const rows = ref<ExamEntry[]>([])
const lastUploaded = ref<{ entry: ExamEntry, data: unknown, at: number } | null>(null)
const put = vi.fn(async (e: ExamEntry) => void queued.push(e))
vi.stubGlobal('useOfflineQueue', () => ({
  entries: computed(() => rows.value),
  pending: computed(() => rows.value.filter(e => e.status === 'pending')),
  rejected: computed(() => rows.value.filter(e => e.status === 'rejected')),
  lastUploaded, retry: vi.fn(), discard: vi.fn(), put
}))
let owner: string | null = 'u'
let online = true
vi.mock('~/utils/offlineSnapshot', () => ({ offlineOwnerUid: () => owner }))
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineQueues', () => ({ EXAM_QUEUE: 'exams' }))
const { useExamOffline, EXAM_SAVED_ON_DEVICE } = await import('./useExamOffline')
const { newExamEntry } = await import('~/utils/examOutbox')

const payload = (extra: Partial<ExamPayload> = {}): ExamPayload => ({
  student_id: 's', exam_list_item_id: 'i', examiner_id: 'u', pass_mark_snapshot: 80, exam_date: '2026-10-28',
  q1_memorization: 10, q1_understanding: 10, q1_reflection: 10,
  q2_memorization: 10, q2_understanding: 10, q2_reflection: 10,
  q3_memorization: 10, q3_understanding: 10, q3_reflection: 10,
  tajweed_score: 7, notes: null, ...extra
})
const item = (id: string) => ({ id, studentName: `طالب ${id}`, title: 'المحطة الأولى' })
const entry = (id: string, extra: Partial<ExamPayload> = {}) => newExamEntry('u', item(id), payload({ exam_list_item_id: id, ...extra }))

beforeEach(() => {
  owner = 'u'
  online = true
  queued.length = 0
  rows.value = []
  lastUploaded.value = null
  put.mockClear()
})

describe('useExamOffline', () => {
  it('النصُّ الظاهر حرفياً', () => {
    expect(EXAM_SAVED_ON_DEVICE).toBe('حُفظت النتيجة على جهازك، وتُرفع حين يعود الاتصال.')
  })

  it('saveOnDevice يضع سطراً بمفتاح uid|itemId وexam_date يومَ الحفظ', async () => {
    const day = '2026-10-28'
    await useExamOffline(ref(80)).saveOnDevice(item('i1'), payload({ exam_date: day }))
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ key: 'u|i1', uid: 'u', itemId: 'i1', studentName: 'طالب i1', status: 'pending' })
    expect(queued[0]!.payload.exam_date).toBe(day)
  })

  it('saveOnDevice يثبّت examiner_id صاحبَ الجهاز في الحمولة (شرطُ RLS وكشفُ الردّ الضائع)', async () => {
    await useExamOffline(ref(80)).saveOnDevice(item('i1'), payload({ examiner_id: null }))
    expect(queued[0]!.payload.examiner_id).toBe('u')
  })

  it('saveOnDevice بلا uid لا يضع شيئاً', async () => {
    owner = null
    await useExamOffline(ref(80)).saveOnDevice(item('i1'), payload())
    expect(put).not.toHaveBeenCalled()
  })

  it('pending تحسب المجموعَ والحكم', () => {
    // 9 × 10 + تجويد 7 = 97
    rows.value = [entry('a')]
    const [p] = useExamOffline(ref(80)).pending.value
    expect(p).toEqual({ key: 'u|a', studentName: 'طالب a', title: 'المحطة الأولى', total: 97, verdict: 'passed' })
  })

  it('pending تحكم بالدرجة الحاليّة: مجموعٌ دونها لم يجتز', () => {
    rows.value = [entry('a', { q1_memorization: 0, q1_understanding: 0, q1_reflection: 0, q2_memorization: 0 })]
    expect(useExamOffline(ref(80)).pending.value[0]).toMatchObject({ total: 57, verdict: 'failed' })
  })

  it('بلا درجة نجاحٍ محفوظة لا حكم', () => {
    rows.value = [entry('a')]
    expect(useExamOffline(ref(null)).pending.value[0]!.verdict).toBeNull()
  })

  it('pending لا تحمل المرفوض', () => {
    rows.value = [{ ...entry('a'), status: 'rejected' }, entry('b')]
    expect(useExamOffline(ref(80)).pending.value.map(p => p.key)).toEqual(['u|b'])
  })

  it('shouldQueue بلا اتصال للمختبِر', () => {
    online = false
    expect(useExamOffline(ref(80)).shouldQueue()).toBe(true)
  })

  it('shouldQueue متّصلاً ← false', () => {
    expect(useExamOffline(ref(80)).shouldQueue()).toBe(false)
  })

  it('shouldQueue بلا uid ← false ولو بلا اتصال (المدير الفنيّ أو النيابة)', () => {
    owner = null
    online = false
    expect(useExamOffline(ref(80)).shouldQueue()).toBe(false)
  })

  it('rejected تحمل اسمَ الطالب ورسالةَ القاعدة', () => {
    rows.value = [{ ...entry('a'), status: 'rejected', error: 'رُصدت نتيجةُ هذا الطالب قبل رفع نتيجتك.' }]
    expect(useExamOffline(ref(80)).rejected.value).toEqual([
      { key: 'u|a', label: 'طالب a', error: 'رُصدت نتيجةُ هذا الطالب قبل رفع نتيجتك.' }
    ])
  })

  describe('rowsFor', () => {
    it('يُسقط ما على الجهاز معلَّقاً أو مرفوضاً', () => {
      rows.value = [entry('a'), { ...entry('b'), status: 'rejected' }]
      const fetched = ref([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
      expect(useExamOffline(ref(80)).rowsFor(fetched).value).toEqual([{ id: 'c' }])
    })

    it('لا رمشة: السطرُ يُحذف من الصندوق قبل ضبط lastUploaded والبندُ لا يظهر بينهما', () => {
      rows.value = [entry('a')]
      const fetched = ref([{ id: 'a' }, { id: 'c' }])
      const shown = useExamOffline(ref(80)).rowsFor(fetched)
      expect(shown.value).toEqual([{ id: 'c' }])
      // `useOfflineQueue`: يُحذف السطرُ ثم `await settle` ثم `lastUploaded` — وبينهما رسم
      rows.value = []
      expect(shown.value).toEqual([{ id: 'c' }])
      lastUploaded.value = { entry: entry('a'), data: null, at: 1 }
      expect(shown.value).toEqual([{ id: 'c' }])
    })

    it('مرفوضٌ يُتجاهَل (discard) يعود إلى الطابور ولا يُسجَّل مرفوعاً', () => {
      rows.value = [{ ...entry('a'), status: 'rejected' }]
      const fetched = ref([{ id: 'a' }, { id: 'c' }])
      const shown = useExamOffline(ref(80)).rowsFor(fetched)
      rows.value = []
      expect(shown.value).toEqual([{ id: 'a' }, { id: 'c' }])
    })

    it('معلَّقٌ صار مرفوضاً (يبقى مفتاحُه) لا يُسجَّل مرفوعاً', () => {
      rows.value = [entry('a')]
      const fetched = ref([{ id: 'a' }, { id: 'c' }])
      const shown = useExamOffline(ref(80)).rowsFor(fetched)
      rows.value = [{ ...entry('a'), status: 'rejected' }]
      rows.value = []
      expect(shown.value).toEqual([{ id: 'a' }, { id: 'c' }])
    })

    it('تصل نسخةٌ لا تحويه فينتهي الإسقاطُ (يعود إن أعادته القاعدة لاحقاً)', async () => {
      rows.value = [entry('a')]
      const fetched = ref([{ id: 'a' }, { id: 'c' }])
      const shown = useExamOffline(ref(80)).rowsFor(fetched)
      rows.value = []
      fetched.value = [{ id: 'c' }]
      await nextTick()
      expect(shown.value).toEqual([{ id: 'c' }])
      fetched.value = [{ id: 'a' }, { id: 'c' }]
      await nextTick()
      expect(shown.value).toHaveLength(2)
    })

    it('سباقُ رفعين: نسخةٌ قديمةٌ تصل بعد الرفع الثاني لا تُعيد بندَه', async () => {
      rows.value = [entry('a'), entry('b')]
      const fetched = ref([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
      const shown = useExamOffline(ref(80)).rowsFor(fetched)
      rows.value = [entry('b')] // رُفع a
      rows.value = [] // ثم رُفع b
      // نسخةُ refresh الأوّل (بدأت بعد رفع a وقبل رفع b) تصل وفيها b
      fetched.value = [{ id: 'b' }, { id: 'c' }]
      await nextTick()
      expect(shown.value).toEqual([{ id: 'c' }])
      // نسخةُ refresh الثاني: بلا b فينتهي إسقاطُه
      fetched.value = [{ id: 'c' }]
      await nextTick()
      expect(shown.value).toEqual([{ id: 'c' }])
    })
  })
})
