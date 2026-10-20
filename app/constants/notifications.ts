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
  'statement_returned'
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
  statement_returned: 'i-lucide-undo-2'
}

/** آخرُ ما يُعرض في لوحة الجرس. */
export const INBOX_LIMIT = 30

export function notificationIcon(kind: string): string {
  return (NOTIFICATION_ICONS as Record<string, string>)[kind] ?? 'i-lucide-bell'
}
