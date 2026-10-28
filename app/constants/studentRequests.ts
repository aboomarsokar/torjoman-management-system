/**
 * طلباتُ الطلاب (طلب المستخدم 2026-10-27): إضافةُ طالب، ومنذ 2026-10-28 **حذفُه** (إنهاءُ التحاقه) — حدودُها تطابق قيودَ
 * جدول `student_requests`.
 */
export const REQUEST_NAME_MIN = 6
export const REQUEST_NAME_MAX = 120
export const REQUEST_NOTE_MAX = 300
/** أقصرُ سببٍ للرفض (قيدُ `student_requests_reject_has_note`). */
export const REJECT_NOTE_MIN = 3
/** أقصرُ سببٍ لطلب الحذف (قيدُ `student_requests_remove_has_reason`). */
export const REMOVE_REASON_MIN = 3

export type StudentRequestKind = 'add' | 'remove'
export type StudentRequestStatus = 'open' | 'added' | 'rejected' | 'removed'

export const STUDENT_REQUEST_STATUS: Record<StudentRequestStatus, { label: string, color: 'warning' | 'success' | 'error' }> = {
  open: { label: 'بانتظار الإدارة', color: 'warning' },
  added: { label: 'أُضيف', color: 'success' },
  removed: { label: 'أُنهي التحاقُه', color: 'success' },
  rejected: { label: 'رُفض', color: 'error' }
}

export const STUDENT_REQUEST_KIND: Record<StudentRequestKind, { label: string, color: 'info' | 'error', icon: string }> = {
  add: { label: 'إضافة', color: 'info', icon: 'i-lucide-user-plus' },
  remove: { label: 'حذف', color: 'error', icon: 'i-lucide-user-minus' }
}
