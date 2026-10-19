/**
 * رحلة الطالب على دورات الاختبار — حسب الحفظ (الأجزاء المثبتة)، لا الزمن.
 * المحطّةُ = دورة؛ تُستحقّ حين يبلغ الطالبُ ما تحقّقه بالاجتياز (`partsAfterPass`)، وتُظهر نتيجتها إن وُجدت.
 */
import { cycleShort, partsAfterPass, type ExamCycle } from '~/utils/exams/cycles'

export type CycleResultInput = { exam_cycle_id: number | null, passed: boolean | null, total_score: number | null }
export type StationResult = 'passed' | 'failed' | null
export type JourneyStation = {
  id: number
  cycle: ExamCycle
  reached: boolean
  isNext: boolean
  result: StationResult
  score: number | null
}

export function buildJourney(
  quranParts: number | null | undefined,
  cycles: ExamCycle[],
  results: CycleResultInput[] = []
) {
  const parts = quranParts ?? 0
  const byCycle = new Map<number, { result: StationResult, score: number | null }>()
  for (const r of results) {
    if (r.exam_cycle_id == null) continue
    // النجاح يَغلِب: إن وُجد اجتياز لا يُلغى برسوب لاحق
    if (byCycle.get(r.exam_cycle_id)?.result === 'passed') continue
    byCycle.set(r.exam_cycle_id, { result: r.passed ? 'passed' : 'failed', score: r.total_score })
  }

  const stations: JourneyStation[] = [...cycles]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      id: c.id,
      cycle: c,
      reached: parts >= partsAfterPass(c),
      isNext: false,
      result: byCycle.get(c.id)?.result ?? null,
      score: byCycle.get(c.id)?.score ?? null
    }))

  // المستحقّة الآن: أوّلُ محطّةٍ بلغها ولم يجتزها
  const nextIdx = stations.findIndex(s => s.reached && s.result !== 'passed')
  if (nextIdx >= 0) stations[nextIdx]!.isNext = true

  // القادمة بترتيب الخطة (بصرف النظر عن البلوغ) — لا تُخلَط بـ nextStation (أهليةُ الاختبار الآن فقط)
  const upcomingIdx = stations.findIndex(s => s.result !== 'passed')

  return {
    parts,
    stations,
    reachedCount: stations.filter(s => s.reached).length,
    passedCount: stations.filter(s => s.result === 'passed').length,
    totalStations: stations.length,
    nextStation: nextIdx >= 0 ? stations[nextIdx]! : null,
    upcomingStation: upcomingIdx >= 0 ? stations[upcomingIdx]! : null
  }
}

/**
 * قيمةُ «المحطة القادمة» في بطاقات الحلقة/اللوحة:
 * القادمةُ بنصّها، أو «أتمّ الخطة» إن اجتاز كلَّ الدورات، أو «—» إن لا دورات.
 */
export function upcomingLabel(j: Pick<ReturnType<typeof buildJourney>, 'upcomingStation' | 'totalStations'>): string {
  if (j.upcomingStation) return cycleShort(j.upcomingStation.cycle)
  return j.totalStations > 0 ? 'أتمّ الخطة' : '—'
}

/** «منذ الالتحاق» نصّاً عربيّاً مبسّطاً. */
export function sinceLabel(date: string | null | undefined): string {
  if (!date) return '—'
  const months = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (30.4 * 24 * 3600 * 1000)))
  if (months < 1) return 'أقل من شهر'
  if (months < 12) return `${months} شهر`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m ? `${y} سنة و${m} شهر` : `${y} سنة`
}
