import { describe, expect, it } from 'vitest'
import { carryDueDate, daysBetween, dueRange, filterTasks, goalLabel, isDueSoon, isOverdue, planMonthLabel, progressOf, shiftPlanMonth, taskLabel, type PlanTaskLite } from './deptPlan'

const t = (id: string, due_on: string, status: PlanTaskLite['status'], owners: string[] = []): PlanTaskLite =>
  ({ id, goal_id: 'g', due_on, status, owners })

describe('خطة القسم', () => {
  it('المتأخّر: فات موعده وما زال مفتوحاً', () => {
    expect(isOverdue(t('a', '2026-11-02', 'not_started'), '2026-11-03')).toBe(true)
    expect(isOverdue(t('a', '2026-11-02', 'in_progress'), '2026-11-02')).toBe(false)
    expect(isOverdue(t('a', '2026-11-02', 'done'), '2026-11-10')).toBe(false)
    expect(isOverdue(t('a', '2026-11-02', 'not_done'), '2026-11-10')).toBe(false)
  })

  it('قريب الموعد: اليوم أو خلال يومين', () => {
    expect(isDueSoon(t('a', '2026-11-05', 'not_started'), '2026-11-03')).toBe(true)
    expect(isDueSoon(t('a', '2026-11-03', 'in_progress'), '2026-11-03')).toBe(true)
    expect(isDueSoon(t('a', '2026-11-06', 'not_started'), '2026-11-03')).toBe(false)
    expect(isDueSoon(t('a', '2026-11-02', 'not_started'), '2026-11-03')).toBe(false)
    expect(isDueSoon(t('a', '2026-11-04', 'done'), '2026-11-03')).toBe(false)
  })

  it('نسبة الإنجاز من المنجز وحده', () => {
    expect(progressOf([t('a', '', 'done'), t('b', '', 'not_done'), t('c', '', 'in_progress'), t('d', '', 'done')]))
      .toEqual({ done: 2, total: 4, pct: 50 })
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 })
  })

  it('التصفية', () => {
    const list = [t('a', '2026-11-01', 'not_started', ['u1']), t('b', '2026-11-04', 'in_progress', ['u2']), t('c', '2026-11-01', 'done', ['u1'])]
    const today = '2026-11-03'
    expect(filterTasks(list, 'overdue', today, null).map(x => x.id)).toEqual(['a'])
    expect(filterTasks(list, 'soon', today, null).map(x => x.id)).toEqual(['b'])
    expect(filterTasks(list, 'open', today, null).map(x => x.id)).toEqual(['a', 'b'])
    expect(filterTasks(list, 'done', today, null).map(x => x.id)).toEqual(['c'])
    expect(filterTasks(list, 'mine', today, 'u1').map(x => x.id)).toEqual(['a', 'c'])
    expect(filterTasks(list, 'mine', today, null)).toEqual([])
    expect(filterTasks(list, 'all', today, null)).toHaveLength(3)
  })

  it('حدود الموعد: من أول الشهر إلى ما بعد آخره بستة أيام', () => {
    expect(dueRange(2026, 11)).toEqual({ min: '2026-11-01', max: '2026-12-06' })
    expect(dueRange(2026, 12)).toEqual({ min: '2026-12-01', max: '2027-01-06' })
  })

  it('الترقيم كملف الخطة والأشهر أرقاماً', () => {
    expect(goalLabel(2)).toBe('هدف ٣')
    expect(goalLabel(9)).toBe('هدف ١٠')
    expect(taskLabel(2, 1)).toBe('٣-٢')
    expect(planMonthLabel(2026, 11)).toBe('11-2026')
  })

  it('الشهر التالي ونقل الموعد', () => {
    expect(shiftPlanMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftPlanMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(carryDueDate('2026-10-31', 2026, 11)).toBe('2026-11-30')
    expect(carryDueDate('2026-11-05', 2026, 12)).toBe('2026-12-05')
    expect(daysBetween('2026-11-01', '2026-11-03')).toBe(2)
  })
})
