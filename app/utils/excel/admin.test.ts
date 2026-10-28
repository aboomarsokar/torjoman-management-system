import { describe, expect, it } from 'vitest'
import { alertsSheet, financialsSheet, incentivesSheet, statementItemsSheet, transportSheet, visitsSheet, type Ctx } from './admin'
import type { HalaqaRow, ProfileRow } from './people'

const c: Ctx = { halaqat: new Map([['h1', { id: 'h1', name: 'الصبرة', teacher_id: 't1' } as HalaqaRow]]), names: new Map([['t1', 'محمود'], ['s1', 'المشرف']]) }
const staff = [{ id: 't1', full_name: 'محمود', role: 'teacher', gender: 'male', employee_number: '1010' }, { id: 's1', full_name: 'المشرف', role: 'field_supervisor', gender: 'male' }] as ProfileRow[]

describe('الإشراف', () => {
  it('الزيارةُ بالحلقة والمعلّم والزائر والحالة', () => {
    const r = visitsSheet([{ halaqa_id: 'h1', supervisor_id: 's1', scheduled_at: '2026-10-20T10:00:00Z', executed_at: '2026-10-20T10:30:00Z', status: 'done', score: 88, teacher_ack_at: null } as never], c).rows[0]
    expect(r).toMatchObject({ at: '20/10/2026', halaqa: 'الصبرة', teacher: 'محمود', visitor: 'المشرف', status: 'منفّذة', score: 88, ack: 'لا' })
  })
  it('التنبيهُ بدرجته وحالته', () => {
    const r = alertsSheet([{ teacher_id: 't1', issuer_id: 's1', alert_date: '2026-10-10', severity: 'first_warning', status: 'acknowledged', violation_type: 'تأخّر', description: 'x' } as never], c).rows[0]
    expect(r).toMatchObject({ teacher: 'محمود', severity: 'إنذار أول', status: 'اطّلع عليه' })
  })
})

describe('المالية', () => {
  const statements = [{ id: 'st', halaqa_id: 'h1', statement_year: 2026, statement_month: 10, received_amount: 150, status: 'submitted' }] as never[]
  const items = [{ statement_id: 'st', amount: 40, category: 'جوائز', description: 'هدايا', item_date: '2026-10-05' }, { statement_id: 'st', amount: 10, category: 'ضيافة', description: 'ماء', item_date: '2026-10-06' }] as never[]
  it('الحوافزُ: المخصَّص والمستلَم والمصروف والمتبقّي', () => {
    const rows = incentivesSheet([{ halaqa_id: 'h1', incentive_year: 2026, incentive_month: 10, allocated_amount: 150 }, { halaqa_id: 'h1', incentive_year: 2026, incentive_month: 11, allocated_amount: 150 }] as never[], statements, items, c).rows
    expect(rows[0]).toMatchObject({ period: '11-2026', allocated: 150, received: null, status: 'لم يُكتب' })
    expect(rows[1]).toMatchObject({ period: '10-2026', halaqa: 'الصبرة', teacher: 'محمود', allocated: 150, received: 150, spent: 50, left: 100, status: 'مُرسَل' })
  })
  it('البنودُ والمواصلاتُ والحسابات', () => {
    expect(statementItemsSheet(statements, items, c).rows[0]).toMatchObject({ period: '10-2026', category: 'جوائز', amount: 40 })
    expect(transportSheet([{ profile_id: 's1', trip_date: '2026-10-08', amount: 10, paid: true, paid_at: '2026-10-09T00:00:00Z', description: 'زيارة' }] as never[], staff, c).rows[0])
      .toMatchObject({ name: 'المشرف', role: 'مشرف ميداني', paid: 'نعم', paidAt: '9/10/2026' })
    expect(financialsSheet([{ profile_id: 't1', account_type: 'jawwalpay', account_holder: 'محمود', account_number: '123' }] as never[], staff).rows[0])
      .toMatchObject({ emp: '1010', type: 'جوال باي', number: '123' })
  })
})
