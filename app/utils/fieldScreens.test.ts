import { describe, expect, it } from 'vitest'
import { fetchDeductionItems, VISIT_ITEMS_KEY } from './fieldScreens'

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
})
