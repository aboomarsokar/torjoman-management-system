import { describe, expect, it } from 'vitest'
import { juzCountText, studentStatusLabel } from './statusMeta'

describe('juzCountText', () => {
  it('تمييزُ العدد', () => {
    expect([null, 0, 1, 2, 3, 10, 11, 30].map(juzCountText))
      .toEqual(['—', 'لا أجزاء', 'جزءٌ واحد', 'جزآن', '3 أجزاء', '10 أجزاء', '11 جزءاً', '30 جزءاً'])
  })
})

describe('studentStatusLabel', () => {
  it('بالمؤنّث للطالبة، وبالمذكّر لغيرها', () => {
    expect(studentStatusLabel('active', 'female')).toBe('نشطة')
    expect(studentStatusLabel('withdrawn', 'female')).toBe('منقطعة')
    expect(studentStatusLabel('active', 'male')).toBe('نشط')
    expect(studentStatusLabel('graduated', null)).toBe('متخرّج')
  })
})
