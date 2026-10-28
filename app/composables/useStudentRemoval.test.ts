import { describe, expect, it } from 'vitest'
import { removalReasonError } from './useStudentRemoval'

describe('removalReasonError', () => {
  it('السببُ إلزاميّ', () => {
    expect(removalReasonError('')).toMatch(/اكتب سبب/)
    expect(removalReasonError('  م ')).toMatch(/اكتب سبب/)
  })
  it('سببٌ واضح يُقبل', () => {
    expect(removalReasonError('انتقل إلى مدرسةٍ أخرى')).toBeNull()
  })
  it('لا يتجاوز 300 حرف', () => {
    expect(removalReasonError('س'.repeat(301))).toMatch(/300/)
  })
})
