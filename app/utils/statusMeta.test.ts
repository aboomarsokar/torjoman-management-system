import { describe, expect, it } from 'vitest'
import { juzCountText, studentsCountText, studentStatusLabel } from './statusMeta'

describe('juzCountText', () => {
  it('تمييزُ العدد', () => {
    expect([null, 0, 1, 2, 3, 10, 11, 30].map(juzCountText))
      .toEqual(['—', 'لا أجزاء', 'جزءٌ واحد', 'جزآن', '3 أجزاء', '10 أجزاء', '11 جزءاً', '30 جزءاً'])
  })
})

describe('studentsCountText', () => {
  it('تمييزُ العدد بجنس الحلقة', () => {
    expect([0, 1, 2, 6, 12].map(n => studentsCountText(n, true))).toEqual(['لا طالبات', 'طالبةٌ واحدة', 'طالبتان', '6 طالبات', '12 طالبة'])
    expect([1, 6, 12].map(n => studentsCountText(n, false))).toEqual(['طالبٌ واحد', '6 طلاب', '12 طالباً'])
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
