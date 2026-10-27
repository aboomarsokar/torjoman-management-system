/**
 * طلبُ إضافة طالب (طلب المستخدم 2026-10-27) — حدودُه تطابق قيودَ جدول `student_requests`.
 */
export const REQUEST_NAME_MIN = 6
export const REQUEST_NAME_MAX = 120
export const REQUEST_NOTE_MAX = 300
/** أقصرُ سببٍ للرفض (قيدُ `student_requests_reject_has_note`). */
export const REJECT_NOTE_MIN = 3

export type StudentRequestStatus = 'open' | 'added' | 'rejected'

export const STUDENT_REQUEST_STATUS: Record<StudentRequestStatus, { label: string, color: 'warning' | 'success' | 'error' }> = {
  open: { label: 'بانتظار الإدارة', color: 'warning' },
  added: { label: 'أُضيف', color: 'success' },
  rejected: { label: 'رُفض', color: 'error' }
}
