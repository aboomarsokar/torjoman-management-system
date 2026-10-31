import { describe, expect, it } from 'vitest'
import { isPendingRequest, requestStock, requestStockText, reservedCopies, statusMeta } from './bookletRequests'

const stock = [{ booklet: 1, quantity: 50, alert_at: 20 }]
const reqs = [
  { id: 'a', booklet: 1, copies: 10, status: 'ready' },
  { id: 'b', booklet: 1, copies: 15, status: 'open' },
  { id: 'c', booklet: 1, copies: 5, status: 'done' },
  { id: 'd', booklet: 2, copies: 3, status: 'open' }
]

describe('طلبات الملازم — الحالات والمخزون', () => {
  it('القائمُ هو الجديدُ والمُبلَغ', () => {
    expect(isPendingRequest('open')).toBe(true)
    expect(isPendingRequest('ready')).toBe(true)
    expect(isPendingRequest('done')).toBe(false)
    expect(isPendingRequest('cancelled')).toBe(false)
    expect(statusMeta('ready').label).toBe('أُبلغ المعلّم')
    expect(statusMeta('غريب').label).toBe('جديد')
  })

  it('المحجوزُ نسخُ المُبلَغة وحدها، بلا المستثنى', () => {
    expect(reservedCopies(reqs, 1)).toBe(10)
    expect(reservedCopies(reqs, 1, 'a')).toBe(0)
    expect(reservedCopies(reqs, 2)).toBe(0)
  })

  it('يكفي أو لا يكفي بعد المحجوز لغيره', () => {
    // 50 − 10 محجوزة = 40 ≥ 15، ويبقى 25 فوق الحدّ
    expect(requestStock(reqs[1]!, stock, reqs)).toEqual({ kind: 'ok', available: 40 })
    // المُبلَغُ لا يُحسب محجوزاً على نفسه
    expect(requestStock(reqs[0]!, stock, reqs)).toEqual({ kind: 'ok', available: 50 })
    const big = { id: 'x', booklet: 1, copies: 45, status: 'open' }
    expect(requestStock(big, stock, reqs)).toEqual({ kind: 'short', available: 40 })
    const edge = { id: 'y', booklet: 1, copies: 20, status: 'open' }
    expect(requestStock(edge, stock, reqs)).toEqual({ kind: 'low', available: 40 })
    expect(requestStock(reqs[3]!, stock, reqs)).toEqual({ kind: 'untracked' })
  })

  it('نصُّ الحالة', () => {
    expect(requestStockText({ kind: 'ok', available: 40 }, 15)).toBeNull()
    expect(requestStockText({ kind: 'short', available: 4 }, 15)).toBe('المخزونُ لا يكفي: المتوفّر 4 والمطلوب 15')
    expect(requestStockText({ kind: 'low', available: 30 }, 15)).toMatch(/يبقى بعده 15/)
    expect(requestStockText({ kind: 'untracked' }, 3)).toMatch(/غيرُ مجرودة/)
  })
})
