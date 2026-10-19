/** المطلوبُ الشهريّ مُقسَّطاً بالحضور، وحكمُ الإنجاز على الصفحات المرصودة. */

/** `unheld`: انعقدت أيامٌ في الشهر ولم ينعقد منها شيءٌ منذ التحاق الطالب فلا يُقاس. */
export type PlanBasis = 'full' | 'prorated' | 'absent' | 'unheld'

export interface ProratedPlan {
  /** المطلوبُ بعد التقسيط؛ null إن لم يُقَس (بلا خطة أو لم يحضر). */
  required: number | null
  /** المطلوبُ الكامل قبل التقسيط. */
  full: number | null
  basis: PlanBasis
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
}): ProratedPlan {
  const { required, daysHeld, daysAttended, monthDays } = input

  if (required === null) return { required: null, full: null, basis: 'full' }
  if (daysHeld === 0 && (monthDays ?? 0) > 0) return { required: null, full: required, basis: 'unheld' }
  if (!daysHeld || daysHeld <= 0 || daysAttended === null) return { required, full: required, basis: 'full' }
  if (daysAttended <= 0) return { required: null, full: required, basis: 'absent' }
  if (daysAttended >= daysHeld) return { required, full: required, basis: 'full' }

  return { required: Math.max(1, Math.round((required * daysAttended) / daysHeld)), full: required, basis: 'prorated' }
}

export type Outcome = 'done' | 'short' | 'unmeasured' | 'unrecorded'

/** حكمُ الشهر: لم يُرصد (null) · لا يُقاس (بلا مطلوب) · أنجز (≥ المطلوب) · مقصّر. */
export function outcomeOf(pages: number | null, plan: ProratedPlan): Outcome {
  if (pages === null) return 'unrecorded'
  if (plan.required === null) return 'unmeasured'
  return pages >= plan.required ? 'done' : 'short'
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  done: 'أنجز',
  short: 'مقصّر',
  unmeasured: 'لا يُقاس',
  unrecorded: 'لم يُرصد'
}
