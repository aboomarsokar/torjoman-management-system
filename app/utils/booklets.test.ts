import { describe, expect, it } from 'vitest'
import { BOOKLETS } from '~/constants/booklets'
import { bookletStats, deliveryDate, halaqaBooklets, totalsByBooklet, type DeliveryRow } from './booklets'

const row = (p: Partial<DeliveryRow>): DeliveryRow => ({ id: 'x', halaqa_id: 'h1', booklet: 1, copies: 1, delivered_on: '2026-10-01', note: null, ...p })

describe('قائمةُ الملازم', () => {
  it('خمسَ عشرةَ ملزمة من 29+30 إلى 1+2', () => {
    expect(BOOKLETS).toHaveLength(15)
    expect(BOOKLETS[0]).toMatchObject({ no: 1, from: 29, to: 30, label: 'الجزء 29 + 30' })
    expect(BOOKLETS[1]).toMatchObject({ no: 2, from: 27, to: 28 })
    expect(BOOKLETS[14]).toMatchObject({ no: 15, from: 1, to: 2 })
  })
})

describe('التجميع', () => {
  const rows = [
    row({ halaqa_id: 'h1', booklet: 1, copies: 10, delivered_on: '2026-10-01' }),
    row({ halaqa_id: 'h1', booklet: 1, copies: 2, delivered_on: '2026-10-15' }),
    row({ halaqa_id: 'h2', booklet: 1, copies: 8 }),
    row({ halaqa_id: 'h2', booklet: 2, copies: 8 })
  ]

  it('حسب الملزمة: النسخُ والحلقات، والباقي بصفر', () => {
    const t = totalsByBooklet(rows)
    expect(t).toHaveLength(15)
    expect(t[0]).toMatchObject({ no: 1, copies: 20, halaqat: 2 })
    expect(t[1]).toMatchObject({ no: 2, copies: 8, halaqat: 1 })
    expect(t[2]).toMatchObject({ copies: 0, halaqat: 0 })
  })

  it('حسب الحلقة: التسليمُ المتكرّر يُجمع، ومن لم تستلم في الآخر', () => {
    const h = halaqaBooklets(rows, [
      { id: 'h3', name: 'أ — لم تستلم', status: 'active' },
      { id: 'h1', name: 'النور', status: 'active' },
      { id: 'h2', name: 'الفرقان', status: 'active' }
    ])
    expect(h.map(x => x.id)).toEqual(['h2', 'h1', 'h3'])
    expect(h[1]).toMatchObject({ total: 12, lastOn: '2026-10-15', booklets: [{ no: 1, copies: 12 }] })
    expect(h[0]!.booklets.map(b => b.no)).toEqual([1, 2])
    expect(h[2]).toMatchObject({ total: 0, booklets: [], lastOn: null })
  })

  it('أرقامُ الرأس', () => {
    const s = bookletStats(rows, 5)
    expect(s.map(x => x.value)).toEqual([28, 4, 2, 2])
    expect(s[2]!.sub).toBe('من 5')
  })
})

it('التاريخُ بالأرقام', () => {
  expect(deliveryDate('2026-10-21')).toBe('21-10-2026')
})
