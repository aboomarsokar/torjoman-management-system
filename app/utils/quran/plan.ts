/** المطلوبُ الشهريّ مُقسَّطاً بالحضور، وحكمُ الإنجاز على الصفحات المرصودة. */

/** `unheld`: انعقدت أيامٌ في الشهر ولم ينعقد منها شيءٌ منذ التحاق الطالب فلا يُقاس. */
export type PlanBasis = 'full' | 'prorated' | 'absent' | 'unheld'

export interface ProratedPlan {
  /** المطلوبُ بعد التقسيط؛ null إن لم يُقَس (بلا خطة أو لم يحضر). */
  required: number | null
  /** المطلوبُ الكامل قبل التقسيط (وقبل تخفيض الاختبار). */
  full: number | null
  basis: PlanBasis
  /** أثلاثٌ خُصمت من المطلوب الكامل لاختبارٍ في الشهر (`EXAM_RELIEF_THIRDS`: 1–3) — قبل التقسيط. */
  relief?: number
}

/**
 * يقسّط المطلوبَ على الحضور: `max(1, round(المطلوب × حضر ÷ أيام الحلقة))`.
 * · لا خطة ← لا مطلوب · انعقدت أيامٌ في الشهر (`monthDays > 0`) ولم ينعقد منها شيءٌ منذ التحاقه (`daysHeld = 0`) ← `unheld` بلا مطلوب
 * · لا أيامَ في الشهر أصلاً/مجهولة أو الحضورُ مجهول ← كاملاً (لا نسبةَ على مجهول)
 * · لم يحضر يوماً ← `absent` بلا مطلوب · حضر الكلَّ ← كاملاً
 * · من حضر ولو يوماً يُطالَب بصفحةٍ على الأقلّ (نصابُ صفرٍ يجعله «أنجز» بلا شيء).
 */
export function proratePlan(input: {
  required: number | null
  daysHeld: number | null
  daysAttended: number | null
  /** أيامُ الحلقة في الشهر كلِّه (قبل قصّها بالالتحاق)؛ غيابُه يُبقي سلوكَ «بلا أيام» كاملاً. */
  monthDays?: number | null
  /** أثلاثُ تخفيض الاختبار (1–3) تُخصم من المطلوب الكامل قبل التقسيط: `round(المطلوب × أثلاث ÷ 3)`؛
   *  وما بلغ الصفرَ لا يُطالَب بشيء (يُعدّ منجزاً بأيّ رصد). */
  relief?: number
}): ProratedPlan {
  const { required, daysHeld, daysAttended, monthDays } = input
  if (required === null) return prorateBase(input)
  const relief = Math.min(Math.max(0, input.relief ?? 0), 3)
  if (!relief) return prorateBase(input)
  const base = required - Math.round((required * relief) / 3)
  const plan = prorateBase({ required: base, daysHeld, daysAttended, monthDays })
  // خُصم المطلوبُ كلُّه: لا تقسيطَ يرفعه إلى صفحة (من لم يحضر أو لم تنعقد له أيامٌ يبقى بلا مطلوب)
  const reduced = base === 0 && plan.required !== null ? 0 : plan.required
  return { ...plan, required: reduced, full: required, relief }
}

function prorateBase(input: { required: number | null, daysHeld: number | null, daysAttended: number | null, monthDays?: number | null }): ProratedPlan {
  const { required, daysHeld, daysAttended, monthDays } = input

  if (required === null) return { required: null, full: null, basis: 'full' }
  if (daysHeld === 0 && (monthDays ?? 0) > 0) return { required: null, full: required, basis: 'unheld' }
  if (!daysHeld || daysHeld <= 0 || daysAttended === null) return { required, full: required, basis: 'full' }
  if (daysAttended <= 0) return { required: null, full: required, basis: 'absent' }
  if (daysAttended >= daysHeld) return { required, full: required, basis: 'full' }

  return { required: Math.max(1, Math.round((required * daysAttended) / daysHeld)), full: required, basis: 'prorated' }
}

export type Outcome = 'done' | 'near' | 'short' | 'unmeasured' | 'unrecorded'

/** «قريب»: أنجز هذه النسبةَ من المطلوب فأكثر دون تمامه (قرار 2026-11-02 — مرآتُه في القاعدة `pages*4 >= required*3`). */
export const NEAR_MIN_PCT = 75

/** حكمُ الشهر: لم يُرصد (null) · لا يُقاس (بلا مطلوب) · أنجز (≥ المطلوب) · قريب (≥ 75%) · مقصّر. */
export function outcomeOf(pages: number | null, plan: ProratedPlan): Outcome {
  if (pages === null) return 'unrecorded'
  if (plan.required === null) return 'unmeasured'
  if (pages >= plan.required) return 'done'
  return pages * 100 >= plan.required * NEAR_MIN_PCT ? 'near' : 'short'
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  done: 'أنجز',
  near: 'قريب',
  short: 'مقصّر',
  unmeasured: 'لا يُقاس',
  unrecorded: 'لم يُرصد'
}
