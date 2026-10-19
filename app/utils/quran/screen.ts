/**
 * منطقُ شاشة «الإنجاز القرآني» النقيّ: تسمياتُ حالة الرصد وألوانُ النتائج، ومَن يكتب في الشهر،
 * وفعلُ بطاقة الطالب، وترشيحُ البطاقات، وشارةُ المطلوب، وتحقّقُ نافذة الرصد قبل الطلب، وصفوفُ التصدير.
 * الحكمُ الأخير للقاعدة؛ هذا طبقةُ تجربة. `app/utils/quran/*` يُستورد صراحةً.
 */
import { MUSHAF_PAGES } from '~/constants/quran'
import { arabicFold } from '~/utils/arabicSearch'
import { openingDay, shiftMonth } from '~/utils/reportWindow'
import type { StudentMonthRow } from './month'
import type { Outcome } from './plan'
import { OUTCOME_LABELS } from './plan'
import type { Position } from './position'
import { isInMemorizationOrder } from './position'

export type ReportStatus = 'draft' | 'submitted' | 'approved'

export interface Period { year: number, month: number }

/** سنواتُ منتقي الشهر قبل سنة اليوم (والسنةُ الحالية معها). */
export const PERIOD_YEARS_BACK = 1

/**
 * الشهرُ الذي تفتح عليه الشاشة.
 * · المعلم (`previousStatus` حالُ رصد الشهر السابق لحلقته): السابقُ إن كان مسوّدةً معلّقة (لم تُرسَل أو
 *   أُعيدت إليه بملاحظة) — هي عملُه المنتظَر؛ وإلا الجاري (لا رصدَ سابق، أو مُرسَل، أو معتمَد) أيّاً كان اليوم.
 * · `previousStatus = null` — لا حلقةَ مختارة (قائمةُ المعتمِد/المدير): الإرسالُ يُفتح آخرَ الشهر فيقع
 *   الاعتمادُ في الذي يليه، فقبل يوم فتح الجاري يُعرض السابقُ ليظهر ما أُرسل فيه.
 */
export function defaultPeriod(today: string, opts: { previousStatus: ReportStatus | 'none' | null }): Period {
  const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const previous = shiftMonth(current.year, current.month, -1)
  if (opts.previousStatus !== null) return opts.previousStatus === 'draft' ? previous : current
  return today < openingDay(current.year, current.month) ? previous : current
}

/** شهرُ الرابط `?y=YYYY&m=MM` إن صحّ ووقع في مدى المنتقي (لا مستقبل ولا قبل سنته الأولى)، وإلا null. */
export function periodFromQuery(y: unknown, m: unknown, today: string): Period | null {
  if (typeof y !== 'string' || typeof m !== 'string' || !/^\d{4}$/.test(y) || !/^\d{1,2}$/.test(m)) return null
  const year = Number(y)
  const month = Number(m)
  const nowYear = Number(today.slice(0, 4))
  const nowMonth = Number(today.slice(5, 7))
  if (month < 1 || month > 12 || year < nowYear - PERIOD_YEARS_BACK) return null
  if (year * 12 + month > nowYear * 12 + nowMonth) return null
  return { year, month }
}

/** حالةُ رصد الشهر للحلقة؛ `none` = لم يُنشأ رأسُ الشهر بعد. */
export const REPORT_STATUS_LABELS: Record<ReportStatus | 'none', string> = {
  none: 'لم يبدأ',
  draft: 'مسوّدة',
  submitted: 'مُرسَل',
  approved: 'معتمَد'
}

export const REPORT_STATUS_COLORS: Record<ReportStatus | 'none', 'neutral' | 'warning' | 'info' | 'success'> = {
  none: 'neutral',
  draft: 'warning',
  submitted: 'info',
  approved: 'success'
}

export const OUTCOME_COLORS: Record<Outcome, 'success' | 'warning' | 'neutral' | 'info'> = {
  done: 'success',
  short: 'warning',
  unmeasured: 'neutral',
  unrecorded: 'info'
}

/** ترتيبُ عدّادات الشريط. */
export const OUTCOME_ORDER: Outcome[] = ['done', 'short', 'unmeasured', 'unrecorded']

/** حدُّ ملاحظة الإعادة وملاحظات السجلّ (قيدا القاعدة). */
export const NOTE_MAX = 500

/**
 * هل يكتب صاحبُ الدور سجلّاتِ الشهر الآن؟ مرآةٌ لسياسات `quran_records`:
 * المعتمِدُ ما لم يُعتمد الشهر، والمعلمُ ما دام مسوّدةً (أو لم يبدأ)، ومشرفُ المشروع لا يكتب.
 */
export function canEditMonth(input: { readOnly: boolean, isTeacher: boolean, canApprove: boolean, status: ReportStatus | null }): boolean {
  if (input.readOnly) return false
  if (input.canApprove) return input.status !== 'approved'
  return input.isTeacher && (input.status === null || input.status === 'draft')
}

export type CardAction = 'record' | 'edit' | 'view'

/** زرُّ البطاقة: «رصد» بلا سجلّ، «تعديل» لسجلٍّ قابلٍ للكتابة، «عرض» لما لا يُكتب؛ null لا سجلَّ يُعرض. */
export function cardAction(hasRecord: boolean, canEdit: boolean): CardAction | null {
  if (canEdit) return hasRecord ? 'edit' : 'record'
  return hasRecord ? 'view' : null
}

/** البطاقاتُ المعروضة: خانةُ النتيجة (إن اختيرت) ثم الاسمُ بمطابقةٍ عربيةٍ متسامحة. */
export function visibleRows(rows: StudentMonthRow[], outcome: Outcome | null, query: string): StudentMonthRow[] {
  const needle = arabicFold(query)
  return rows.filter(r => (!outcome || r.outcome === outcome) && (!needle || arabicFold(r.name).includes(needle)))
}

/** شارةُ المطلوب: «المطلوب 12 · أنجز»، و«لم يحضر · لا يُقاس» لمن لم يحضر، و«التحق بعد الأيام · لا يُقاس» لمن لم تنعقد أيامٌ بعد التحاقه، و«بلا مطلوب · …» بلا خطة. */
export function planBadge(row: Pick<StudentMonthRow, 'plan' | 'outcome'>): string {
  const head = row.plan.required !== null
    ? `المطلوب ${row.plan.required}`
    : row.plan.basis === 'absent' ? 'لم يحضر' : row.plan.basis === 'unheld' ? 'التحق بعد الأيام' : 'بلا مطلوب'
  return `${head} · ${OUTCOME_LABELS[row.outcome]}`
}

/** «الناس 1» — اسمُ السورة ورقمُ الآية؛ «—» بلا موضع. */
export function positionLabel(p: Position | null, surahName: (n: number) => string): string {
  return p ? `${surahName(p.surah) || p.surah} ${p.ayah}` : '—'
}

/** ما تُرسله نافذةُ الرصد إلى `saveRecord`. */
export interface RecordInput { from: Position | null, to: Position | null, pagesMemorized: number, pagesReviewed: number | null, notes: string | null }

export interface RecordDraft {
  /** «لم يحفظ جديداً هذا الشهر»: لا مواضعَ والصفحاتُ صفر. */
  none: boolean
  from: Position
  to: Position
  pages: number | null
  reviewed: number | null
  notes: string
}

const pagesInRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= MUSHAF_PAGES

/** أوّلُ خطأٍ في نافذة الرصد برسالةٍ عربية، وnull إن سلمت (القاعدةُ تحرس الشيءَ نفسَه). */
export function recordFormError(d: RecordDraft, ayahCountOf: (surah: number) => number): string | null {
  if (!d.none) {
    const fromCount = ayahCountOf(d.from.surah)
    const toCount = ayahCountOf(d.to.surah)
    if (!fromCount || !toCount) return 'اختر سورتَي البداية والنهاية.'
    if (!Number.isInteger(d.from.ayah) || d.from.ayah < 1 || d.from.ayah > fromCount) return `آيةُ البداية بين 1 و${fromCount}.`
    if (!Number.isInteger(d.to.ayah) || d.to.ayah < 1 || d.to.ayah > toCount) return `آيةُ النهاية بين 1 و${toCount}.`
    if (!isInMemorizationOrder(d.from, d.to)) return 'البدايةُ تسبق النهايةَ بترتيب الحفظ (من الناس إلى الفاتحة).'
  }
  if (d.pages === null || !pagesInRange(d.pages)) return `الصفحاتُ المحفوظة بين 0 و${MUSHAF_PAGES}.`
  if (d.reviewed !== null && !pagesInRange(d.reviewed)) return `صفحاتُ المراجعة بين 0 و${MUSHAF_PAGES}.`
  if (d.notes.trim().length > NOTE_MAX) return `الملاحظاتُ لا تتجاوز ${NOTE_MAX} حرف.`
  return null
}

export const EXPORT_HEADERS = ['الطالب', 'من', 'إلى', 'الصفحات', 'المراجعة', 'حضر/أيام', 'المطلوب', 'التصنيف']

/** صفوفُ Excel بترتيب `EXPORT_HEADERS`. */
export function exportRows(rows: StudentMonthRow[], surahName: (n: number) => string): (string | number | null)[][] {
  return rows.map(r => [
    r.name,
    r.record ? positionLabel(r.record.from, surahName) : '',
    r.record ? positionLabel(r.record.to, surahName) : '',
    r.record?.pagesMemorized ?? null,
    r.record?.pagesReviewed ?? null,
    `${r.daysAttended}/${r.daysHeld}`,
    r.plan.required,
    OUTCOME_LABELS[r.outcome]
  ])
}
