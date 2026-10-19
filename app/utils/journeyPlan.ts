/**
 * @deprecated خطةُ exam_plan القديمة — تُستبدل بالدورات (`buildJourney` في journey.ts) في المهمة 5.
 * رحلة الطالب على خطة الاختبارات — حسب الحفظ (الأجزاء المثبتة)، لا الزمن.
 * يستحقّ المحطة عند بلوغ حدّها الأعلى (parts_to ≤ المثبتة)، وتُظهر نتيجتها إن وُجدت.
 */
export type PlanStage = 'partial' | 'cumulative'
export type PlanInput = { id: number, parts_from: number, parts_to: number, stage_type: PlanStage }
export type ResultInput = { exam_plan_id: number | null, passed: boolean | null, total_score: number | null }
export type StationResult = 'passed' | 'failed' | null
export type PlanStation = {
  id: number
  from: number
  to: number
  stage: PlanStage
  reached: boolean
  isNext: boolean
  result: StationResult
  score: number | null
}

export function buildJourneyFromPlan(
  quranParts: number | null | undefined,
  plan: PlanInput[],
  results: ResultInput[] = []
) {
  const parts = quranParts ?? 0
  const byPlan = new Map<number, { result: StationResult, score: number | null }>()
  for (const r of results) {
    if (r.exam_plan_id == null) continue
    // النجاح يَغلِب: إن وُجد اجتياز لا يُلغى برسوب لاحق
    const prev = byPlan.get(r.exam_plan_id)
    if (prev?.result === 'passed') continue
    byPlan.set(r.exam_plan_id, { result: r.passed ? 'passed' : 'failed', score: r.total_score })
  }

  const stations: PlanStation[] = [...plan]
    .map(p => ({
      id: p.id,
      from: p.parts_from,
      to: p.parts_to,
      stage: p.stage_type,
      reached: parts >= p.parts_to,
      isNext: false,
      result: byPlan.get(p.id)?.result ?? null,
      score: byPlan.get(p.id)?.score ?? null
    }))
    .sort((a, b) => (a.to - b.to) || (a.stage === 'partial' ? -1 : 1))

  // المستحقّة القادمة (للاختبار الآن): أوّل محطة بلغها ولم يجتزها بعد
  const nextIdx = stations.findIndex(s => s.reached && s.result !== 'passed')
  if (nextIdx >= 0) stations[nextIdx]!.isNext = true

  // القادمة بترتيب الخطة (بصرف النظر عن البلوغ) — لعرض "المحطة القادمة" حتى
  // قبل بلوغها؛ لا تُخلَط بـ nextStation (خاصّة بأهلية الاختبار الآن فقط)
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

export const stageLabel = (s: PlanStage) => s === 'partial' ? 'مرحلي (3 أجزاء)' : 'تجميعي (5 أجزاء)'
