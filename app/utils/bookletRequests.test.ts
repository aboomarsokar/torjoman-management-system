import { describe, expect, it } from 'vitest'
import { fitCopies, isPendingRequest, overNeedNotes, overNeedText, requestStock, requestStockText, reservedCopies, roomError, roomLeft, roomLine, statusMeta } from './bookletRequests'

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

describe('حاجةُ الحلقة من ملزمة (2026-11-24)', () => {
  const room = { halaqa_id: 'h', booklet: 1, students: 15, received: 10, pending: 3, female: true }
  it('المتاحُ يطرح المستلَمَ والقائمَ لغيره', () => {
    expect(roomLeft(room)).toBe(2)
    expect(roomLeft(room, 3)).toBe(5)
  })
  it('سطرُ الحاجة بصيغة الحلقة', () => {
    expect(roomLine(room)).toBe('طالباتُكِ 15 · استلمت الحلقة 10 · طلباتٌ قائمة 3 — المتاح 2')
    expect(roomLine({ ...room, female: false, pending: 0, received: 16 })).toBe('طلابُك 15 · استلمت الحلقة 16 — المتاح 0')
  })
  it('يرفض ما يتجاوز المتاح، ويقبل ما دونه', () => {
    expect(roomError(room, 2)).toBeNull()
    expect(roomError(room, 3)).toBe('عددُ النسخ أكبر من حاجة الحلقة — المتاحُ 2 نسخة.')
    expect(roomError(room, 5, 3)).toBeNull()
    expect(roomError({ ...room, received: 15 }, 1)).toMatch(/^لا تحتاج حلقتُكِ .* تواصلي/)
    expect(roomError(null, 99)).toBeNull()
  })
  it('تنبيهُ المدير وأقصى ما يوافق الحاجة', () => {
    expect(overNeedText(room)).toBeNull()
    const over = { ...room, female: false, received: 13, pending: 13, students: 12 }
    expect(overNeedText(over)).toBe('يتجاوز الحاجة: الطلاب 12 · استُلم 13 · مطلوبٌ قائم 13')
    expect(fitCopies(over, 13)).toBe(0)
    expect(fitCopies({ ...room, received: 14, pending: 5, students: 17 }, 5)).toBe(3)
  })
  it('يوسَم كلُّ طلبٍ قائم في الحلقة والملزمة المتجاوزتين وحدهما', () => {
    const rooms = [{ ...room, female: false, received: 13, pending: 13, students: 12 }, { ...room, booklet: 2 }]
    const notes = overNeedNotes([
      { id: 'a', halaqa_id: 'h', booklet: 1, copies: 13, status: 'open' },
      { id: 'b', halaqa_id: 'h', booklet: 1, copies: 4, status: 'done' },
      { id: 'c', halaqa_id: 'h', booklet: 2, copies: 3, status: 'ready' },
      { id: 'd', halaqa_id: 'x', booklet: 1, copies: 3, status: 'open' }
    ], rooms)
    expect([...notes.keys()]).toEqual(['a'])
  })
})
