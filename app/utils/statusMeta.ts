/**
 * خرائط الحالات الموحّدة (شارة: عنوان + لون) — مصدر وحيد لكل الشاشات
 * كي لا تتباعد الألوان/التسميات بين الصفحات مع الوقت.
 */
export type BadgeColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'
export type StatusBadge = { label: string, color: BadgeColor }

/** حالة التقرير الشهري (§4.17). */
export const REPORT_STATUS: Record<string, StatusBadge> = {
  draft: { label: 'مسودّة', color: 'neutral' },
  submitted: { label: 'مُرسل', color: 'warning' },
  approved: { label: 'معتمد', color: 'success' }
}

/** حالة الزيارة الإشرافية (§4.7–4.9). */
export const VISIT_STATUS: Record<string, StatusBadge> = {
  scheduled: { label: 'مجدولة', color: 'info' },
  done: { label: 'تمّت', color: 'success' },
  // مجدولةٌ فات موعدُها بلا تنفيذ (`visitDisplayStatus`)؛ المنفّذةُ بعد موعدها «تمّت» (قرار 2026-10-21)
  late: { label: 'متأخّرة', color: 'error' }
}

/** حالة كشف حوافز الحلقة (§4.25). */
export const STATEMENT_STATUS: Record<string, StatusBadge> = {
  draft: { label: 'مسودّة', color: 'neutral' },
  submitted: { label: 'مُسلّم', color: 'warning' },
  reviewed: { label: 'مُطّلع عليه', color: 'success' }
}

/** حالة حساب العامل (§4.12). */
export const WORKER_STATUS: Record<string, StatusBadge> = {
  active: { label: 'نشط', color: 'success' },
  pending: { label: 'بانتظار التفعيل', color: 'warning' },
  disabled: { label: 'معطّل', color: 'neutral' }
}

/** حالة الطالب (§4.23). */
export const STUDENT_STATUS: Record<string, StatusBadge> = {
  active: { label: 'نشط', color: 'success' },
  withdrawn: { label: 'منقطع', color: 'warning' },
  graduated: { label: 'متخرّج', color: 'info' },
  transferred: { label: 'منقول', color: 'neutral' }
}

/** حالةُ الطالبة بالمؤنّث (2026-10-22) — الألوانُ نفسُها. */
const STUDENT_STATUS_F: Record<string, string> = { active: 'نشطة', withdrawn: 'منقطعة', graduated: 'متخرّجة', transferred: 'منقولة' }
export function studentStatusLabel(status: string, gender: string | null | undefined): string {
  return (gender === 'female' ? STUDENT_STATUS_F[status] : undefined) ?? STUDENT_STATUS[status]?.label ?? status
}

/** «6 طالبات» / «طالبٌ واحد» / «طالبتان» / «12 طالباً» — عددُ طلاب الحلقة بتمييزه وجنسها. */
export function studentsCountText(n: number, female: boolean): string {
  if (n === 0) return female ? 'لا طالبات' : 'لا طلاب'
  if (n === 1) return female ? 'طالبةٌ واحدة' : 'طالبٌ واحد'
  if (n === 2) return female ? 'طالبتان' : 'طالبان'
  return `${n} ${female ? (n <= 10 ? 'طالبات' : 'طالبة') : (n <= 10 ? 'طلاب' : 'طالباً')}`
}

/** «3 أجزاء» / «جزءٌ واحد» / «15 جزءاً» — عددُ الأجزاء المحفوظة بتمييزه. */
export function juzCountText(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n === 0) return 'لا أجزاء'
  if (n === 1) return 'جزءٌ واحد'
  if (n === 2) return 'جزآن'
  return `${n} ${n <= 10 ? 'أجزاء' : 'جزءاً'}`
}
