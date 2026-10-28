/**
 * أوراقُ الملازم والرسائل للتصدير (طلب المستخدم 2026-10-28 — الدفعة الثانية): تسليماتُ الملازم وطلباتُها والمخزونُ
 * وحركاتُه، وسجلُّ SMS ورسائلُ الكادر وطلباتُ إضافة الطلاب. منطقٌ صرفٌ مختبَر؛ الجلبُ في useDataExport.
 */
import type { Database } from '~/types/database.types'
import {
  BOOKLET_REQUEST_STATUS_LABELS, SECTION_LABELS, STOCK_REASON_LABELS, STUDENT_REQUEST_KIND_LABELS, STUDENT_REQUEST_STATUS_LABELS
} from '~/constants/dataExport'
import { BOOKLETS } from '~/constants/booklets'
import { STAFF_ROLE_LABELS } from '~/constants/announcements'
import { dmy } from './people'
import type { Ctx } from './admin'
import type { SheetSpec } from './workbook'

type Tables = Database['public']['Tables']
export type DeliveryRow = Tables['booklet_deliveries']['Row']
export type BookletRequestRow = Tables['booklet_requests']['Row']
export type StockRow = Tables['booklet_stock']['Row']
export type StockMoveRow = Tables['booklet_stock_moves']['Row']
export type SmsLogRow = Tables['sms_log']['Row']
export type StaffMessageRow = Tables['staff_messages']['Row']
export type StudentRequestRow = Tables['student_requests']['Row']

const label = (no: number) => BOOKLETS.find(b => b.no === no)?.label ?? String(no)
const nameOf = (c: Ctx, id: string | null | undefined) => (id ? c.names.get(id) ?? '' : '')
const halaqaOf = (c: Ctx, id: string | null | undefined) => (id ? c.halaqat.get(id)?.name ?? '' : '')
const newestFirst = <T>(rows: T[], key: (r: T) => string) => [...rows].sort((a, b) => key(b).localeCompare(key(a)))

export function deliveriesSheet(rows: DeliveryRow[], c: Ctx): SheetSpec {
  return {
    name: 'تسليمات الملازم',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'المعلّم', key: 'teacher', width: 24 },
      { header: 'الملزمة', key: 'booklet', width: 14 }, { header: 'النسخ', key: 'copies', width: 7 }, { header: 'ملاحظة', key: 'note', width: 26 }
    ],
    rows: newestFirst(rows, r => r.delivered_on).map(d => ({
      date: dmy(d.delivered_on), halaqa: halaqaOf(c, d.halaqa_id), teacher: nameOf(c, c.halaqat.get(d.halaqa_id)?.teacher_id),
      booklet: label(d.booklet), copies: d.copies, note: d.note
    }))
  }
}

export function bookletRequestsSheet(rows: BookletRequestRow[], c: Ctx): SheetSpec {
  return {
    name: 'طلبات الملازم',
    columns: [
      { header: 'تاريخ الطلب', key: 'date', width: 11 }, { header: 'الحلقة', key: 'halaqa', width: 22 }, { header: 'المعلّم', key: 'by', width: 24 },
      { header: 'الملزمة', key: 'booklet', width: 14 }, { header: 'النسخ', key: 'copies', width: 7 }, { header: 'الحالة', key: 'status', width: 13 },
      { header: 'تاريخ الإغلاق', key: 'closed', width: 11 }, { header: 'ملاحظة', key: 'note', width: 26 }
    ],
    rows: newestFirst(rows, r => r.created_at).map(r => ({
      date: dmy(r.created_at), halaqa: halaqaOf(c, r.halaqa_id), by: nameOf(c, r.requested_by), booklet: label(r.booklet), copies: r.copies,
      status: BOOKLET_REQUEST_STATUS_LABELS[r.status] ?? r.status, closed: dmy(r.closed_at), note: r.note
    }))
  }
}

export function stockSheet(stock: StockRow[]): SheetSpec {
  const by = new Map(stock.map(s => [s.booklet, s]))
  return {
    name: 'مخزون الملازم',
    columns: [
      { header: 'الملزمة', key: 'booklet', width: 14 }, { header: 'الرصيد', key: 'qty', width: 9 }, { header: 'حدّ التنبيه', key: 'alert', width: 10 },
      { header: 'الحالة', key: 'state', width: 13 }
    ],
    rows: BOOKLETS.map((b) => {
      const s = by.get(b.no)
      const state = !s ? 'لم يُجرد' : s.quantity <= 0 ? 'نفد' : s.quantity <= s.alert_at ? 'قارب النفاد' : 'كافٍ'
      return { booklet: b.label, qty: s?.quantity ?? null, alert: s?.alert_at ?? null, state }
    })
  }
}

export function stockMovesSheet(rows: StockMoveRow[], c: Ctx): SheetSpec {
  return {
    name: 'حركات المخزون',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'الملزمة', key: 'booklet', width: 14 }, { header: 'النوع', key: 'reason', width: 8 },
      { header: 'التغيّر', key: 'delta', width: 8 }, { header: 'الرصيد بعدها', key: 'balance', width: 10 }, { header: 'الحلقة', key: 'halaqa', width: 22 },
      { header: 'ملاحظة', key: 'note', width: 28 }
    ],
    rows: newestFirst(rows, r => `${r.moved_on}${r.created_at}`).map(m => ({
      date: dmy(m.moved_on), booklet: label(m.booklet), reason: STOCK_REASON_LABELS[m.reason] ?? m.reason, delta: m.delta,
      balance: m.balance_after, halaqa: halaqaOf(c, m.halaqa_id), note: m.note
    }))
  }
}

export function smsSheet(rows: SmsLogRow[], c: Ctx): SheetSpec {
  return {
    name: 'سجل SMS',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'المرسِل', key: 'by', width: 22 }, { header: 'المستلمون', key: 'count', width: 9 },
      { header: 'المقاطع', key: 'segments', width: 8 }, { header: 'النتيجة', key: 'result', width: 26 }, { header: 'النصّ', key: 'body', width: 50 }
    ],
    rows: newestFirst(rows, r => r.created_at).map(s => ({
      date: dmy(s.created_at), by: nameOf(c, s.sent_by), count: s.recipients_count, segments: s.segments, result: s.result, body: s.body
    }))
  }
}

export function staffMessagesSheet(rows: StaffMessageRow[], c: Ctx): SheetSpec {
  const audience = (m: StaffMessageRow) => m.target_id
    ? nameOf(c, m.target_id)
    : `${(m.roles ?? []).map(r => STAFF_ROLE_LABELS[r as keyof typeof STAFF_ROLE_LABELS]?.m ?? r).join('، ')} · ${SECTION_LABELS[m.section ?? 'all'] ?? ''}`
  return {
    name: 'رسائل الكادر',
    columns: [
      { header: 'التاريخ', key: 'date', width: 11 }, { header: 'المرسِل', key: 'by', width: 22 }, { header: 'إلى', key: 'to', width: 28 },
      { header: 'المستلمون', key: 'count', width: 9 }, { header: 'العنوان', key: 'title', width: 30 }, { header: 'التفاصيل', key: 'body', width: 50 }
    ],
    rows: newestFirst(rows, r => r.created_at).map(m => ({
      date: dmy(m.created_at), by: nameOf(c, m.sent_by), to: audience(m), count: m.recipients, title: m.title, body: m.body
    }))
  }
}

export function studentRequestsSheet(rows: StudentRequestRow[], c: Ctx): SheetSpec {
  return {
    name: 'طلبات الطلاب',
    columns: [
      { header: 'تاريخ الطلب', key: 'date', width: 11 }, { header: 'النوع', key: 'kind', width: 8 }, { header: 'الحلقة', key: 'halaqa', width: 22 },
      { header: 'المعلّم', key: 'by', width: 24 }, { header: 'الطالب', key: 'name', width: 26 }, { header: 'رقم الهوية', key: 'nid', width: 12 }, { header: 'الحالة', key: 'status', width: 9 },
      { header: 'ملاحظة المعلّم / سبب الحذف', key: 'note', width: 26 }, { header: 'سبب الرفض', key: 'reason', width: 22 }, { header: 'تاريخ الإغلاق', key: 'closed', width: 11 }
    ],
    rows: newestFirst(rows, r => r.created_at).map(r => ({
      date: dmy(r.created_at), kind: STUDENT_REQUEST_KIND_LABELS[r.kind] ?? r.kind, halaqa: halaqaOf(c, r.halaqa_id), by: nameOf(c, r.requested_by), name: r.full_name, nid: r.national_id,
      status: STUDENT_REQUEST_STATUS_LABELS[r.status] ?? r.status, note: r.note, reason: r.reject_note, closed: dmy(r.closed_at)
    }))
  }
}
