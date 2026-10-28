import { describe, expect, it } from 'vitest'
import { bookletRequestsSheet, deliveriesSheet, smsSheet, staffMessagesSheet, stockMovesSheet, stockSheet, studentRequestsSheet } from './records'
import type { Ctx } from './admin'
import type { HalaqaRow } from './people'

const c: Ctx = { halaqat: new Map([['h1', { id: 'h1', name: 'الصبرة', teacher_id: 't1' } as HalaqaRow]]), names: new Map([['t1', 'محمود'], ['a', 'المدير']]) }

describe('الملازم', () => {
  it('التسليمُ والطلبُ بالملزمة والحالة', () => {
    expect(deliveriesSheet([{ halaqa_id: 'h1', booklet: 2, copies: 3, delivered_on: '2026-10-07', note: null }] as never[], c).rows[0])
      .toMatchObject({ date: '7/10/2026', halaqa: 'الصبرة', teacher: 'محمود', booklet: 'الجزء 27 + 28', copies: 3 })
    expect(bookletRequestsSheet([{ halaqa_id: 'h1', requested_by: 't1', booklet: 1, copies: 5, status: 'open', created_at: '2026-10-28T08:00:00Z', closed_at: null }] as never[], c).rows[0])
      .toMatchObject({ by: 'محمود', booklet: 'الجزء 29 + 30', status: 'بانتظار التسليم', closed: '' })
  })
  it('المخزونُ بمستواه وحركاتُه', () => {
    const rows = stockSheet([{ booklet: 1, quantity: 540, alert_at: 20 }, { booklet: 2, quantity: 5, alert_at: 20 }] as never[]).rows
    expect(rows).toHaveLength(15)
    expect(rows.slice(0, 3).map(r => r.state)).toEqual(['كافٍ', 'قارب النفاد', 'لم يُجرد'])
    expect(stockMovesSheet([{ booklet: 1, reason: 'supply', delta: 540, balance_after: 540, moved_on: '2026-10-28', created_at: 'x', halaqa_id: null, note: 'مطبعة' }] as never[], c).rows[0])
      .toMatchObject({ reason: 'توريد', delta: 540, note: 'مطبعة' })
  })
})

describe('الرسائل والطلبات', () => {
  it('SMS ورسائلُ الكادر وطلباتُ الإضافة', () => {
    expect(smsSheet([{ created_at: '2026-10-27T10:00:00Z', sent_by: 'a', recipients_count: 40, segments: 2, result: '40 من 40', body: 'نص' }] as never[], c).rows[0])
      .toMatchObject({ by: 'المدير', count: 40 })
    expect(staffMessagesSheet([{ created_at: '2026-10-27T10:00:00Z', sent_by: 'a', roles: ['teacher'], section: 'male', target_id: null, recipients: 22, title: 'ت', body: null }] as never[], c).rows[0])
      .toMatchObject({ to: 'المعلّمون · البنين', count: 22 })
    expect(studentRequestsSheet([{ created_at: '2026-10-27T10:00:00Z', halaqa_id: 'h1', requested_by: 't1', full_name: 'أحمد', national_id: '400000001', status: 'rejected', reject_note: 'مكرّر', closed_at: null }] as never[], c).rows[0])
      .toMatchObject({ halaqa: 'الصبرة', by: 'محمود', status: 'رُفض', reason: 'مكرّر' })
  })
})
