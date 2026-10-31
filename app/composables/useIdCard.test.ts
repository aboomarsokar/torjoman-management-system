/** فحصُ ملفّ الهوية وامتدادُه مختبَران في `utils/library.test.ts`، والتصغيرُ في `utils/imageFit.test.ts`. */
import { describe, expect, it } from 'vitest'
import { ID_CARD_MAX_BYTES, ID_CARD_MAX_SIDE } from '~/constants/library'

describe('حدودُ صورة الهوية', () => {
  it('تطابق قيدَ المستودع (5 م.ب) وتكفي للقراءة', () => {
    expect(ID_CARD_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(ID_CARD_MAX_SIDE).toBeGreaterThanOrEqual(1200)
  })
})
