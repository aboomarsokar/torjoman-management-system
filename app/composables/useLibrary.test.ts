/**
 * منطقُ المكتبة الصرف (الامتدادُ والأخطاءُ والتجميع) مختبَرٌ في `utils/library.test.ts`؛ وهذا يحرس أنّ الملازمَ الخمسَ
 * عشرة كلَّها تُعرض بأسمائها في المكتبة.
 */
import { describe, expect, it } from 'vitest'
import { BOOKLETS } from '~/constants/booklets'

describe('ملازمُ المكتبة', () => {
  it('خمسَ عشرةَ ملزمةً من الجزء 29 + 30 إلى الجزء 1 + 2', () => {
    expect(BOOKLETS).toHaveLength(15)
    expect(BOOKLETS[0]!.label).toBe('الجزء 29 + 30')
    expect(BOOKLETS[14]!.label).toBe('الجزء 1 + 2')
  })
})
