/**
 * خطةُ القسم الشهرية (طلب المستخدم 2026-10-30): حدودُ الحقول (تطابق قيود القاعدة) وتسمياتُ الحالة وألوانُها،
 * ومن يقرأ الخطة كاملة، وحقولُ تقرير القسم آخر الشهر.
 */
import type { Database } from '~/types/database.types'

export type DeptTaskStatus = Database['public']['Enums']['dept_task_status']

export const MAX_DEPT_GOALS = 10
export const MAX_GOAL_TITLE = 300
export const MAX_TASK_TITLE = 400
export const MAX_TASK_NOTES = 1000
export const MAX_REPORT_FIELD = 3000
/** موعدُ النشاط يجوز بعد نهاية شهر الخطة بهذا العدد من الأيام على الأكثر (يطابق `dept_task_guard`). */
export const TASK_DUE_GRACE_DAYS = 6
/** «قريب الموعد»: ما بقي على موعده يومان أو أقلّ (يطابق تذكير القاعدة قبل الموعد بيومين). */
export const DUE_SOON_DAYS = 2

export const DEPT_TASK_STATUSES: readonly DeptTaskStatus[] = ['not_started', 'in_progress', 'done', 'not_done']

export const DEPT_TASK_STATUS_LABEL: Record<DeptTaskStatus, string> = {
  not_started: 'لم يبدأ',
  in_progress: 'قيد التنفيذ',
  done: 'منجز',
  not_done: 'لم يتم'
}

export const DEPT_TASK_STATUS_COLOR: Record<DeptTaskStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  not_started: 'neutral',
  in_progress: 'info',
  done: 'success',
  not_done: 'error'
}

export const DEPT_TASK_STATUS_ICON: Record<DeptTaskStatus, string> = {
  not_started: 'i-lucide-circle-dashed',
  in_progress: 'i-lucide-loader',
  done: 'i-lucide-circle-check',
  not_done: 'i-lucide-circle-x'
}

/** من يقرأ الخطة كاملة (يطابق `can_view_full_dept_plan`)؛ غيرُهم يرى أنشطته وحده. */
export const DEPT_PLAN_FULL_VIEWERS = ['admin_manager', 'technical_manager', 'women_admin', 'project_supervisor'] as const

export const DEPT_REPORT_FIELDS = [
  { key: 'report_achievements', label: 'أهم إنجازات القسم هذا الشهر' },
  { key: 'report_not_done', label: 'ما الذي لم يتم ولماذا؟' },
  { key: 'report_obstacles', label: 'العوائق، وما المطلوب من الإدارة؟' },
  { key: 'report_team_notes', label: 'ملاحظات على الفريق' }
] as const

export type DeptReportKey = typeof DEPT_REPORT_FIELDS[number]['key']
