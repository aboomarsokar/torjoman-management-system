/** useMidmonthFollowup: يجمع الحلقاتِ والصورَ والسجلّاتِ والطلابَ والهدفَ ثم يلخّصها، ولا يطلب السجلّاتِ بلا صور. */
import type { Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMidmonthFollowup } from './useMidmonthFollowup'

type Result = { data: unknown, error: unknown }

function client(tables: Record<string, Result>) {
  const asked: string[] = []
  return {
    asked,
    from(t: string) {
      asked.push(t)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'not', 'in', 'gte', 'lt']) chain[m] = () => chain
      chain.maybeSingle = async () => tables[t]
      chain.then = (resolve: (v: Result) => void) => resolve(tables[t]!)
      return chain
    }
  }
}

async function run(tables: Record<string, Result>) {
  const c = client(tables)
  let fetcher: () => Promise<unknown> = async () => null
  vi.stubGlobal('useSupabaseClient', () => c)
  vi.stubGlobal('useErrorHandler', () => ({ handle: vi.fn() }))
  vi.stubGlobal('useLazyAsyncData', (_k: unknown, f: () => Promise<unknown>) => {
    fetcher = f
    return { data: { value: null }, pending: { value: false } }
  })
  const r = (v: number) => ({ value: v }) as unknown as Ref<number>
  useMidmonthFollowup(r(2026), r(11))
  return { out: await fetcher() as Record<string, unknown> | null, asked: c.asked }
}

afterEach(() => vi.unstubAllGlobals())

const base = {
  halaqat: { data: [{ id: 'h1', name: 'أ', gender: 'male', teacher: { full_name: 'م' } }], error: null },
  students: { data: [{ id: 's1', halaqa_id: 'h1', full_name: 'ط' }], error: null },
  app_settings: { data: { target_memorization_pages: 30 }, error: null },
  exam_results: { data: [{ student_id: 's1', exam_date: '2026-11-08', item: { cycle: { parts_from: 28, parts_to: 30 } } }], error: null }
}

describe('useMidmonthFollowup', () => {
  it('بلا صور: الحلقةُ غيرُ مسلِّمة ولا طلبَ للسجلّات', async () => {
    const { out, asked } = await run({ ...base, quran_midmonth: { data: [], error: null } })
    expect(asked).not.toContain('quran_mid_records')
    expect((out!.missing as { id: string }[]).map(h => h.id)).toEqual(['h1'])
  })
  it('بصورة: يلخّص المسلِّمة', async () => {
    const { out } = await run({
      ...base,
      quran_midmonth: { data: [{ report_id: 'r1', halaqa_id: 'h1', submitted_at: '2026-11-15T08:00:00Z' }], error: null },
      quran_mid_records: { data: [{ halaqa_id: 'h1', student_id: 's1', pages_memorized: 4 }], error: null }
    })
    expect(out!.monthTarget).toBe(30)
    // اختُبر 3 أجزاء قبل التسليم: حدُّه 5 — فأربعُ صفحاتٍ متأخّر، وموسومٌ بالاختبار
    const row = (out!.submitted as { late: string[], tested: unknown[] }[])[0]!
    expect(row.late).toEqual(['ط'])
    expect(row.tested).toEqual([{ name: 'ط', parts: 3 }])
  })
})
