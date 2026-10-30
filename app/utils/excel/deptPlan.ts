/**
 * تصديرُ خطة القسم إلى Excel بشكل ملفّ الخطة المعتاد: «م | الهدف ← النشاط | المسؤول | الموعد | الحالة | ملاحظات»،
 * سطرُ الهدف بإنجازه ثم أنشطتُه، وورقةٌ ثانيةٌ لتقرير القسم.
 */
import type { DeptGoal, DeptPlan, DeptTask } from '~/composables/useDeptPlan'
import { DEPT_REPORT_FIELDS, DEPT_TASK_STATUS_LABEL } from '~/constants/deptPlan'
import { goalLabel, progressOf, shortDay, taskLabel } from '~/utils/deptPlan'
import type { SheetSpec } from '~/utils/excel/workbook'

export function deptPlanSheets(plan: DeptPlan, goals: DeptGoal[], tasks: DeptTask[], names: Record<string, string>): SheetSpec[] {
  const rows: SheetSpec['rows'] = []
  goals.forEach((g, gi) => {
    const own = tasks.filter(t => t.goal_id === g.id)
    const p = progressOf(own)
    rows.push({ no: goalLabel(gi), title: g.title, owner: '', due: '', status: `إنجاز الهدف: ${p.done} من ${p.total} (${p.pct}%)`, notes: '' })
    own.forEach((t, ti) => rows.push({
      no: taskLabel(gi, ti),
      title: t.title,
      owner: t.owners.map(id => names[id] ?? '').filter(Boolean).join(' و'),
      due: shortDay(t.due_on),
      status: DEPT_TASK_STATUS_LABEL[t.status],
      notes: t.notes ?? ''
    }))
  })
  return [
    {
      name: 'خطة القسم',
      columns: [
        { header: 'م', key: 'no', width: 9 },
        { header: 'الهدف ← النشاط', key: 'title', width: 60 },
        { header: 'المسؤول', key: 'owner', width: 28 },
        { header: 'الموعد', key: 'due', width: 10 },
        { header: 'الحالة', key: 'status', width: 26 },
        { header: 'ملاحظات', key: 'notes', width: 40 }
      ],
      rows
    },
    {
      name: 'تقرير القسم',
      columns: [{ header: 'البند', key: 'label', width: 36 }, { header: 'التقرير', key: 'text', width: 90 }],
      rows: DEPT_REPORT_FIELDS.map(f => ({ label: f.label, text: plan[f.key] ?? '' }))
    }
  ]
}
