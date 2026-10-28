import { describe, expect, it } from 'vitest'
import { dmy, halaqatSheet, staffSheet, studentsSheet, type HalaqaRow, type ProfileRow, type StudentRow } from './people'

const h = (o: Partial<HalaqaRow>) => ({ id: 'h1', name: 'الصبرة', gender: 'male', status: 'active', daily_time: '16:00:00', teacher_id: 't1', supervisor_id: 's1', examiner_id: null, ...o }) as HalaqaRow
const p = (o: Partial<ProfileRow>) => ({ id: 't1', full_name: 'محمود بهار', role: 'teacher', gender: 'male', status: 'active', employee_number: '1010', phone: '0599000000', ...o }) as ProfileRow
const st = (o: Partial<StudentRow>) => ({ id: 'st1', full_name: 'أحمد', gender: 'male', status: 'active', halaqa_id: 'h1', national_id: '400000001', user_id: 'u1', ...o }) as StudentRow

describe('dmy', () => {
  it('يحوّل التاريخ والطابع الزمنيّ', () => {
    expect(dmy('2026-10-07')).toBe('7/10/2026')
    expect(dmy('2026-10-28T10:00:00Z')).toBe('28/10/2026')
    expect(dmy(null)).toBe('')
  })
})

describe('أوراق الأشخاص', () => {
  const halaqat = [h({}), h({ id: 'h2', name: 'النفق', teacher_id: 'x', supervisor_id: 's1' })]
  it('العاملون بالدور والحلقات المسندة', () => {
    const rows = staffSheet([p({}), p({ id: 's1', full_name: 'المشرف', role: 'field_supervisor' })], halaqat).rows
    expect(rows[0]).toMatchObject({ emp: '1010', role: 'معلم', gender: 'ذكر', status: 'نشط', teaches: 'الصبرة' })
    expect(rows[1]!.supervises).toBe('الصبرة، النفق')
  })
  it('الطلاب بالحلقة والمعلّم والحساب', () => {
    const rows = studentsSheet([st({}), st({ id: 'st2', user_id: null, halaqa_id: null, status: 'withdrawn' })], halaqat, new Map([['t1', 'محمود بهار']])).rows
    expect(rows[0]).toMatchObject({ halaqa: 'الصبرة', teacher: 'محمود بهار', account: 'نعم', status: 'منتظم' })
    expect(rows[1]).toMatchObject({ halaqa: '', account: 'لا', status: 'منسحب' })
  })
  it('الحلقات بالموعد وعدد الطلاب المنتظمين', () => {
    const rows = halaqatSheet([h({})], new Map([['t1', 'محمود بهار']]), [st({}), st({ id: 'st2', status: 'withdrawn' })]).rows
    expect(rows[0]).toMatchObject({ section: 'البنين', teacher: 'محمود بهار', students: 1, time: '4:00 م – 6:00 م' })
  })
})
