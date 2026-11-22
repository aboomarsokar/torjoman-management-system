import { examReliefThirds } from '~/constants/quran'
import { gazaToday } from '~/utils/reportWindow'

/**
 * محطةُ منتصف الشهر (طلب المستخدم 2026-11-21): متى يُتاح للمعلّم «تسليم رصد المنتصف»، وجدولُ المتابعة —
 * لكلّ حلقةٍ: هل سلّمت، ومتوسّطُ صفحات الحفظ، ومن تأخّر (أقلُّ من نصف هدف الشهر) ومن لم يحفظ شيئاً ومن لم يُرصد.
 * الحسابُ من صورة المنتصف المحفوظة (`quran_mid_records`) لا من المسوّدة الحيّة.
 */

/** سببُ تعطيل «تسليم رصد المنتصف»، أو null إن كان متاحاً. */
export function midSubmitBlock(input: {
  online: boolean
  pending: number
  isCurrentMonth: boolean
  entryOpen: boolean
  status: string | null
  hasReport: boolean
}): string | null {
  if (!input.isCurrentMonth) return 'رصدُ المنتصف للشهر الجاري وحده.'
  if (input.status && input.status !== 'draft') return 'أُرسل رصدُ الشهر — لا تسليمَ للمنتصف بعده.'
  if (!input.entryOpen) return 'يُفتح تسليمُ رصد المنتصف يومَ 15.'
  if (!input.online) return 'التسليمُ يحتاج اتصالاً.'
  if (input.pending) return 'انتظر رفعَ ما رصدتَه قبل التسليم.'
  if (!input.hasReport) return 'ارصد طلابك أوّلاً.'
  return null
}

export interface MidHalaqa { id: string, name: string, teacher: string | null }
export interface MidHead { report_id: string, halaqa_id: string, submitted_at: string }
export interface MidRecord { halaqa_id: string, student_id: string, pages_memorized: number }
export interface MidStudent { id: string, halaqa_id: string, full_name: string }
/** اختبارٌ في الشهر: عددُ أجزاء دورته. */
export interface MidExam { student_id: string, exam_date: string, parts: number }
export interface MidTested { name: string, parts: number }

export interface MidRow {
  id: string
  name: string
  teacher: string | null
  submittedAt: string
  students: number
  avgPages: number
  /** أقلُّ من نصف الهدف (وحفظ شيئاً). */
  late: string[]
  /** لم يحفظ جديداً. */
  none: string[]
  /** طلابُ الحلقة الحاليّون الذين لا سجلَّ لهم في الصورة. */
  unrecorded: string[]
  /** من اختُبر قبل التسليم فخُفّض حدُّه (وسمٌ للقارئ). */
  tested: MidTested[]
}

/** حدُّ التأخّر في المنتصف: نصفُ هدف الشهر. */
export const midThreshold = (monthTarget: number) => monthTarget / 2

/**
 * حدُّ الطالب في المنتصف (قرار المستخدم 2026-11-22): من اختُبر قبل تسليم رصد المنتصف يُطرح تخفيضُ الشهر **كاملاً**
 * من نصف الهدف (3 أجزاء الثلث، 5 الثلثان، 10 الكلّ — بأكبرها)، ولا ينزل عن صفر: 3 أجزاء من 30 ← 15 − 10 = 5.
 */
export function studentMidThreshold(monthTarget: number, thirds: number): number {
  return Math.max(0, midThreshold(monthTarget) - (monthTarget * thirds) / 3)
}

/** أكبرُ اختبارٍ للطالب حتى يوم التسليم (بتوقيت غزة) في شهر الصورة: عددُ أجزائه، أو 0. */
export function testedPartsBefore(exams: MidExam[], studentId: string, submittedAt: string): number {
  const day = gazaToday(new Date(submittedAt))
  const month = day.slice(0, 7)
  return exams
    .filter(e => e.student_id === studentId && e.exam_date.slice(0, 7) === month && e.exam_date <= day && examReliefThirds(e.parts) > 0)
    .reduce((best, e) => (examReliefThirds(e.parts) > examReliefThirds(best) ? e.parts : best), 0)
}

/** صفوفُ المتابعة: المسلِّمةُ مرتّبةً بالأضعف متوسّطاً، وغيرُ المسلِّمة قائمةٌ منفصلة. */
export function midmonthSummary(input: {
  halaqat: MidHalaqa[]
  heads: MidHead[]
  records: MidRecord[]
  students: MidStudent[]
  monthTarget: number
  exams?: MidExam[]
}): { submitted: MidRow[], missing: MidHalaqa[] } {
  const exams = input.exams ?? []
  const nameOf = new Map(input.students.map(s => [s.id, s.full_name]))
  const submitted: MidRow[] = []
  const missing: MidHalaqa[] = []
  for (const h of input.halaqat) {
    const head = input.heads.find(x => x.halaqa_id === h.id)
    if (!head) {
      missing.push(h)
      continue
    }
    const recs = input.records.filter(r => r.halaqa_id === h.id)
    const recorded = new Set(recs.map(r => r.student_id))
    const total = recs.reduce((t, r) => t + r.pages_memorized, 0)
    const tested = new Map(recs.map(r => [r.student_id, testedPartsBefore(exams, r.student_id, head.submitted_at)]))
    const limit = (id: string) => studentMidThreshold(input.monthTarget, examReliefThirds(tested.get(id) ?? 0))
    submitted.push({
      id: h.id,
      name: h.name,
      teacher: h.teacher,
      submittedAt: head.submitted_at,
      students: recs.length,
      avgPages: recs.length ? Math.round((total / recs.length) * 10) / 10 : 0,
      late: recs.filter(r => r.pages_memorized > 0 && r.pages_memorized < limit(r.student_id)).map(r => nameOf.get(r.student_id) ?? '—'),
      // لم يحفظ جديداً ومطلوبُه في المنتصف أكثرُ من صفر (المُعفى باختباره لا يُعدّ)
      none: recs.filter(r => r.pages_memorized === 0 && limit(r.student_id) > 0).map(r => nameOf.get(r.student_id) ?? '—'),
      tested: recs.filter(r => (tested.get(r.student_id) ?? 0) > 0).map(r => ({ name: nameOf.get(r.student_id) ?? '—', parts: tested.get(r.student_id)! })),
      unrecorded: input.students.filter(s => s.halaqa_id === h.id && !recorded.has(s.id)).map(s => s.full_name)
    })
  }
  submitted.sort((a, b) => a.avgPages - b.avgPages || a.name.localeCompare(b.name, 'ar'))
  missing.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return { submitted, missing }
}
