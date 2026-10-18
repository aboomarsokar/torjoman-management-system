import { describe, expect, it } from 'vitest'
import { ageFrom, buildStudentSections, dash, type StudentRecord } from './studentSections'

const base = {
  full_name: 'أحمد بن علي', gender: 'male', birth_date: null, national_id: '123456789', family_count: null,
  quran_parts: 5, tajweed_level: null, residence: null, nearest_mosque: null,
  guardian_name: null, guardian_phone: '0599', phone: null, guardian_email: null, enrollment_date: '2026-08-01'
} as unknown as StudentRecord

describe('dash', () => {
  it('الفارغ شرطة والقيمة كما هي', () => {
    expect(dash(null)).toBe('—')
    expect(dash('')).toBe('—')
    expect(dash(0)).toBe('0')
    expect(dash('س')).toBe('س')
  })
})

describe('ageFrom', () => {
  it('بلا تاريخ شرطة', () => expect(ageFrom(null)).toBe('—'))
  it('يحسب السنوات من لحظةٍ معلومة', () => {
    expect(ageFrom('2016-01-01', new Date('2026-10-18').getTime())).toBe('10 سنة')
  })
  it('أقلّ من سنة شرطة', () => {
    expect(ageFrom('2026-06-01', new Date('2026-10-18').getTime())).toBe('—')
  })
})

describe('buildStudentSections', () => {
  const sections = buildStudentSections(base)
  it('أربعة أقسام بالترتيب', () => {
    expect(sections.map(s => s.title)).toEqual(['البيانات الأساسية', 'بيانات قرآنية', 'السكن', 'وليّ الأمر والتواصل'])
  })
  it('الجنس بالعربية والأجزاء بوحدتها', () => {
    expect(sections[0]!.fields.find(f => f.label === 'الجنس')!.value).toBe('ذكر')
    expect(sections[1]!.fields[0]!.value).toBe('5 جزء')
  })
  it('الأرقام تُعرض LTR', () => {
    expect(sections[3]!.fields.find(f => f.label === 'جوال وليّ الأمر')!.ltr).toBe(true)
  })
})
