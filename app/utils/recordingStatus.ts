/**
 * «متابعة الرصد» (طلب المستخدم 2026-10-22): أرقامُ `halaqat_recording_status` إلى أحكامٍ وترتيب.
 * المقصّرُ: حلقةٌ فاتها يومُ دوامٍ بلا رصد حضور (عدا اليوم الجاري)، أو رصدُ شهرٍ قرآنيٍّ تجاوز مهلتَه بلا إرسال.
 * اليومُ الجاري بلا رصدٍ «لم يُرصد بعد» لا تقصير — اليومُ قائم.
 */
import { isBeforeProjectStart } from './projectStart'

export interface RecordingRow {
  halaqa_id: string
  halaqa_name: string
  /** جنسُ الحلقة — «المعلّم/المعلّمة» به. */
  gender: string
  teacher_name: string | null
  teacher_phone: string | null
  teacher_whatsapp: string | null
  today: string
  recorded_today: boolean
  expected_days: number
  recorded_days: number
  missed_days: string[]
  recent: unknown
  report_year: number
  report_month: number
  report_status: string | null
  report_deadline: string
}

/** `none`: الشهرُ المستحقّ قبل بداية المشروع (10/2026) فلا رصدَ له — كان يظهر «رصد 9/2026: متأخّر» (2026-10-25). */
export type ReportState = 'approved' | 'submitted' | 'late' | 'due' | 'none'
export type DayState = 'held' | 'missed' | 'today' | 'before'
export interface RecentDay { day: string, state: DayState }

/** حالُ رصد الشهر المستحقّ: معتمَدٌ، أو مُرسَلٌ، أو متأخّرٌ (فاتت المهلة بلا إرسال)، أو مستحقٌّ بعدُ في مهلته. */
export function reportState(r: Pick<RecordingRow, 'report_status' | 'report_deadline' | 'today' | 'report_year' | 'report_month'>): ReportState {
  if (isBeforeProjectStart({ year: r.report_year, month: r.report_month })) return 'none'
  if (r.report_status === 'approved') return 'approved'
  if (r.report_status === 'submitted') return 'submitted'
  return r.today > r.report_deadline ? 'late' : 'due'
}

/** الأيامُ الباقية في المهلة (0 = آخرُ يوم). */
export function daysLeft(r: Pick<RecordingRow, 'report_deadline' | 'today'>): number {
  return Math.round((Date.parse(r.report_deadline) - Date.parse(r.today)) / 86_400_000)
}

export const isLagging = (r: RecordingRow) => r.missed_days.length > 0 || reportState(r) === 'late'

/** الأشدُّ تقصيراً أولاً: رصدٌ شهريٌّ متأخّر، ثم أكثرُ الأيام الفائتة، ثم ما لم يُرصد اليوم، ثم الاسم. */
export function sortByLag<T extends RecordingRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    Number(reportState(b) === 'late') - Number(reportState(a) === 'late')
    || b.missed_days.length - a.missed_days.length
    || Number(a.recorded_today) - Number(b.recorded_today)
    || a.halaqa_name.localeCompare(b.halaqa_name, 'ar'))
}

export function recordingSummary(rows: RecordingRow[]) {
  return {
    halqat: rows.length,
    today: rows.filter(r => r.recorded_today).length,
    lagging: rows.filter(isLagging).length,
    lateReports: rows.filter(r => reportState(r) === 'late').length
  }
}

const DAY_STATES: readonly DayState[] = ['held', 'missed', 'today', 'before']
/** شريطُ الأيام الأخيرة من الردّ — يُسقط ما لا يُفهم بدل أن يُخطئ في رسمه. */
export function parseRecent(raw: unknown): RecentDay[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x) => {
    const o = x as { day?: unknown, state?: unknown }
    return typeof o.day === 'string' && DAY_STATES.includes(o.state as DayState) ? [{ day: o.day, state: o.state as DayState }] : []
  })
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const WEEKDAYS_SHORT = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمس', 'جمع', 'سبت']
const dow = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()
/** اسمُ يوم الأسبوع لتاريخٍ `YYYY-MM-DD` (بلا منطقةٍ زمنية: التاريخُ يومٌ تقويميّ). */
export function weekdayName(day: string): string {
  return WEEKDAYS[dow(day)]!
}
/** اختصارُه بثلاثة أحرف — الحرفُ الأولُ وحده يلتبس (الأحد والأربعاء). */
export function weekdayShort(day: string): string {
  return WEEKDAYS_SHORT[dow(day)]!
}
