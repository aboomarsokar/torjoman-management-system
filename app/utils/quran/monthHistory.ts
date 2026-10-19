/**
 * تاريخُ نهايات الرصد: أحدثُ «إلى» لكلّ طالبٍ قبل شهرٍ معيّن (أيّ حالة أو المعتمَد وحده)، ونطاقُ تواريخ الشهر.
 * نقيٌّ ومختبَر؛ يغذّي `useQuranMonth`.
 */
import type { Position } from '~/utils/quran/position'
import { comparePositions } from '~/utils/quran/position'

export interface HistoryRow {
  student_id: string
  to_surah: number | null
  to_ayah: number | null
  report: { report_year: number, report_month: number, status: string } | null
}

/** أحدثُ نهايةٍ لكلّ طالب (سنةٌ ثم شهرٌ ثم الأبعدُ موضعاً) في الأشهر **قبل** `before`؛ `onlyApproved` للمعتمَد وحده. */
export function latestEnds(
  rows: HistoryRow[],
  before: { year: number, month: number },
  onlyApproved: boolean
): Record<string, Position | null> {
  const key = (y: number, m: number) => y * 12 + m
  const limit = key(before.year, before.month)
  const best: Record<string, { k: number, pos: Position }> = {}
  for (const r of rows) {
    const pos = (r.to_surah === null || r.to_ayah === null ? null : { surah: r.to_surah, ayah: r.to_ayah })
    if (!pos || !r.report) continue
    const k = key(r.report.report_year, r.report.report_month)
    if (k >= limit || (onlyApproved && r.report.status !== 'approved')) continue
    const cur = best[r.student_id]
    if (!cur || k > cur.k || (k === cur.k && comparePositions(pos, cur.pos) > 0)) best[r.student_id] = { k, pos }
  }
  return Object.fromEntries(Object.entries(best).map(([id, b]) => [id, b.pos]))
}

export function monthRange(year: number, month: number): { from: string, to: string } {
  const mm = String(month).padStart(2, '0')
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}
