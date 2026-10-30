import { describe, expect, it } from 'vitest'
import { withoutKey } from './withoutKey'

describe('withoutKey', () => {
  it('يحذف المفتاحَ من النسخة ويترك الأصلَ كما هو', () => {
    const src = { a: 1, b: 2 }
    expect(withoutKey(src, 'a')).toEqual({ b: 2 })
    expect(src).toEqual({ a: 1, b: 2 })
  })
  it('مفتاحٌ غائب أو سجلٌّ غائب: لا خطأ', () => {
    expect(withoutKey({ a: 1 }, 'z')).toEqual({ a: 1 })
    expect(withoutKey(undefined, 'a')).toEqual({})
  })
})
