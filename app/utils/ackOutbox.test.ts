import { describe, expect, it } from 'vitest'
import { ackSnapshotKey, markAcknowledged, newAckEntry } from './ackOutbox'

describe('ackOutbox', () => {
  it('سطرٌ واحدٌ لكلّ إقرار', () => {
    const e = newAckEntry('u', 'visit', 'v1', new Date('2026-10-27T08:00:00Z'))
    expect(e).toMatchObject({ key: 'u|visit|v1', status: 'pending', attempts: 0, recordedAt: '2026-10-27T08:00:00.000Z' })
  })

  it('نسخةُ الشاشة لكلّ نوع', () => {
    expect(ackSnapshotKey('visit')).toBe('visits-list')
    expect(ackSnapshotKey('alert')).toBe('alerts-list')
    expect(ackSnapshotKey('quality', { year: 2026, month: 10 })).toBe('quality-records|2026-10')
  })

  it('يعلّم السطرَ وحده كما تفعل القاعدة', () => {
    const at = '2026-10-27T08:00:00Z'
    const visits = markAcknowledged([{ id: 'a', teacher_ack_at: null }, { id: 'b', teacher_ack_at: null }], 'visit', 'a', at)
    expect(visits).toEqual([{ id: 'a', teacher_ack_at: at }, { id: 'b', teacher_ack_at: null }])
    const alerts = markAcknowledged([{ id: 'x', status: 'new', acknowledged_at: null }], 'alert', 'x', at)
    expect(alerts[0]).toEqual({ id: 'x', status: 'acknowledged', acknowledged_at: at })
  })
})
