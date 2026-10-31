import { describe, expect, it } from 'vitest'
import { fitSize } from './imageFit'

describe('fitSize — تصغيرٌ بلا قصّ', () => {
  it('يصغّر الكبيرةَ بنسبتها ولا يكبّر الصغيرة', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitSize(0, 600, 1600)).toEqual({ width: 0, height: 0 })
  })
})
