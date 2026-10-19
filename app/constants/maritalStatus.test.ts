/**
 * الحالة الاجتماعية — العرض بجنس صاحب الملف، وحفظ القيمة القديمة المكتوبة يدوياً.
 */
import { describe, expect, it } from 'vitest'
import { maritalItems, maritalLabel } from './maritalStatus'

describe('maritalLabel', () => {
  it('يؤنّث للأنثى ويُبقي المذكّر للذكر', () => {
    expect(maritalLabel('أعزب', 'female')).toBe('عزباء')
    expect(maritalLabel('متزوج', 'male')).toBe('متزوج')
  })
  it('القيمة القديمة تُعرض كما هي، والفارغة فارغة', () => {
    expect(maritalLabel('خاطب', 'female')).toBe('خاطب')
    expect(maritalLabel(null, 'male')).toBe('')
  })
})

describe('maritalItems', () => {
  it('أربعة خيارات بقيمٍ مذكّرة وعناوين بالجنس', () => {
    expect(maritalItems('female')).toEqual([
      { label: 'متزوجة', value: 'متزوج' }, { label: 'عزباء', value: 'أعزب' },
      { label: 'أرملة', value: 'أرمل' }, { label: 'مطلقة', value: 'مطلق' }
    ])
  })
  it('تبقى القيمة القديمة غير المعروفة خياراً', () => {
    expect(maritalItems('male', 'خاطب').map(i => i.value)).toContain('خاطب')
    expect(maritalItems('male', 'متزوج')).toHaveLength(4)
  })
})
