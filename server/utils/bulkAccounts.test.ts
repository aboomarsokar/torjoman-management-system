/**
 * الإدخال الجماعيّ: قراءةُ الجدول بعناوين عربية، وتحويلُ الجنس والمسمّى، وكشفُ الأخطاء سطراً سطراً.
 */
import { describe, expect, it } from 'vitest'
import { genderFrom, parseTable, planStaff, planStudents, roleFrom, tableToRecords } from './bulkAccounts'

describe('parseTable', () => {
  it('يكشف الجدولة (لصقٌ من Excel) ويحذف BOM والأسطر الفارغة', () => {
    expect(parseTable('\uFEFFالاسم\tالجنس\nأحمد\tذكر\n\n')).toEqual([['الاسم', 'الجنس'], ['أحمد', 'ذكر']])
  })
  it('يحترم الاقتباس والفاصلة داخل الخلية', () => {
    expect(parseTable('الاسم,الهاتف\n"علي، الابن",0599\r\n')).toEqual([['الاسم', 'الهاتف'], ['علي، الابن', '0599']])
  })
})

describe('genderFrom / roleFrom', () => {
  it('ذكر/أنثى وبنين/بنات', () => {
    expect(genderFrom('ذكر')).toBe('male')
    expect(genderFrom('انثى')).toBe('female')
    expect(genderFrom('بنات')).toBe('female')
    expect(genderFrom('؟')).toBeNull()
  })
  it('المسمّى العربي مذكّراً ومؤنّثاً وبلا تشكيل', () => {
    expect(roleFrom('معلمة')).toBe('teacher')
    expect(roleFrom('مختبر')).toBe('examiner')
    expect(roleFrom('مشرفة ميدانية')).toBe('field_supervisor')
    expect(roleFrom('المديرة الإدارية')).toBe('women_admin')
    expect(roleFrom('طالب')).toBeNull()
  })
})

describe('planStaff', () => {
  it('السطر الصالح يُقبل، والدور المجهول والجنس الناقص بأرقام أسطرهما', () => {
    const records = tableToRecords(parseTable('الاسم,الدور,الجنس,الهاتف\nخالد,معلم,ذكر,0599\nسعاد,حارس,أنثى,\nمنى,معلمة,,'))
    const plan = planStaff(records)
    expect(plan.rows.map(r => [r.line, r.fullName, r.role, r.gender])).toEqual([[2, 'خالد', 'teacher', 'male']])
    expect(plan.errors).toEqual([{ line: 3, message: 'الدور «حارس» غير معروف.' }, { line: 4, message: 'الجنس مطلوب.' }])
  })
})

describe('planStudents', () => {
  const halaqat = [{ id: 'h1', name: 'حلقة النور', gender: 'male' as const }, { id: 'h2', name: 'حلقة الهدى', gender: 'female' as const }]
  it('الحلقة بالاسم، والهوية بالأرقام العربية', () => {
    const records = tableToRecords(parseTable('الاسم\tالجنس\tرقم الهوية\tالحلقة\nزيد\tذكر\t٤٠٧١٢٣٤٥٦\tحلقة  النور'))
    const plan = planStudents(records, halaqat, new Set())
    expect(plan.errors).toEqual([])
    expect(plan.rows[0]).toMatchObject({ fullName: 'زيد', nationalId: '407123456', halaqaId: 'h1' })
  })
  it('حلقةٌ غير موجودة، وجنسٌ يخالفها، وهويةٌ مسجّلة، وهويةٌ مكرّرة في الملفّ', () => {
    const records = tableToRecords(parseTable([
      'الاسم,الجنس,الهوية,الحلقة',
      'أ,ذكر,111111111,حلقة الفجر',
      'ب,ذكر,222222222,حلقة الهدى',
      'ج,أنثى,333333333,',
      'د,ذكر,444444444,حلقة النور',
      'هـ,ذكر,444444444,حلقة النور'
    ].join('\n')))
    const plan = planStudents(records, halaqat, new Set(['333333333']))
    expect(plan.rows.map(r => r.line)).toEqual([5])
    expect(plan.errors.map(e => e.line)).toEqual([2, 3, 4, 6])
    expect(plan.errors[3]!.message).toContain('السطر 5')
  })
})
