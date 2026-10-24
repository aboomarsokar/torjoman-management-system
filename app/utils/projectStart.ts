/** حدُّ بداية المشروع للشهور والأيام: ما قبل `PROJECT_START` لا يُعرض ولا يُختار. */
import { PROJECT_START, PROJECT_START_DATE } from '~/constants/project'

interface YearMonth { year: number, month: number }

const ordinal = (p: YearMonth) => p.year * 12 + p.month

/** هل الشهرُ قبل بداية المشروع؟ */
export function isBeforeProjectStart(p: YearMonth): boolean {
  return ordinal(p) < ordinal(PROJECT_START)
}

/** هل الشهرُ هو أوّلُ شهرٍ في المشروع أو قبله؟ — يعطّل زرَّ «الشهر السابق». */
export function isAtProjectStart(p: YearMonth): boolean {
  return ordinal(p) <= ordinal(PROJECT_START)
}

/** الشهرُ نفسه، أو بدايةُ المشروع إن وقع قبلها. */
export function clampToProjectStart(p: YearMonth): YearMonth {
  return isBeforeProjectStart(p) ? { ...PROJECT_START } : p
}

/** اليومُ `YYYY-MM-DD` نفسه، أو أوّلُ يومٍ في المشروع إن وقع قبله. */
export function clampDayToProjectStart(day: string): string {
  return day < PROJECT_START_DATE ? PROJECT_START_DATE : day
}
