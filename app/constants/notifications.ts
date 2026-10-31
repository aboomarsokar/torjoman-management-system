/**
 * أنواعُ الإشعارات وأيقوناتُها — القائمةُ تطابق قيدَ `kind` في هجرة `*_notifications.sql`
 * (يحرسها اختبار). الإشعارُ خبرٌ عن أمرٍ وقع؛ طوابيرُ العمل في `useNotifications`.
 */
export const NOTIFICATION_KINDS = [
  'report_submitted',
  'report_approved',
  'report_returned',
  'alert_issued',
  'visit_scheduled',
  'exam_nominated',
  'exam_graded',
  'transport_paid',
  'impersonation_started',
  'impersonation_write',
  'statement_returned',
  'visit_result',
  'visit_unlocked',
  'visit_rescheduled',
  'quality_month',
  'quality_unlocked',
  'halaqa_time_changed',
  'booklet_delivered',
  'booklet_requested',
  'announcement',
  'student_requested',
  'student_request_closed',
  'off_day_reported',
  'off_day_rejected',
  'plan_task_assigned',
  'plan_task_due',
  'plan_task_overdue',
  'plan_weekly_update',
  'booklet_ready',
  'booklet_request_cancelled',
  'booklet_stock_low'
] as const

export type NotificationKind = typeof NOTIFICATION_KINDS[number]

export const NOTIFICATION_ICONS: Record<NotificationKind, string> = {
  report_submitted: 'i-lucide-file-up',
  report_approved: 'i-lucide-file-check',
  report_returned: 'i-lucide-file-x',
  alert_issued: 'i-lucide-triangle-alert',
  visit_scheduled: 'i-lucide-calendar-clock',
  exam_nominated: 'i-lucide-clipboard-list',
  exam_graded: 'i-lucide-clipboard-check',
  transport_paid: 'i-lucide-wallet',
  impersonation_started: 'i-lucide-eye',
  impersonation_write: 'i-lucide-pencil',
  statement_returned: 'i-lucide-undo-2',
  visit_result: 'i-lucide-clipboard-check',
  visit_unlocked: 'i-lucide-lock-open',
  visit_rescheduled: 'i-lucide-calendar-sync',
  quality_month: 'i-lucide-badge-check',
  quality_unlocked: 'i-lucide-lock-open',
  halaqa_time_changed: 'i-lucide-clock',
  booklet_delivered: 'i-lucide-book-copy',
  booklet_requested: 'i-lucide-package-plus',
  booklet_ready: 'i-lucide-package-open',
  booklet_request_cancelled: 'i-lucide-package-x',
  booklet_stock_low: 'i-lucide-triangle-alert',
  announcement: 'i-lucide-megaphone',
  student_requested: 'i-lucide-user-plus',
  student_request_closed: 'i-lucide-user-check',
  off_day_reported: 'i-lucide-calendar-x',
  off_day_rejected: 'i-lucide-calendar-x-2',
  plan_task_assigned: 'i-lucide-clipboard-plus',
  plan_task_due: 'i-lucide-alarm-clock',
  plan_task_overdue: 'i-lucide-clock-alert',
  plan_weekly_update: 'i-lucide-list-checks'
}

/** آخرُ ما يُعرض في لوحة الجرس. */
export const INBOX_LIMIT = 30

export function notificationIcon(kind: string): string {
  return (NOTIFICATION_ICONS as Record<string, string>)[kind] ?? 'i-lucide-bell'
}
