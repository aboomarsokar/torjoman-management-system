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
