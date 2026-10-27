/**
 * شريطُ آخر أيام الدوام في شاشة الحضور بلا إنترنت (طلب المستخدم 2026-10-26 — نمطُ «شريط النافذة» في الصحابة): أيُّ
 * أيامٍ لم تُسجَّل بنظرةٍ واحدة. أيامُ الدوام من السبت إلى الخميس، لا قبل بداية المشروع ولا بعد اليوم.
 * والحالُ من نسخة الجهاز وصندوق الرفع معاً — فيومٌ حُفظ بلا اتصال يُرى «بانتظار الرفع» لا «لم يُسجَّل».
 */
import { isFriday } from '~/utils/reportWindow'
import type { MirrorDay } from '~/utils/attendanceOutbox'

export const STRIP_DAYS = 15

export type StripState = 'recorded' | 'queued' | 'missing' | 'locked'

export interface StripDay { date: string, state: StripState }

/** آخرُ `count` يومَ دوامٍ حتى `today`، الأقدمُ أوّلاً. */
export function lastSchoolDays(today: string, projectStart: string, count: number = STRIP_DAYS): string[] {
  const days: string[] = []
  const d = new Date(`${today}T12:00:00Z`)
  while (days.length < count) {
    const iso = d.toISOString().slice(0, 10)
    if (iso < projectStart) break
    if (!isFriday(iso)) days.push(iso)
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return days.reverse()
}

export function attendanceStrip(input: {
  days: string[]
  mirror: Record<string, MirrorDay>
  queued: Set<string>
  approvedMonths: string[]
}): { days: StripDay[], missing: number } {
  const out = input.days.map((date): StripDay => {
    if (input.queued.has(date)) return { date, state: 'queued' }
    if (input.mirror[date]?.held) return { date, state: 'recorded' }
    if (input.approvedMonths.includes(date.slice(0, 7))) return { date, state: 'locked' }
    return { date, state: 'missing' }
  })
  return { days: out, missing: out.filter(d => d.state === 'missing').length }
}
