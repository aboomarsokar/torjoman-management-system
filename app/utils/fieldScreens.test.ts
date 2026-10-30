import { describe, expect, it } from 'vitest'
import { EXAMS_PASSMARK_KEY, EXAMS_QUEUE_KEY, fetchDeductionItems, fetchExamQueue, fetchPassMark, VISIT_ITEMS_KEY } from './fieldScreens'

/** عميلٌ محاكًى: السلسلةُ تنتهي بـ`order` فيردّ بما يُعطى. */
function fakeClient(result: { data: unknown, error: unknown }) {
  const seen: { table?: string, columns?: string, order?: string } = {}
  const chain = {
    select(columns: string) {
      seen.columns = columns
      return chain
    },
    order(col: string) {
      seen.order = col
      return Promise.resolve(result)
    }
  }
  const from = (t: string) => {
    seen.table = t
    return chain
  }
  return { client: { from } as never, seen }
}

describe('fieldScreens', () => {
  it('fetchDeductionItems يجلب بنودَ الخصم بترتيبها', async () => {
    const rows = [{ key: 'a' }]
    const { client, seen } = fakeClient({ data: rows, error: null })
    expect(await fetchDeductionItems(client)).toBe(rows)
    expect(seen).toMatchObject({ table: 'visit_deduction_items', order: 'sort_order' })
    expect(VISIT_ITEMS_KEY).toBe('visit-deduction-items')
  })

  it('fetchDeductionItems يرمي خطأ supabase', async () => {
    const err = { code: '42501', message: 'denied' }
    const { client } = fakeClient({ data: null, error: err })
    await expect(fetchDeductionItems(client)).rejects.toBe(err)
  })

  /** عميلٌ محاكًى لطابور الرصد: السلسلةُ تنتهي بـ`returns` فيردّ بما يُعطى، ويلتقط الشروطَ والحدّ. */
  function fakeQueueClient(result: { data: unknown, error: unknown }) {
    const seen: { table?: string, columns?: string, not?: unknown[], is?: unknown[], order?: unknown[], limit?: number } = {}
    const chain = {
      select(columns: string) {
        seen.columns = columns
        return chain
      },
      not(...a: unknown[]) {
        seen.not = a
        return chain
      },
      is(...a: unknown[]) {
        seen.is = a
        return chain
      },
      order(...a: unknown[]) {
        seen.order = a
        return chain
      },
      limit(n: number) {
        seen.limit = n
        return chain
      },
      returns: () => Promise.resolve(result)
    }
    return { client: { from: (t: string) => ((seen.table = t), chain) } as never, seen }
  }

  it('fetchExamQueue يجلب البنودَ بلا نتيجةٍ بدورتها، الأحدثَ أولاً، بسقف 500', async () => {
    const rows = [{ id: 'i1' }]
    const { client, seen } = fakeQueueClient({ data: rows, error: null })
    expect(await fetchExamQueue(client)).toBe(rows)
    expect(seen).toMatchObject({
      table: 'exam_list_items', not: ['exam_cycle_id', 'is', null], is: ['exam_results', null],
      order: ['created_at', { ascending: false }], limit: 500
    })
    expect(EXAMS_QUEUE_KEY).toBe('exams-queue')
  })

  it('fetchExamQueue بلا بياناتٍ يردّ مصفوفةً فارغة ويرمي خطأ supabase', async () => {
    expect(await fetchExamQueue(fakeQueueClient({ data: null, error: null }).client)).toEqual([])
    const err = { code: '42501', message: 'denied' }
    await expect(fetchExamQueue(fakeQueueClient({ data: null, error: err }).client)).rejects.toBe(err)
  })

  /** عميلٌ محاكًى لدرجة النجاح: `select().eq().maybeSingle()`. */
  function fakePassMarkClient(result: { data: unknown, error: unknown }) {
    const seen: { table?: string, columns?: string, eq?: unknown[] } = {}
    const chain = {
      select(columns: string) {
        seen.columns = columns
        return chain
      },
      eq(...a: unknown[]) {
        seen.eq = a
        return chain
      },
      maybeSingle: () => Promise.resolve(result)
    }
    return { client: { from: (t: string) => ((seen.table = t), chain) } as never, seen }
  }

  it('fetchPassMark يقرأ درجة النجاح من الإعدادات، وnull إن غابت', async () => {
    const { client, seen } = fakePassMarkClient({ data: { pass_mark: 85 }, error: null })
    expect(await fetchPassMark(client)).toBe(85)
    expect(seen).toMatchObject({ table: 'app_settings', columns: 'pass_mark', eq: ['id', 1] })
    expect(await fetchPassMark(fakePassMarkClient({ data: null, error: null }).client)).toBeNull()
    expect(EXAMS_PASSMARK_KEY).toBe('exams-passmark')
  })

  it('fetchPassMark يرمي خطأ supabase', async () => {
    const err = { code: '42501', message: 'denied' }
    await expect(fetchPassMark(fakePassMarkClient({ data: null, error: err }).client)).rejects.toBe(err)
  })
})
