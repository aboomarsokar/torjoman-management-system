/**
 * حراسةُ useTransport: تحديثٌ أو حذفٌ لم يمسّ صفّاً (RLS: سُدّدت الرحلة) يُرمى لا يُعدّ نجاحاً،
 * والمبلغُ المجلوب رقمٌ، والتصفيةُ بالموظف تُضاف عند طلبها.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTransport } from './useTransport'

/** عميلٌ وهميّ يسجّل السلسلة ويُرجع `result` عند انتظارها. */
function fakeClient(result: { data: unknown, error: unknown }) {
  const calls: string[] = []
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lt', 'order', 'eq', 'update', 'delete', 'insert']) {
    chain[m] = (...args: unknown[]) => {
      calls.push(`${m}:${args.join(',')}`)
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(result)
  return { client: { from: () => chain }, calls }
}

function stub(result: { data: unknown, error: unknown }) {
  const f = fakeClient(result)
  vi.stubGlobal('useSupabaseClient', () => f.client)
  return f
}

const input = { id: 't1', trip_date: '2026-10-05', description: 'زيارة', amount: 20, notes: null }

afterEach(() => vi.unstubAllGlobals())

describe('useTransport', () => {
  it('تعديلٌ لم يمسّ صفّاً يرمي «لم يُحفظ»', async () => {
    stub({ data: [], error: null })
    await expect(useTransport().saveTrip(input)).rejects.toThrow('لم يُحفظ — قد تكون الرحلةُ سُدّدت.')
  })

  it('تعديلٌ مسَّ صفّاً ينجح', async () => {
    stub({ data: [{ id: 't1' }], error: null })
    await expect(useTransport().saveTrip(input)).resolves.toBeUndefined()
  })

  it('حذفٌ لم يمسّ صفّاً يرمي «لم تُحذف»', async () => {
    stub({ data: [], error: null })
    await expect(useTransport().deleteTrip('t1')).rejects.toThrow('لم تُحذف — قد تكون الرحلةُ سُدّدت.')
  })

  it('الجلبُ يحوّل المبلغ إلى رقم ويصفّي بالموظف عند طلبه', async () => {
    const { calls } = stub({ data: [{ id: 't1', amount: '12.50' }], error: null })
    const rows = await useTransport().fetchMonth(2026, 10, { profileId: 'p1' })
    expect(rows[0]?.amount).toBe(12.5)
    expect(calls).toContain('eq:profile_id,p1')
    expect(calls).toContain('gte:trip_date,2026-10-01')
    expect(calls).toContain('lt:trip_date,2026-11-01')
  })
})
