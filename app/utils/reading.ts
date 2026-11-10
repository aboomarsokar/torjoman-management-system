/**
 * مسارُ الطالب في مقرّرات القراءة الشهرية — حسابٌ نقيٌّ ومختبَر يغذّي بطاقةَ القراءة ومحطّاتِها (الطالب
 * والعامل) ولوحةَ المعلم. المقرّرُ المستحقّ = أوّلُ مقرّرٍ لم ينجح فيه؛ ولا ينتقل حتى ينجح (القاعدةُ تفرضه في
 * `start_reading_test()`، وهذا للعرض). والمتوقّعُ مقرّرٌ لكلّ شهرٍ منذ الالتحاق.
 * ومنذ 2026-11-10 يُفتح كلُّ مقرّرٍ في شهره (`opensOn`: الأوّلُ أكتوبر 2026، والثاني نوفمبر…): المستحقُّ الذي لم يُفتح
 * بعد لا يُختبر («يُفتح في …»)، والمتوقّعُ عددُ ما فُتح. ولكلّ مقرّرٍ خارطةُ طريقٍ أسبوعية (`items`) للمتابعة لا للاختبار.
 */
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import { PROJECT_START } from '~/constants/project'

const MS_PER_DAY = 24 * 3600 * 1000
/** متوسّطُ أيام الشهر — لعدّ الأشهر منذ الالتحاق (كـ`sinceLabel`). */
const DAYS_PER_MONTH = 30.4

export interface ReadingPart { book: string, author: string | null, page_from: number, page_to: number }
/** بندٌ في خارطة الأسبوع: صفحاتٌ من كتاب، أو محاضرةٌ/مقطعٌ مرئيّ (المدّةُ بالثواني، والرابطُ قد يتأخّر). */
export interface ReadingItem {
  week: number
  sort_order: number
  kind: 'pages' | 'lecture' | 'clip'
  book: string | null
  page_from: number | null
  page_to: number | null
  title: string | null
  speaker: string | null
  durationSeconds: number | null
  url: string | null
}
/**
 * `pdfPath`: ملفُّ المقرّر في المستودع الخاصّ (`units/<id>.pdf`)، و`coverPath` غلافُه (`covers/<id>.jpg`) — null ما لم يُرفعا.
 * `opensOn`: أوّلُ يومٍ يُفتح فيه اختبارُه (`YYYY-MM-DD`)؛ غائبٌ في نسخةٍ على الجهاز قبل 2026-11-10 فيُعدّ مفتوحاً.
 */
export interface ReadingUnit {
  id: number
  sort_order: number
  title: string
  parts: ReadingPart[]
  pdfPath?: string | null
  coverPath?: string | null
  opensOn?: string | null
  items?: ReadingItem[]
}
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

/** فُتح اختبارُ المقرّر في اليوم المعطى (`YYYY-MM-DD`)؟ بلا موعدٍ مفتوح. */
export const isUnitOpen = (u: Pick<ReadingUnit, 'opensOn'>, today: string): boolean => !u.opensOn || u.opensOn <= today

/** مقرّرُ الشهر الذي تسير عليه الحلقات: آخرُ ما فُتح (الأوّلُ قبل بداية الخطّة). */
export function monthUnit(units: ReadingUnit[], today: string): ReadingUnit | null {
  const sorted = [...units].sort((a, b) => a.sort_order - b.sort_order)
  return [...sorted].reverse().find(u => u.opensOn && u.opensOn <= today) ?? sorted[0] ?? null
}

/** أسبوعُ الشهر لليوم: 1–7 الأوّل، 8–14 الثاني، 15–21 الثالث، وما بعده الرابع. */
export const weekOfMonth = (today: string): number => Math.min(4, Math.ceil(Number(today.slice(8, 10)) / 7))

/** أسابيعُ المقرّر مرتّبةً، ولكلٍّ بنودُه. */
export function roadmapWeeks(unit: Pick<ReadingUnit, 'items'>): { week: number, items: ReadingItem[] }[] {
  const map = new Map<number, ReadingItem[]>()
  for (const i of [...(unit.items ?? [])].sort((a, b) => a.week - b.week || a.sort_order - b.sort_order)) {
    const list = map.get(i.week)
    if (list) list.push(i)
    else map.set(i.week, [i])
  }
  return [...map].map(([week, items]) => ({ week, items }))
}

/** «1:24:04» · «28:43». */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
export interface ReadingStation {
  unit: ReadingUnit
  status: StationStatus
  /** أعلى نسبةٍ في محاولاته المسلَّمة، أو null. */
  best: number | null
  /** نسبةُ آخر محاولةٍ مسلَّمة، أو null. */
  last: number | null
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
  const today = gazaToday(new Date(o.now))
  // المستحقُّ لم يُفتح بعد: أتمّ ما فُتح، وينتظر شهرَه
  const dueOpensOn = due && !isUnitOpen(due, today) ? due.opensOn! : null

  const stations: ReadingStation[] = sorted.map((u) => {
    const mine = attempts.filter(a => a.unit_id === u.id && a.submitted_at)
    const best = mine.length ? Math.max(...mine.map(a => a.percent ?? 0)) : null
    const latest = [...mine].sort((a, b) => b.submitted_at!.localeCompare(a.submitted_at!))[0]
    const status: StationStatus = passed.has(u.id) ? 'passed' : u.id === due?.id ? 'due' : 'locked'
    return { unit: u, status, best, last: latest?.percent ?? null, attempts: mine.length }
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

  // المتوقّعُ ما فُتح من المقرّرات (مقرّرٌ لكلّ شهر)، والملتحقُ هذا الشهر جديدٌ لا يُقاس؛ وبلا مواعيد (نسخةٌ قديمة) كما كان
  const months = monthsSince(o.enrollmentDate, o.now)
  const hasSchedule = sorted.length > 0 && sorted.every(u => !!u.opensOn)
  const expected = months === 0 ? 0 : hasSchedule ? sorted.filter(u => isUnitOpen(u, today)).length : Math.min(sorted.length, months)
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
    canStart: !!open || (!!due && !dueOpensOn && !waiting),
    /** المستحقُّ لم يُفتح بعد: موعدُ فتحه `YYYY-MM-DD`، وإلا null. */
    dueOpensOn,
    expected,
    pace
  }
}

export type ReadingJourney = ReturnType<typeof readingJourney>

export type ProgressState = 'done' | 'waiting' | 'ahead' | 'onTrack' | 'behind' | 'new'

/**
 * صفوفُ «إنجاز الطلاب» للعاملين (المعلم والمشرف ومن فوقهما، اطّلاعاً): لكلّ طالبٍ مسارُه بـ`readingJourney` —
 * مقرّرُه الحالي، والمجتاز، وآخرُ علامة، وحالُه (أتمّ / ينتظر الإعادة / متقدّم / في المسار / متأخّر / جديد).
 * المتأخّرُ أوّلاً ثم بالاسم.
 */
export function readingProgressRows(
  students: { id: string, full_name: string, enrollment_date: string | null }[],
  attempts: (ReadingAttempt & { student_id: string })[],
  units: ReadingUnit[],
  o: { retryDays: number, now: number }
) {
  const byStudent = new Map<string, ReadingAttempt[]>()
  for (const a of attempts) {
    const list = byStudent.get(a.student_id) ?? []
    list.push(a)
    byStudent.set(a.student_id, list)
  }
  const ORDER: Record<ProgressState, number> = { behind: 0, waiting: 1, new: 2, onTrack: 3, ahead: 4, done: 5 }
  return students
    .map((s) => {
      const j = readingJourney(units, byStudent.get(s.id) ?? [], { retryDays: o.retryDays, now: o.now, enrollmentDate: s.enrollment_date })
      const st = j.due ? j.stations.find(x => x.unit.id === j.due!.id) : null
      const state: ProgressState = !j.due ? 'done' : j.retryOn ? 'waiting' : j.pace ?? 'new'
      return {
        id: s.id,
        name: s.full_name,
        current: j.due,
        passed: j.passedCount,
        total: j.total,
        last: st?.last ?? null,
        retryOn: j.retryOn,
        state
      }
    })
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name, 'ar'))
}

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

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
/** شهرُ المقرّر من موعد فتحه: «نوفمبر 2026»؛ بلا موعدٍ فارغ. */
export function unitMonthLabel(opensOn: string | null | undefined): string {
  if (!opensOn) return ''
  return `${MONTHS_AR[Number(opensOn.slice(5, 7)) - 1]} ${opensOn.slice(0, 4)}`
}

/** موعدُ فتح المقرّر بترتيبه: الأوّلُ شهرُ بداية المشروع، وكلُّ تالٍ شهرٌ بعده (`YYYY-MM-01`). */
export function unitOpensOn(sortOrder: number): string {
  const m = shiftMonth(PROJECT_START.year, PROJECT_START.month, sortOrder - 1)
  return `${m.year}-${String(m.month).padStart(2, '0')}-01`
}
