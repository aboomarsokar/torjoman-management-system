/** useStatementReview: طلبٌ واحد مقصورٌ على المُرسَل، ويُرجع ما تمّ، ويرمي الخطأ. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStatementReview } from './useStatementReview'

function stub(result: { data: unknown, error: unknown }) {
  const calls: string[] = []
  const chain: Record<string, unknown> = {}
  for (const m of ['update', 'in', 'eq', 'select']) {
    chain[m] = (...args: unknown[]) => {
      calls.push(`${m}:${typeof args[0] === 'object' && !Array.isArray(args[0]) ? 'obj' : args.join(',')}`)
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(result)
  vi.stubGlobal('useSupabaseClient', () => ({ from: () => chain }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('useStatementReview', () => {
  it('لا طلبَ بلا تحديد', async () => {
    const calls = stub({ data: [], error: null })
    expect(await useStatementReview().reviewMany([], 'u')).toEqual([])
    expect(calls).toEqual([])
  })
  it('يقصر على المُرسَل ويُرجع ما تمّ', async () => {
    const calls = stub({ data: [{ id: 'a' }], error: null })
    expect(await useStatementReview().reviewMany(['a', 'b'], 'u')).toEqual(['a'])
    expect(calls).toContain('in:id,a,b')
    expect(calls).toContain('eq:status,submitted')
  })
  it('يرمي الخطأ', async () => {
    stub({ data: null, error: new Error('x') })
    await expect(useStatementReview().reviewMany(['a'], 'u')).rejects.toThrow('x')
  })
})
