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
}

/** حدُّ التأخّر في المنتصف: نصفُ هدف الشهر. */
export const midThreshold = (monthTarget: number) => monthTarget / 2

/** صفوفُ المتابعة: المسلِّمةُ مرتّبةً بالأضعف متوسّطاً، وغيرُ المسلِّمة قائمةٌ منفصلة. */
export function midmonthSummary(input: {
  halaqat: MidHalaqa[]
  heads: MidHead[]
  records: MidRecord[]
  students: MidStudent[]
  monthTarget: number
}): { submitted: MidRow[], missing: MidHalaqa[] } {
  const threshold = midThreshold(input.monthTarget)
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
    submitted.push({
      id: h.id,
      name: h.name,
      teacher: h.teacher,
      submittedAt: head.submitted_at,
      students: recs.length,
      avgPages: recs.length ? Math.round((total / recs.length) * 10) / 10 : 0,
      late: recs.filter(r => r.pages_memorized > 0 && r.pages_memorized < threshold).map(r => nameOf.get(r.student_id) ?? '—'),
      none: recs.filter(r => r.pages_memorized === 0).map(r => nameOf.get(r.student_id) ?? '—'),
      unrecorded: input.students.filter(s => s.halaqa_id === h.id && !recorded.has(s.id)).map(s => s.full_name)
    })
  }
  submitted.sort((a, b) => a.avgPages - b.avgPages || a.name.localeCompare(b.name, 'ar'))
  missing.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return { submitted, missing }
}
