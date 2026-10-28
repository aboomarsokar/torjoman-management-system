import { describe, expect, it } from 'vitest'
import { lowStockCount, lowStockWarning, stockItems, stockLevel } from './bookletStock'

describe('stockLevel', () => {
  it('المستويات الأربعة', () => {
    expect(stockLevel(undefined)).toBe('untracked')
    expect(stockLevel({ booklet: 1, quantity: 0, alert_at: 20 })).toBe('out')
    expect(stockLevel({ booklet: 1, quantity: 20, alert_at: 20 })).toBe('low')
    expect(stockLevel({ booklet: 1, quantity: 21, alert_at: 20 })).toBe('ok')
  })
})

describe('stockItems / lowStockCount', () => {
  const rows = [{ booklet: 1, quantity: 5, alert_at: 10 }, { booklet: 2, quantity: 100, alert_at: 10 }, { booklet: 3, quantity: 0, alert_at: 10 }]
  it('الخمسَ عشرة بترتيبها وغيرُ المتتبَّع فارغ', () => {
    const items = stockItems(rows)
    expect(items).toHaveLength(15)
    expect(items[0]).toMatchObject({ no: 1, label: 'الجزء 29 + 30', quantity: 5, level: 'low' })
    expect(items[14]).toMatchObject({ no: 15, quantity: null, level: 'untracked' })
  })
  it('يعدّ النافد والقارب', () => {
    expect(lowStockCount(rows)).toBe(2)
  })
})

describe('lowStockWarning', () => {
  const rows = [{ booklet: 2, quantity: 4, alert_at: 10 }, { booklet: 3, quantity: 0, alert_at: 10 }, { booklet: 4, quantity: 50, alert_at: 10 }]
  it('تنبيهٌ بالقارب والنافد فقط', () => {
    expect(lowStockWarning(rows, 2)).toBe('قارب مخزون ملزمة الجزء 27 + 28 على النفاد: بقي 4 نسخة.')
    expect(lowStockWarning(rows, 3)).toBe('نفد مخزون ملزمة الجزء 25 + 26.')
    expect(lowStockWarning(rows, 4)).toBeNull()
    expect(lowStockWarning(rows, 9)).toBeNull()
  })
})
