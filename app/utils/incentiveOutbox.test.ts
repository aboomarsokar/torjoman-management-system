import { describe, expect, it } from 'vitest'
import { incentiveSnapshotKey, incentiveSubmitBlock, newIncentiveEntry, settledSnapshot, uploadIncentiveDraft, type IncentiveEntry } from './incentiveOutbox'

const item = { description: 'جوائز المتفوّقين', category: 'جوائز', amount: 50, item_date: '2026-10-20' }

describe('incentiveOutbox', () => {
  it('سطرٌ واحدٌ لمسوّدة الشهر', () => {
    const e = newIncentiveEntry('u', 'h', 2026, 10, [item], new Date('2026-10-28T08:00:00Z'))
    expect(e.key).toBe('u|h|2026-10')
    expect(e).toMatchObject({ status: 'pending', attempts: 0, items: [item] })
    expect(incentiveSnapshotKey(2026, 10)).toBe('incentive-statement|2026-10')
  })

  it('الإرسالُ متّصلاً وحده', () => {
    expect(incentiveSubmitBlock(false)).toMatch(/يحتاج اتصالاً/)
    expect(incentiveSubmitBlock(true)).toBeNull()
  })

  it('بعد الرفع: نسخةُ الشهر تحمل البنودَ المرفوعة', () => {
    const e = newIncentiveEntry('u', 'h', 2026, 10, [item])
    const fresh = settledSnapshot({ allocated: 300, statement: null, items: [] }, e, 's1')
    expect(fresh).toEqual({ allocated: 300, statement: { id: 's1', status: 'draft', returnNote: null }, items: [item] })
    const returned = { id: 's0', status: 'draft' as const, returnNote: 'صحّح التاريخ' }
    expect(settledSnapshot({ allocated: 300, statement: returned, items: [] }, e, 's0').statement).toBe(returned)
  })
})

/** عميلٌ محاكًى يسجّل الخطوات بترتيبها ويردّ بما يُعطى. */
function fakeClient(state: { statement: { id: string, status: string } | null, oldIds: string[] }) {
  const steps: string[] = []
  const q = (table: string) => {
    const chain: Record<string, unknown> = {}
    let op = 'select'
    let payload: unknown
    const self = new Proxy(chain, {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (res: (v: unknown) => void) => {
            if (table === 'incentive_statement_items' && op === 'select') return res({ data: state.oldIds.map(id => ({ id })), error: null })
            steps.push(`${op}:${table}${op === 'insert' ? `:${(payload as unknown[]).length}` : ''}`)
            return res({ data: null, error: null })
          }
        }
        if (prop === 'maybeSingle') {
          return async () => ({ data: table === 'incentive_statements' ? state.statement : { allocated_amount: 200 }, error: null })
        }
        if (prop === 'single') {
          return async () => {
            steps.push(`insert:${table}`)
            return { data: { id: 'new' }, error: null }
          }
        }
        return (...args: unknown[]) => {
          if (prop === 'insert' || prop === 'delete') {
            op = prop
            payload = args[0]
          }
          return self
        }
      }
    })
    return self
  }
  return { client: { from: q } as never, steps }
}

describe('uploadIncentiveDraft', () => {
  const e: IncentiveEntry = newIncentiveEntry('u', 'h', 2026, 10, [item, item])

  it('كشفٌ جديد: يُنشأ ثمّ تُدرج البنود', async () => {
    const { client, steps } = fakeClient({ statement: null, oldIds: [] })
    expect(await uploadIncentiveDraft(client, e)).toEqual({ data: 'new', error: null })
    expect(steps).toEqual(['insert:incentive_statements', 'insert:incentive_statement_items:2'])
  })

  it('مسوّدةٌ قائمة: الجديدُ أوّلاً ثمّ حذفُ القديم', async () => {
    const { client, steps } = fakeClient({ statement: { id: 's', status: 'draft' }, oldIds: ['a', 'b'] })
    expect((await uploadIncentiveDraft(client, e)).error).toBeNull()
    expect(steps).toEqual(['insert:incentive_statement_items:2', 'delete:incentive_statement_items'])
  })

  it('كشفٌ أُرسل: يُرفض برسالةٍ عربية ولا يُمسّ', async () => {
    const { client, steps } = fakeClient({ statement: { id: 's', status: 'submitted' }, oldIds: ['a'] })
    const r = await uploadIncentiveDraft(client, e)
    expect(r.error?.code).toBe('P0001')
    expect(r.error?.message).toMatch(/أُرسل/)
    expect(steps).toEqual([])
  })
})
