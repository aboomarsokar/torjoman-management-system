/**
 * مسارُ الطالب في مقرّرات القراءة الشهرية — حسابٌ نقيٌّ ومختبَر يغذّي بطاقةَ القراءة ومحطّاتِها (الطالب
 * والعامل) ولوحةَ المعلم. المقرّرُ المستحقّ = أوّلُ مقرّرٍ لم ينجح فيه؛ ولا ينتقل حتى ينجح (القاعدةُ تفرضه في
 * `start_reading_test()`، وهذا للعرض). والمتوقّعُ مقرّرٌ لكلّ شهرٍ منذ الالتحاق.
 */
import { gazaToday } from '~/utils/reportWindow'

const MS_PER_DAY = 24 * 3600 * 1000
/** متوسّطُ أيام الشهر — لعدّ الأشهر منذ الالتحاق (كـ`sinceLabel`). */
const DAYS_PER_MONTH = 30.4

export interface ReadingPart { book: string, author: string | null, page_from: number, page_to: number }
/** `pdfPath`: ملفُّ المقرّر في المستودع الخاصّ (`units/<id>.pdf`) أو null إن لم يُرفع بعد. */
export interface ReadingUnit { id: number, sort_order: number, title: string, parts: ReadingPart[], pdfPath?: string | null }
export interface ReadingAttempt {
  id: string
  unit_id: number
  started_at: string
  deadline_at: string
  submitted_at: string | null
  score: number | null
  total: number
  percent: number | null
  passed: boolean | null
}

export type StationStatus = 'passed' | 'due' | 'locked'
export interface ReadingStation {
  unit: ReadingUnit
  status: StationStatus
  /** أعلى نسبةٍ في محاولاته المسلَّمة، أو null. */
  best: number | null
  attempts: number
}

export interface JourneyOptions {
  retryDays: number
  now: number
  enrollmentDate: string | null
}

/** «صفقات رابحة 1–88 + اليوم النبوي 1–124». */
export function unitScope(unit: Pick<ReadingUnit, 'parts'>): string {
  return unit.parts.map(p => `${p.book} ${p.page_from}–${p.page_to}`).join(' + ')
}

/** الأشهرُ الكاملة منذ الالتحاق (صفرٌ قبل شهرٍ أو بلا تاريخ). */
export function monthsSince(date: string | null, now: number): number {
  if (!date) return 0
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / (DAYS_PER_MONTH * MS_PER_DAY)))
}

export function readingJourney(units: ReadingUnit[], attempts: ReadingAttempt[], o: JourneyOptions) {
  const sorted = [...units].sort((a, b) => a.sort_order - b.sort_order)
  const passed = new Set(attempts.filter(a => a.passed).map(a => a.unit_id))
  const due = sorted.find(u => !passed.has(u.id)) ?? null

  const stations: ReadingStation[] = sorted.map((u) => {
    const mine = attempts.filter(a => a.unit_id === u.id && a.submitted_at)
    const best = mine.length ? Math.max(...mine.map(a => a.percent ?? 0)) : null
    const status: StationStatus = passed.has(u.id) ? 'passed' : u.id === due?.id ? 'due' : 'locked'
    return { unit: u, status, best, attempts: mine.length }
  })

  // محاولةٌ مفتوحةٌ ما زال وقتُها — تُستأنف لا تُبدأ
  const open = attempts.find(a => !a.submitted_at && new Date(a.deadline_at).getTime() > o.now) ?? null

  // الانتظارُ بعد آخر رسوبٍ في المستحقّ (من وقت الختم، كما في القاعدة)
  const dueAttempts = due ? attempts.filter(a => a.unit_id === due.id && a.submitted_at) : []
  const lastDue = [...dueAttempts].sort((a, b) => b.submitted_at!.localeCompare(a.submitted_at!))[0] ?? null
  const retryAtMs = lastDue && lastDue.passed === false
    ? new Date(lastDue.submitted_at!).getTime() + o.retryDays * MS_PER_DAY
    : null
  const waiting = retryAtMs !== null && retryAtMs > o.now

  const expected = Math.min(sorted.length, monthsSince(o.enrollmentDate, o.now))
  const pace = expected === 0
    ? null
    : passed.size > expected ? 'ahead' as const : passed.size === expected ? 'onTrack' as const : 'behind' as const

  return {
    stations,
    due,
    passedCount: passed.size,
    total: sorted.length,
    open,
    /** تاريخُ الإعادة `YYYY-MM-DD` بتوقيت غزة، أو null إن لم يكن ينتظر. */
    retryOn: waiting ? gazaToday(new Date(retryAtMs!)) : null,
    canStart: !!due && (!!open || !waiting),
    expected,
    pace
  }
}

export type ReadingJourney = ReturnType<typeof readingJourney>

/** المتأخّرون عن مقرّرهم: اجتازوا أقلَّ من الأشهر منذ التحاقهم (ولم يُتمّوا المقرّرات). */
export function behindStudents(
  students: { id: string, full_name: string, enrollment_date: string | null }[],
  passedByStudent: Map<string, number>,
  totalUnits: number,
  now: number
) {
  return students
    .map(s => ({ id: s.id, name: s.full_name, passed: passedByStudent.get(s.id) ?? 0, expected: Math.min(totalUnits, monthsSince(s.enrollment_date, now)) }))
    .filter(s => s.passed < s.expected)
    .map(s => ({ id: s.id, name: s.name, count: s.expected - s.passed }))
}
