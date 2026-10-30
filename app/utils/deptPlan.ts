/**
 * منطقُ خطة القسم الخالص (بلا شبكة): نسبُ الإنجاز، والمتأخّر وقريبُ الموعد، وتصفيةُ الأنشطة، وحدودُ موعد النشاط،
 * وصياغةُ أرقام الأهداف كما في ملفّ الخطة («هدف 3» و«3-2»).
 */
import { DUE_SOON_DAYS, TASK_DUE_GRACE_DAYS, type DeptTaskStatus } from '~/constants/deptPlan'

export interface PlanTaskLite { id: string, goal_id: string, due_on: string, status: DeptTaskStatus, owners: string[] }
export type TaskFilter = 'all' | 'open' | 'overdue' | 'soon' | 'done' | 'mine'

const OPEN: readonly DeptTaskStatus[] = ['not_started', 'in_progress']

export function isOpen(t: Pick<PlanTaskLite, 'status'>): boolean {
  return OPEN.includes(t.status)
}

/** فات موعده ولم يُغلق (منجزاً أو «لم يتم»). */
export function isOverdue(t: Pick<PlanTaskLite, 'status' | 'due_on'>, today: string): boolean {
  return isOpen(t) && t.due_on < today
}

/** عددُ الأيام من `from` إلى `to` (تاريخان `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5)
}

/** مفتوحٌ وموعدُه اليوم أو خلال يومين. */
export function isDueSoon(t: Pick<PlanTaskLite, 'status' | 'due_on'>, today: string): boolean {
  if (!isOpen(t)) return false
  const d = daysBetween(today, t.due_on)
  return d >= 0 && d <= DUE_SOON_DAYS
}

export interface Progress { done: number, total: number, pct: number }

/** المنجزُ من الكلّ (كما «إنجاز الهدف: 2 من 4 (50%)» في الملف). */
export function progressOf(tasks: Pick<PlanTaskLite, 'status'>[]): Progress {
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 }
}

export function filterTasks<T extends PlanTaskLite>(tasks: T[], filter: TaskFilter, today: string, me: string | null): T[] {
  switch (filter) {
    case 'open': return tasks.filter(isOpen)
    case 'overdue': return tasks.filter(t => isOverdue(t, today))
    case 'soon': return tasks.filter(t => isDueSoon(t, today))
    case 'done': return tasks.filter(t => t.status === 'done')
    case 'mine': return me ? tasks.filter(t => t.owners.includes(me)) : []
    default: return tasks
  }
}

/** حدودُ موعد النشاط لشهر الخطة: من أوّله إلى ما بعد آخره بستة أيام (`dept_task_guard`). */
export function dueRange(year: number, month: number): { min: string, max: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(Date.UTC(year, month, 0))
  last.setUTCDate(last.getUTCDate() + TASK_DUE_GRACE_DAYS)
  return { min: `${year}-${pad(month)}-01`, max: last.toISOString().slice(0, 10) }
}

/** «هدف 3» للهدف الثالث، و«3-2» للنشاط الثاني تحته — ترقيمُ ملفّ الخطة بأرقامٍ إنجليزية (طلب المستخدم 2026-10-30). */
export function goalLabel(goalIndex: number): string {
  return `هدف ${goalIndex + 1}`
}
export function taskLabel(goalIndex: number, taskIndex: number): string {
  return `${goalIndex + 1}-${taskIndex + 1}`
}

/** «11-2026» للشهر (الأشهرُ أرقاماً لا أسماء — قاعدة المنصّة). */
export function planMonthLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${year}`
}

/** «DD/MM». */
export function shortDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** الشهرُ التالي/السابق مع عبور السنة. */
export function shiftPlanMonth(year: number, month: number, by: number): { year: number, month: number } {
  const idx = year * 12 + (month - 1) + by
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/** نقلُ موعد نشاطٍ إلى الشهر التالي باليوم نفسه (أو آخر الشهر إن قصر) — لنسخ الخطة. */
export function carryDueDate(due: string, year: number, month: number): string {
  const day = Number(due.slice(8, 10))
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`
}
