import { describe, expect, it } from 'vitest'
import { classifySyncError } from './attendanceOutbox'
import type { VisitRow } from '~/types/visits'
import { applyPendingVisits, newVisitEntry, settledVisits, uploadVisitResult, VISIT_NOT_SAVED } from './visitOutbox'
import { groupCriteria, visitTotals, type DeductionItem } from './visitForm'

const item = (key: string, criterion: number, per_time: number, sort_order: number): DeductionItem => ({
  key, criterion, criterion_label: `معيار ${criterion}`, criterion_hint: null, label: key, per_time, sort_order
})
const items = [item('a', 1, 1, 1), item('b', 1, 2, 2)]

const row = (id: string, extra: Partial<VisitRow> = {}) => ({
  id, executed_at: null, locked_at: null, score: null, deductions: null, notes: null, status: 'scheduled', ...extra
}) as unknown as VisitRow

/** عميلٌ محاكًى يلتقط جسمَ `update` ومعرّفَ الصفّ، ويردّ بالصفوف المعطاة. */
function fakeClient(rows: unknown[]) {
  const seen: { body?: unknown, id?: unknown, columns?: string } = {}
  const chain = {
    update(body: unknown) {
      seen.body = body
      return chain
    },
    eq(_col: string, id: unknown) {
      seen.id = id
      return chain
    },
    select(columns: string) {
      seen.columns = columns
      return Promise.resolve({ data: rows, error: null })
    }
  }
  return { client: { from: () => chain } as never, seen }
}

describe('visitOutbox', () => {
  it('newVisitEntry يثبّت يومَ التنفيذ ووقتَ الحفظ', () => {
    const e = newVisitEntry('u', 'v', { executedAt: '2026-10-28T09:00:00+03:00', deductions: { a: 1 }, notes: null }, new Date('2026-10-28T20:59:00Z'))
    expect(e.key).toBe('u|v')
    expect(e.executedAt).toBe('2026-10-28T09:00:00+03:00')
    expect(e.recordedAt).toBe('2026-10-28T20:59:00.000Z')
    expect(e).toMatchObject({ uid: 'u', visitId: 'v', status: 'pending', attempts: 0, deductions: { a: 1 }, notes: null })
  })

  it('uploadVisitResult يرسل يومَ التنفيذ من السطر لا من الساعة', async () => {
    const saved = row('v', { score: 40 })
    const { client, seen } = fakeClient([saved])
    const e = newVisitEntry('u', 'v', { executedAt: '2026-10-28T09:00:00+03:00', deductions: { a: 1 }, notes: 'ملاحظة' }, new Date('2026-10-28T20:59:00Z'))
    const r = await uploadVisitResult(client, e)
    expect(seen.body).toEqual({ executed_at: e.executedAt, deductions: { a: 1 }, notes: 'ملاحظة' })
    expect(seen.id).toBe('v')
    expect(r).toEqual({ data: saved, error: null })
  })

  it('uploadVisitResult بلا صفوفٍ رفضٌ دائم', async () => {
    const { client } = fakeClient([])
    const r = await uploadVisitResult(client, newVisitEntry('u', 'v', { executedAt: '2026-10-28T09:00:00+03:00', deductions: {}, notes: null }))
    expect(r.error?.code).toBe('42501')
    expect(r.error?.message).toBe(VISIT_NOT_SAVED)
    expect(classifySyncError(r.error)).toBe('reject')
  })

  it('settledVisits يرقّع الصفَّ المطابق وحده', () => {
    const rows = [row('v1'), row('v2')]
    const out = settledVisits(rows, 'v2', { score: 30, locked_at: '2026-10-28T20:59:00Z' })
    expect(out[0]).toBe(rows[0])
    expect(out[1]).toMatchObject({ id: 'v2', score: 30, locked_at: '2026-10-28T20:59:00Z' })
  })

  it('applyPendingVisits تعرض الزيارةَ المحفوظة على الجهاز مقفلةً بمجموعها', () => {
    const rows = [row('v1'), row('v2')]
    const e = newVisitEntry('u', 'v2', { executedAt: '2026-10-28T09:00:00+03:00', deductions: { a: 1, b: 1 }, notes: 'ن' }, new Date('2026-10-28T20:59:00Z'))
    const out = applyPendingVisits(rows, [e], items)
    expect(out[0]).toBe(rows[0])
    expect(out[1]).toMatchObject({
      id: 'v2', executed_at: e.executedAt, deductions: { a: 1, b: 1 }, notes: 'ن', locked_at: e.recordedAt,
      score: visitTotals(groupCriteria(items), { a: 1, b: 1 }).score
    })
    expect(out[1]!.score).toBe(4)
  })

  it('applyPendingVisits بلا بنودٍ على الجهاز: المجموعُ فارغٌ لا رقمٌ من معاييرَ غائبة', () => {
    const e = newVisitEntry('u', 'v1', { executedAt: '2026-10-28T09:00:00+03:00', deductions: { a: 1 }, notes: 'ن' }, new Date('2026-10-28T20:59:00Z'))
    const out = applyPendingVisits([row('v1')], [e], [])
    expect(out[0]).toMatchObject({ score: null, deductions: { a: 1 }, notes: 'ن', locked_at: e.recordedAt })
  })

  it('applyPendingVisits بلا سطورٍ تردّ الصفوفَ كما هي', () => {
    const rows = [row('v1')]
    expect(applyPendingVisits(rows, [], items)).toEqual(rows)
  })
})
