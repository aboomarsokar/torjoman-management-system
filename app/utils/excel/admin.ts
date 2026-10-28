/**
 * أوراقُ الإشراف والمالية للتصدير (طلب المستخدم 2026-10-28 — الدفعة الثانية): الزياراتُ الإشرافية والتنبيهاتُ الإدارية،
 * وحوافزُ الحلقات وكشوفُها وبنودُها والمواصلاتُ والحساباتُ المالية. منطقٌ صرفٌ مختبَر؛ الجلبُ في useDataExport.
 */
import type { Database } from '~/types/database.types'
import {
  ACCOUNT_TYPE_LABELS, ALERT_SEVERITY_LABELS, ALERT_STATUS_LABELS, STATEMENT_STATUS_LABELS, VISIT_STATUS_LABELS
} from '~/constants/dataExport'
import { roleLabel } from '~/constants/roles'
import { periodLabel } from '~/utils/reportWindow'
import { dmy, type HalaqaRow, type ProfileRow } from './people'
import type { SheetSpec } from './workbook'

type Tables = Database['public']['Tables']
export type VisitRow = Tables['supervision_visits']['Row']
export type AlertRow = Tables['admin_alerts']['Row']
export type IncentiveRow = Tables['halaqa_incentives']['Row']
export type StatementRow = Tables['incentive_statements']['Row']
export type StatementItemRow = Tables['incentive_statement_items']['Row']
export type TripRow = Tables['transport_trips']['Row']
export type FinancialRow = Tables['profile_financials']['Row']

/** سياقُ الأسماء: الحلقاتُ بمعرّفها وأسماءُ العاملين. */
export interface Ctx { halaqat: Map<string, HalaqaRow>, names: Map<string, string> }
const nameOf = (c: Ctx, id: string | null | undefined) => (id ? c.names.get(id) ?? '' : '')
const halaqaOf = (c: Ctx, id: string | null | undefined) => (id ? c.halaqat.get(id)?.name ?? '' : '')
const teacherOf = (c: Ctx, halaqaId: string | null | undefined) => nameOf(c, halaqaId ? c.halaqat.get(halaqaId)?.teacher_id : null)
const yesNo = (v: unknown) => (v ? 'نعم' : 'لا')

export function visitsSheet(rows: VisitRow[], c: Ctx): SheetSpec {
  return {
    name: 'الزيارات الإشرافية',
    columns: [
      { header: 'الموعد', key: 'at', width: 11 }, { header: 'التنفيذ', key: 'done', width: 11 }, { header: 'الحالة', key: 'status', width: 9 },
      { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'المعلّم', key: 'teacher', width: 24 }, { header: 'الزائر', key: 'visitor', width: 24 },
      { header: 'الدرجة', key: 'score', width: 8 }, { header: 'سير الحلقة', key: 'flow', width: 12 }, { header: 'نقاط القوة', key: 'strengths', width: 26 },
      { header: 'التحسين', key: 'improve', width: 26 }, { header: 'التوصيات', key: 'recs', width: 26 }, { header: 'ملاحظات', key: 'notes', width: 22 },
      { header: 'اطّلع المعلّم', key: 'ack', width: 10 }
    ],
    rows: [...rows].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)).map(v => ({
      at: dmy(v.scheduled_at), done: dmy(v.executed_at), status: VISIT_STATUS_LABELS[v.status] ?? v.status,
      halaqa: halaqaOf(c, v.halaqa_id), teacher: teacherOf(c, v.halaqa_id), visitor: nameOf(c, v.supervisor_id), score: v.score,
      flow: v.flow_rating, strengths: v.strengths, improve: v.improvements, recs: v.recommendations, notes: v.notes, ack: yesNo(v.teacher_ack_at)
    }))
  }
}

export function alertsSheet(rows: AlertRow[], c: Ctx): SheetSpec {
  return {
    name: 'التنبيهات الإدارية',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'المعلّم', key: 'teacher', width: 24 }, { header: 'المُصدِر', key: 'issuer', width: 22 },
      { header: 'الدرجة', key: 'severity', width: 11 }, { header: 'المخالفة', key: 'violation', width: 22 }, { header: 'الوصف', key: 'desc', width: 34 },
      { header: 'الحالة', key: 'status', width: 11 }
    ],
    rows: [...rows].sort((a, b) => b.alert_date.localeCompare(a.alert_date)).map(a => ({
      date: dmy(a.alert_date), teacher: nameOf(c, a.teacher_id), issuer: nameOf(c, a.issuer_id), severity: ALERT_SEVERITY_LABELS[a.severity] ?? a.severity,
      violation: a.violation_type, desc: a.description, status: ALERT_STATUS_LABELS[a.status] ?? a.status
    }))
  }
}

/** الحوافزُ لكلّ حلقةٍ وشهر: المخصَّص والمستلَم والمصروف (مجموعُ البنود) والمتبقّي وحالةُ الكشف. */
export function incentivesSheet(allocs: IncentiveRow[], statements: StatementRow[], items: StatementItemRow[], c: Ctx): SheetSpec {
  const key = (h: string, y: number, m: number) => `${h}|${y}|${m}`
  const spent = new Map<string, number>()
  for (const it of items) spent.set(it.statement_id, (spent.get(it.statement_id) ?? 0) + Number(it.amount))
  const stmt = new Map(statements.map(s => [key(s.halaqa_id, s.statement_year, s.statement_month), s]))
  const keys = new Map<string, { h: string, y: number, m: number }>()
  for (const a of allocs) keys.set(key(a.halaqa_id, a.incentive_year, a.incentive_month), { h: a.halaqa_id, y: a.incentive_year, m: a.incentive_month })
  for (const s of statements) keys.set(key(s.halaqa_id, s.statement_year, s.statement_month), { h: s.halaqa_id, y: s.statement_year, m: s.statement_month })
  const alloc = new Map(allocs.map(a => [key(a.halaqa_id, a.incentive_year, a.incentive_month), a]))
  const rows = [...keys.entries()].map(([k, v]) => {
    const s = stmt.get(k)
    const used = s ? spent.get(s.id) ?? 0 : 0
    const received = s?.received_amount != null ? Number(s.received_amount) : null
    return {
      period: periodLabel(v.y, v.m), sortKey: v.y * 100 + v.m, halaqa: halaqaOf(c, v.h), teacher: teacherOf(c, v.h),
      allocated: alloc.get(k) ? Number(alloc.get(k)!.allocated_amount) : null, received, spent: used,
      left: received != null ? received - used : null, status: s ? STATEMENT_STATUS_LABELS[s.status] ?? s.status : 'لم يُكتب'
    }
  }).sort((a, b) => b.sortKey - a.sortKey || a.halaqa.localeCompare(b.halaqa, 'ar')).map(({ sortKey: _s, ...r }) => r)
  return {
    name: 'حوافز الحلقات',
    columns: [
      { header: 'الشهر', key: 'period', width: 9 }, { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'المعلّم', key: 'teacher', width: 24 },
      { header: 'المخصَّص', key: 'allocated', width: 10 }, { header: 'المستلَم', key: 'received', width: 10 }, { header: 'المصروف', key: 'spent', width: 10 },
      { header: 'المتبقّي', key: 'left', width: 10 }, { header: 'حالة الكشف', key: 'status', width: 11 }
    ],
    rows
  }
}

export function statementItemsSheet(statements: StatementRow[], items: StatementItemRow[], c: Ctx): SheetSpec {
  const byId = new Map(statements.map(s => [s.id, s]))
  return {
    name: 'بنود كشوف الحوافز',
    columns: [
      { header: 'الشهر', key: 'period', width: 9 }, { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'التاريخ', key: 'date', width: 11 },
      { header: 'الفئة', key: 'category', width: 10 }, { header: 'البيان', key: 'desc', width: 34 }, { header: 'المبلغ', key: 'amount', width: 10 }
    ],
    rows: items.map((it) => {
      const s = byId.get(it.statement_id)
      return {
        period: s ? periodLabel(s.statement_year, s.statement_month) : '', halaqa: halaqaOf(c, s?.halaqa_id), date: dmy(it.item_date),
        category: it.category, desc: it.description, amount: Number(it.amount)
      }
    }).sort((a, b) => b.period.localeCompare(a.period) || a.halaqa.localeCompare(b.halaqa, 'ar'))
  }
}

export function transportSheet(rows: TripRow[], staff: ProfileRow[], c: Ctx): SheetSpec {
  const byId = new Map(staff.map(p => [p.id, p]))
  return {
    name: 'كشف المواصلات',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'الاسم', key: 'name', width: 24 }, { header: 'الدور', key: 'role', width: 14 },
      { header: 'البيان', key: 'desc', width: 30 }, { header: 'المبلغ', key: 'amount', width: 9 }, { header: 'سُدِّد', key: 'paid', width: 8 },
      { header: 'تاريخ التسديد', key: 'paidAt', width: 12 }, { header: 'ملاحظات', key: 'notes', width: 22 }
    ],
    rows: [...rows].sort((a, b) => b.trip_date.localeCompare(a.trip_date)).map((t) => {
      const p = byId.get(t.profile_id)
      return {
        date: dmy(t.trip_date), name: nameOf(c, t.profile_id), role: p ? roleLabel(p.role, p.gender) : '', desc: t.description,
        amount: Number(t.amount), paid: yesNo(t.paid), paidAt: dmy(t.paid_at), notes: t.notes
      }
    })
  }
}

export function financialsSheet(rows: FinancialRow[], staff: ProfileRow[]): SheetSpec {
  const byId = new Map(staff.map(p => [p.id, p]))
  return {
    name: 'الحسابات المالية',
    columns: [
      { header: 'الرقم الوظيفي', key: 'emp', width: 12 }, { header: 'الاسم', key: 'name', width: 26 }, { header: 'الدور', key: 'role', width: 14 },
      { header: 'نوع الحساب', key: 'type', width: 12 }, { header: 'صاحب الحساب', key: 'holder', width: 24 }, { header: 'رقم الحساب', key: 'number', width: 18 }
    ],
    rows: rows.map((f) => {
      const p = byId.get(f.profile_id)
      return {
        emp: p?.employee_number, name: p?.full_name ?? '', role: p ? roleLabel(p.role, p.gender) : '',
        type: f.account_type ? ACCOUNT_TYPE_LABELS[f.account_type] ?? f.account_type : '', holder: f.account_holder, number: f.account_number
      }
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }
}
