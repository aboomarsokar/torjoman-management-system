import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifySyncError } from './attendanceOutbox'
import { EXAM_GRADED_BY_OTHER, examTotal, newExamEntry, passVerdict, uploadExamResult, withoutPending, type ExamPayload } from './examOutbox'

const payload = (extra: Partial<ExamPayload> = {}): ExamPayload => ({
  student_id: 's', exam_list_item_id: 'i', examiner_id: 'u', pass_mark_snapshot: 80, exam_date: '2026-10-28',
  q1_memorization: 10, q1_understanding: 10, q1_reflection: 10,
  q2_memorization: 10, q2_understanding: 10, q2_reflection: 10,
  q3_memorization: 10, q3_understanding: 10, q3_reflection: 10,
  tajweed_score: 9, notes: null, ...extra
})
const item = { id: 'i', studentName: 'طالب', title: 'المحطة الأولى' }

type Err = { code?: string, message?: string }

/** عميلٌ محاكًى: `insert` يلتقط الحمولةَ ويردّ بما يُعطى، والقراءةُ (`select().eq().maybeSingle()`) تردّ بالنتيجة الموجودة. */
function fakeClient(insertError: Err | null, existing: { data: { examiner_id: string | null } | null, error: Err | null } = { data: null, error: null }) {
  const seen: { body?: unknown, table?: string, column?: string, itemId?: unknown } = {}
  const table = {
    insert(body: unknown) {
      seen.body = body
      return Promise.resolve({ error: insertError })
    },
    select(columns: string) {
      seen.column = columns
      return table
    },
    eq(_col: string, id: unknown) {
      seen.itemId = id
      return table
    },
    maybeSingle: () => Promise.resolve(existing)
  }
  return { client: { from: (t: string) => ((seen.table = t), table) } as never, seen }
}

describe('examOutbox', () => {
  afterEach(() => vi.useRealTimers())

  it('newExamEntry يثبّت المفتاح والحمولةَ ووقتَ الحفظ', () => {
    const e = newExamEntry('u', item, payload(), new Date('2026-10-28T20:59:00Z'))
    expect(e.key).toBe('u|i')
    expect(e.recordedAt).toBe('2026-10-28T20:59:00.000Z')
    expect(e).toMatchObject({ uid: 'u', itemId: 'i', studentName: 'طالب', title: 'المحطة الأولى', status: 'pending', attempts: 0 })
  })

  it('newExamEntry يحفظ exam_date يومَ الرصد', async () => {
    const e = newExamEntry('u', item, payload({ exam_date: '2026-10-28' }), new Date('2026-10-28T20:59:00Z'))
    // الرفعُ بعد منتصف الليل بتوقيت غزة
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T01:30:00Z'))
    const { client, seen } = fakeClient(null)
    const r = await uploadExamResult(client, e)
    expect(r).toEqual({ data: null, error: null })
    expect(seen.table).toBe('exam_results')
    expect((seen.body as ExamPayload).exam_date).toBe('2026-10-28')
  })

  it('23505 وراصدُها صاحبُ السطر نجاحٌ (ردٌّ ضائع)', async () => {
    const e = newExamEntry('u', item, payload())
    const { client, seen } = fakeClient({ code: '23505' }, { data: { examiner_id: 'u' }, error: null })
    const r = await uploadExamResult(client, e)
    expect(r.error).toBeNull()
    expect(seen.column).toBe('examiner_id')
    expect(seen.itemId).toBe('i')
  })

  it('23505 وراصدُها غيرُه رفض', async () => {
    const e = newExamEntry('u', item, payload())
    const { client } = fakeClient({ code: '23505' }, { data: { examiner_id: 'other' }, error: null })
    const r = await uploadExamResult(client, e)
    expect(r.error?.message).toBe(EXAM_GRADED_BY_OTHER)
    expect(classifySyncError(r.error)).toBe('reject')
  })

  it('23505 وتعذّرت قراءةُ الراصد: يُعاد خطأُ القراءة فيُعاد لاحقاً لا يُعدّ نجاحاً', async () => {
    const e = newExamEntry('u', item, payload())
    const readErr = { code: '', message: 'Failed to fetch' }
    const { client } = fakeClient({ code: '23505' }, { data: null, error: readErr })
    const r = await uploadExamResult(client, e)
    expect(r.error).toBe(readErr)
    expect(classifySyncError(r.error)).toBe('retry')
  })

  it('23503 (سُحب الترشيح) يمرّ رفضاً', async () => {
    const e = newExamEntry('u', item, payload())
    const err = { code: '23503', message: 'fk' }
    const { client } = fakeClient(err)
    const r = await uploadExamResult(client, e)
    expect(r.error).toBe(err)
    expect(classifySyncError(r.error)).toBe('reject')
  })

  it('خطأُ شبكةٍ يُردّ كما هو ويُعاد', async () => {
    const e = newExamEntry('u', item, payload())
    const err = { message: 'Failed to fetch' }
    const { client } = fakeClient(err)
    const r = await uploadExamResult(client, e)
    expect(r.error).toBe(err)
    expect(classifySyncError(r.error)).toBe('retry')
  })

  it('examTotal يجمع العشر', () => {
    expect(examTotal(payload())).toBe(99)
    expect(examTotal(payload({ q1_memorization: 9.5, tajweed_score: 7.5 }))).toBe(97)
  })

  it('passVerdict', () => {
    expect(passVerdict(85, 80)).toBe('passed')
    expect(passVerdict(80, 80)).toBe('passed')
    expect(passVerdict(79.5, 80)).toBe('failed')
    // درجةُ النجاح غيرُ محفوظةٍ على الجهاز: لا حكمَ بقيمةٍ افتراضية
    expect(passVerdict(99, null)).toBeNull()
  })

  it('withoutPending يُسقط المرصودَ على الجهاز', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const out = withoutPending(rows, [newExamEntry('u', { ...item, id: 'b' }, payload())])
    expect(out).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(withoutPending(rows, [])).toBe(rows)
  })
})
