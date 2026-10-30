/**
 * خطةُ القسم الشهرية (طلب المستخدم 2026-10-30): قراءةُ خطة شهرٍ بأهدافها وأنشطتها ومسؤوليها، والكتابةُ للمدير الإداريّ
 * (الخطة والأهداف والأنشطة والإسناد والتقرير)، وتحديثُ المسؤول لحالة نشاطه (`update_my_dept_task`). الحكمُ لـRLS.
 */
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'
import { DEPT_PLAN_FULL_VIEWERS, MAX_GOAL_TITLE, MAX_REPORT_FIELD, MAX_TASK_NOTES, MAX_TASK_TITLE, type DeptReportKey, type DeptTaskStatus } from '~/constants/deptPlan'
import { carryDueDate, dueRange, shiftPlanMonth } from '~/utils/deptPlan'

export type DeptPlan = Database['public']['Tables']['dept_plans']['Row']
export type DeptGoal = Database['public']['Tables']['dept_plan_goals']['Row']
export type DeptTaskRow = Database['public']['Tables']['dept_plan_tasks']['Row']
export interface DeptTask extends DeptTaskRow { owners: string[] }
export interface StaffOption { id: string, name: string, role: Role, gender: 'male' | 'female' | null }
export interface TaskDraft { goalId: string, title: string, dueOn: string, owners: string[] }

/** خطأُ نموذج النشاط بالعربية، أو null. */
export function taskDraftError(d: TaskDraft, year: number, month: number): string | null {
  const title = d.title.trim()
  if (!title) return 'اكتب النشاط.'
  if (title.length > MAX_TASK_TITLE) return `النشاط لا يتجاوز ${MAX_TASK_TITLE} حرف.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueOn)) return 'اختر الموعد.'
  const { min, max } = dueRange(year, month)
  if (d.dueOn < min || d.dueOn > max) return 'الموعد يكون داخل شهر الخطة.'
  if (!d.owners.length) return 'اختر مسؤولاً واحداً على الأقل.'
  return null
}

export function goalTitleError(title: string): string | null {
  const t = title.trim()
  if (!t) return 'اكتب الهدف.'
  if (t.length > MAX_GOAL_TITLE) return `الهدف لا يتجاوز ${MAX_GOAL_TITLE} حرف.`
  return null
}

export function useDeptPlan(year: Ref<number>, month: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()

  const plan = ref<DeptPlan | null>(null)
  const goals = ref<DeptGoal[]>([])
  const tasks = ref<DeptTask[]>([])
  const staff = ref<StaffOption[]>([])
  const loading = ref(false)
  const busy = ref(false)

  const fail = (title: string) => {
    toast.add({ title, color: 'warning', icon: 'i-lucide-circle-alert' })
    return false
  }
  const done = (title: string) => toast.add({ title, color: 'success', icon: 'i-lucide-circle-check' })

  async function load() {
    loading.value = true
    const { data: p, error } = await supabase.from('dept_plans').select('*')
      .eq('plan_year', year.value).eq('plan_month', month.value).maybeSingle()
    if (error) {
      loading.value = false
      return handle(error)
    }
    plan.value = p
    if (!p) {
      goals.value = []
      tasks.value = []
      loading.value = false
      return
    }
    const [g, t, o] = await Promise.all([
      supabase.from('dept_plan_goals').select('*').eq('plan_id', p.id).order('sort_order').order('created_at'),
      supabase.from('dept_plan_tasks').select('*').eq('plan_id', p.id).order('sort_order').order('created_at'),
      supabase.from('dept_plan_task_owners').select('task_id, profile_id, dept_plan_tasks!inner(plan_id)').eq('dept_plan_tasks.plan_id', p.id)
    ])
    loading.value = false
    const err = g.error ?? t.error ?? o.error
    if (err) return handle(err)
    const owners = new Map<string, string[]>()
    for (const row of o.data ?? []) owners.set(row.task_id, [...(owners.get(row.task_id) ?? []), row.profile_id])
    goals.value = g.data ?? []
    tasks.value = (t.data ?? []).map(x => ({ ...x, owners: owners.get(x.id) ?? [] }))
  }

  /** القياداتُ النشطون (مسؤولو الأنشطة — `dept_owner_guard`) — للمدير الإداريّ عند الإسناد، ولأسماء المسؤولين. */
  async function loadStaff() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role, gender')
      .in('role', [...DEPT_PLAN_FULL_VIEWERS]).eq('status', 'active').order('full_name')
    if (error) return handle(error)
    staff.value = (data ?? []).map(s => ({ id: s.id, name: s.full_name, role: s.role, gender: s.gender }))
  }

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string): Promise<boolean> {
    busy.value = true
    const { error } = await fn()
    busy.value = false
    if (error) {
      handle(error)
      return false
    }
    done(ok)
    await load()
    return true
  }

  function createPlan() {
    return run(() => supabase.from('dept_plans').insert({ plan_year: year.value, plan_month: month.value }), 'أُنشئت خطة الشهر.')
  }

  /** خطةُ الشهر نسخةٌ من الشهر السابق: الأهدافُ والأنشطةُ ومسؤولوها، بمواعيد منقولة وحالةٍ جديدة. */
  async function copyFromPrevious(): Promise<boolean> {
    const prev = shiftPlanMonth(year.value, month.value, -1)
    busy.value = true
    const { data: src, error } = await supabase.from('dept_plans').select('id')
      .eq('plan_year', prev.year).eq('plan_month', prev.month).maybeSingle()
    if (error || !src) {
      busy.value = false
      return error ? (handle(error), false) : fail('لا خطة في الشهر السابق لنسخها.')
    }
    const [g, t, o] = await Promise.all([
      supabase.from('dept_plan_goals').select('*').eq('plan_id', src.id).order('sort_order'),
      supabase.from('dept_plan_tasks').select('*').eq('plan_id', src.id).order('sort_order'),
      supabase.from('dept_plan_task_owners').select('task_id, profile_id, dept_plan_tasks!inner(plan_id)').eq('dept_plan_tasks.plan_id', src.id)
    ])
    const readErr = g.error ?? t.error ?? o.error
    if (readErr) {
      busy.value = false
      handle(readErr)
      return false
    }
    const { data: np, error: pe } = await supabase.from('dept_plans')
      .insert({ plan_year: year.value, plan_month: month.value }).select('id').single()
    if (pe || !np) {
      busy.value = false
      if (pe) handle(pe)
      return false
    }
    for (const goal of g.data ?? []) {
      const { data: ng, error: ge } = await supabase.from('dept_plan_goals')
        .insert({ plan_id: np.id, title: goal.title, sort_order: goal.sort_order }).select('id').single()
      if (ge || !ng) {
        busy.value = false
        if (ge) handle(ge)
        return false
      }
      for (const task of (t.data ?? []).filter(x => x.goal_id === goal.id)) {
        const { data: nt, error: te } = await supabase.from('dept_plan_tasks').insert({
          plan_id: np.id, goal_id: ng.id, title: task.title, sort_order: task.sort_order,
          due_on: carryDueDate(task.due_on, year.value, month.value)
        }).select('id').single()
        if (te || !nt) {
          busy.value = false
          if (te) handle(te)
          return false
        }
        const owners = (o.data ?? []).filter(x => x.task_id === task.id).map(x => ({ task_id: nt.id, profile_id: x.profile_id }))
        if (owners.length) {
          const { error: oe } = await supabase.from('dept_plan_task_owners').insert(owners)
          if (oe) {
            busy.value = false
            handle(oe)
            return false
          }
        }
      }
    }
    busy.value = false
    done('نُسخت خطة الشهر السابق — راجع المواعيد.')
    await load()
    return true
  }

  function saveGoal(title: string, id?: string) {
    const problem = goalTitleError(title)
    if (problem) return Promise.resolve(fail(problem))
    if (!plan.value) return Promise.resolve(false)
    const planId = plan.value.id
    return id
      ? run(() => supabase.from('dept_plan_goals').update({ title: title.trim() }).eq('id', id), 'حُفظ الهدف.')
      : run(() => supabase.from('dept_plan_goals').insert({ plan_id: planId, title: title.trim(), sort_order: goals.value.length }), 'أُضيف الهدف.')
  }

  function removeGoal(id: string) {
    return run(() => supabase.from('dept_plan_goals').delete().eq('id', id), 'حُذف الهدف وأنشطته.')
  }

  /** يضيف نشاطاً أو يعدّله، ويضبط مسؤوليه (المُضافون يُشعَرون بالإسناد في القاعدة). */
  async function saveTask(d: TaskDraft, id?: string): Promise<boolean> {
    const problem = taskDraftError(d, year.value, month.value)
    if (problem) return fail(problem)
    if (!plan.value) return false
    busy.value = true
    let taskId = id
    if (id) {
      const { error } = await supabase.from('dept_plan_tasks')
        .update({ goal_id: d.goalId, title: d.title.trim(), due_on: d.dueOn }).eq('id', id)
      if (error) {
        busy.value = false
        handle(error)
        return false
      }
    } else {
      const order = tasks.value.filter(t => t.goal_id === d.goalId).length
      const { data, error } = await supabase.from('dept_plan_tasks')
        .insert({ plan_id: plan.value.id, goal_id: d.goalId, title: d.title.trim(), due_on: d.dueOn, sort_order: order })
        .select('id').single()
      if (error || !data) {
        busy.value = false
        if (error) handle(error)
        return false
      }
      taskId = data.id
    }
    const before = tasks.value.find(t => t.id === id)?.owners ?? []
    const added = d.owners.filter(p => !before.includes(p))
    const removed = before.filter(p => !d.owners.includes(p))
    if (removed.length) {
      const { error } = await supabase.from('dept_plan_task_owners').delete().eq('task_id', taskId!).in('profile_id', removed)
      if (error) {
        busy.value = false
        handle(error)
        return false
      }
    }
    if (added.length) {
      const { error } = await supabase.from('dept_plan_task_owners').insert(added.map(p => ({ task_id: taskId!, profile_id: p })))
      if (error) {
        busy.value = false
        handle(error)
        return false
      }
    }
    busy.value = false
    done(id ? 'حُفظ النشاط.' : 'أُضيف النشاط.')
    await load()
    return true
  }

  function removeTask(id: string) {
    return run(() => supabase.from('dept_plan_tasks').delete().eq('id', id), 'حُذف النشاط.')
  }

  /** المسؤولُ (أو المدير الإداريّ) يحدّث الحالة والملاحظة. */
  function updateStatus(id: string, status: DeptTaskStatus, notes: string) {
    if (notes.trim().length > MAX_TASK_NOTES) return Promise.resolve(fail(`الملاحظة لا تتجاوز ${MAX_TASK_NOTES} حرف.`))
    return run(() => supabase.rpc('update_my_dept_task', { p_task: id, p_status: status, p_notes: notes.trim() || undefined }), 'حُدّثت الحالة.')
  }

  function saveReport(report: Record<DeptReportKey, string>) {
    if (!plan.value) return Promise.resolve(false)
    if (Object.values(report).some(v => v.trim().length > MAX_REPORT_FIELD)) return Promise.resolve(fail(`كل حقل لا يتجاوز ${MAX_REPORT_FIELD} حرف.`))
    const clean = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.trim() || null])) as Record<DeptReportKey, string | null>
    const id = plan.value.id
    return run(() => supabase.from('dept_plans').update(clean).eq('id', id), 'حُفظ تقرير القسم.')
  }

  return { plan, goals, tasks, staff, loading, busy, load, loadStaff, createPlan, copyFromPrevious, saveGoal, removeGoal, saveTask, removeTask, updateStatus, saveReport }
}
