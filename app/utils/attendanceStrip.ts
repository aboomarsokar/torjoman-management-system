/**
 * شريطُ آخر أيام الدوام في شاشة الحضور بلا إنترنت (طلب المستخدم 2026-10-26 — نمطُ «شريط النافذة» في الصحابة): أيُّ
 * أيامٍ لم تُسجَّل بنظرةٍ واحدة. أيامُ الدوام من السبت إلى الخميس، لا قبل بداية المشروع ولا بعد اليوم.
 * والحالُ من نسخة الجهاز وصندوق الرفع معاً — فيومٌ حُفظ بلا اتصال يُرى «بانتظار الرفع» لا «لم يُسجَّل».
 */
import { isFriday } from '~/utils/reportWindow'
import type { MirrorDay } from '~/utils/attendanceOutbox'
import type { OffDay } from '~/utils/offDays'

export const STRIP_DAYS = 15

/**
 * `holiday` إجازةٌ عامة · `off` بلاغٌ معتمَد (لا يُعدّ ناقصاً) · `off_pending` بلاغٌ معلّقٌ أو على الجهاز
 * (يُعدّ ناقصاً حتى يُعتمد، كما في القاعدة).
 */
export type StripState = 'recorded' | 'queued' | 'missing' | 'locked' | 'holiday' | 'off' | 'off_pending'

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

/**
 * حالُ كلّ يوم بالأسبقية: بلاغٌ على الجهاز ← حضورٌ على الجهاز ← سحبٌ على الجهاز (إجازةٌ أو ناقص) ← مسجَّل ← إجازة ←
 * بلاغٌ معتمَد ← بلاغٌ معلّق ← شهرٌ معتمَد ← ناقص. والبلاغُ المرفوض لا يظهر في `offDays` أثراً: يعود ناقصاً.
 * `offDays` و`holidays` و`queuedOff` و`queuedWithdraw` اختياريةٌ (غيابُها = نسخةُ جهازٍ قديمة: لا بلاغات ولا إجازات).
 * و`queued` لسطور الحضور وحدها.
 */
export function attendanceStrip(input: {
  days: string[]
  mirror: Record<string, MirrorDay>
  queued: Set<string>
  approvedMonths: string[]
  offDays?: Record<string, OffDay>
  holidays?: Record<string, string>
  queuedOff?: Set<string>
  queuedWithdraw?: Set<string>
}): { days: StripDay[], missing: number } {
  const offDays = input.offDays ?? {}
  const holidays = input.holidays ?? {}
  const out = input.days.map((date): StripDay => {
    if (input.queuedOff?.has(date)) return { date, state: 'off_pending' }
    if (input.queued.has(date)) return { date, state: 'queued' }
    if (input.queuedWithdraw?.has(date)) return { date, state: holidays[date] !== undefined ? 'holiday' : 'missing' }
    if (input.mirror[date]?.held) return { date, state: 'recorded' }
    if (holidays[date] !== undefined) return { date, state: 'holiday' }
    const off = offDays[date]
    if (off?.status === 'approved') return { date, state: 'off' }
    if (off?.status === 'pending') return { date, state: 'off_pending' }
    if (input.approvedMonths.includes(date.slice(0, 7))) return { date, state: 'locked' }
    return { date, state: 'missing' }
  })
  return { days: out, missing: out.filter(d => d.state === 'missing' || d.state === 'off_pending').length }
}
