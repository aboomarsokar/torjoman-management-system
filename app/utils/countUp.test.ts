import { describe, expect, it } from 'vitest'
import { countUpValue, decimalsOf } from './countUp'

describe('countUpValue', () => {
  it('يبدأ من المبدأ وينتهي بالهدف تماماً', () => {
    expect(countUpValue(0, 248, 0)).toBe(0)
    expect(countUpValue(0, 248, 1)).toBe(248)
    expect(countUpValue(0, 248, 1.4)).toBe(248)
  })
  it('سريعٌ أوّلَه: نصفُ المدّة يتجاوز نصفَ المسافة', () => {
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50)
    expect(countUpValue(0, 100, 0.5)).toBeLessThan(100)
  })
  it('ينزل كما يصعد، ويحفظ المنازلَ العشرية', () => {
    expect(countUpValue(40, 10, 1)).toBe(10)
    expect(countUpValue(0, 7.5, 1, 1)).toBe(7.5)
    expect(Number.isInteger(countUpValue(0, 7.5, 0.3, 1) * 10)).toBe(true)
  })
})

describe('decimalsOf', () => {
  it('صحيحٌ بلا منازل، والكسرُ بمنازله حتى اثنتين', () => {
    expect(decimalsOf(36)).toBe(0)
    expect(decimalsOf(7.5)).toBe(1)
    expect(decimalsOf(2 / 3)).toBe(2)
  })
})
