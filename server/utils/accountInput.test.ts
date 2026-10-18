import { describe, expect, it } from 'vitest'
import {
  authCreateError, parseResetPasswordInput, parseStaffInput, parseStudentInput, staffProfileError, studentRowError, trimmedString
} from './accountInput'

const staff = { full_name: ' أحمد ', role: 'teacher', gender: 'male', password: '12345678' }
const student = { full_name: 'سارة', gender: 'female', national_id: '٤٠١٢٣٤٥٦٧', password: '12345678' }

describe('trimmedString', () => {
  it('يقصّ النصّ ويُسقط غير النصّ', () => {
    expect(trimmedString('  أ ')).toBe('أ')
    expect(trimmedString(123)).toBe('')
    expect(trimmedString({})).toBe('')
    expect(trimmedString(undefined)).toBe('')
  })
})

describe('parseStaffInput', () => {
  it('يقبل المدخل الصحيح ويقصّ الاسم', () => {
    const r = parseStaffInput({ ...staff, phone: ' 0599 ' })
    expect(r).toMatchObject({ ok: true, value: { fullName: 'أحمد', role: 'teacher', gender: 'male', phone: '0599' } })
  })
  it('يرفض كل الأدوار خارج الموظفين (ومنها الطالب)', () => {
    expect(parseStaffInput({ ...staff, role: 'student' })).toMatchObject({ ok: false, message: 'الدور غير صالح.' })
    expect(parseStaffInput({ ...staff, role: 'owner' })).toMatchObject({ ok: false })
  })
  it('يقبل women_admin كدورٍ يُنشأ', () => {
    expect(parseStaffInput({ ...staff, role: 'women_admin', gender: 'female' }).ok).toBe(true)
  })
  it('حقولٌ غير نصّيّة تعود رفضاً لا استثناءً', () => {
    expect(() => parseStaffInput({ ...staff, full_name: 5 })).not.toThrow()
    expect(parseStaffInput({ ...staff, full_name: 5 })).toMatchObject({ ok: false, message: 'الاسم الكامل مطلوب.' })
    expect(parseStaffInput({ ...staff, role: ['teacher'] })).toMatchObject({ ok: false })
    expect(parseStaffInput({ ...staff, password: 12345678 })).toMatchObject({ ok: false })
    expect(parseStaffInput({ ...staff, phone: 5 })).toMatchObject({ ok: true, value: { phone: null } })
  })
  it('جسمٌ غير كائن يعود رفضاً', () => {
    expect(parseStaffInput(undefined).ok).toBe(false)
    expect(parseStaffInput(null).ok).toBe(false)
    expect(parseStaffInput('x').ok).toBe(false)
  })
  it('يشترط الجنس وكلمة مرور 8 أحرف', () => {
    expect(parseStaffInput({ ...staff, gender: 'other' })).toMatchObject({ ok: false, message: 'الجنس مطلوب.' })
    expect(parseStaffInput({ ...staff, password: '1234567' })).toMatchObject({ ok: false })
  })
})

describe('parseStudentInput', () => {
  it('يطبّع الهوية العربية ويقبلها', () => {
    expect(parseStudentInput(student)).toMatchObject({ ok: true, value: { nationalId: '401234567', halaqaId: null } })
  })
  it('يرفض هويةً بطولٍ خاطئ أو غير نصّية', () => {
    expect(parseStudentInput({ ...student, national_id: '1234' }).ok).toBe(false)
    expect(parseStudentInput({ ...student, national_id: 401234567 }).ok).toBe(false)
  })
  it('الحقول الاختيارية غير النصّية تصير null', () => {
    const r = parseStudentInput({ ...student, halaqa_id: 7, birth_date: '', guardian_phone: ' 059 ' })
    expect(r).toMatchObject({ ok: true, value: { halaqaId: null, birthDate: null, guardianPhone: '059' } })
  })
  it('يشترط الاسم والجنس وكلمة المرور', () => {
    expect(parseStudentInput({ ...student, full_name: '  ' }).ok).toBe(false)
    expect(parseStudentInput({ ...student, gender: undefined }).ok).toBe(false)
    expect(parseStudentInput({ ...student, password: 'short' }).ok).toBe(false)
  })
})

describe('parseResetPasswordInput', () => {
  it('يقبل الصحيح ويرفض غير النصّ', () => {
    expect(parseResetPasswordInput({ user_id: ' u1 ', password: '12345678' })).toMatchObject({ ok: true, value: { userId: 'u1' } })
    expect(parseResetPasswordInput({ user_id: 9, password: '12345678' }).ok).toBe(false)
    expect(parseResetPasswordInput({ user_id: 'u1', password: '1234' }).ok).toBe(false)
  })
})

describe('staffProfileError', () => {
  it('23505 للمدير الإداري والفني ← 409 برسالةٍ واضحة', () => {
    expect(staffProfileError({ code: '23505', message: 'x' }, 'admin_manager')).toEqual({ statusCode: 409, message: 'يوجد مدير إداري نشط بالفعل.' })
    expect(staffProfileError({ code: '23505', message: 'x' }, 'technical_manager')).toEqual({ statusCode: 409, message: 'يوجد مدير فني نشط بالفعل.' })
  })
  it('23505 لدورٍ آخر ← 409 عامّة، وغيرها 500', () => {
    expect(staffProfileError({ code: '23505', message: 'x' }, 'teacher').statusCode).toBe(409)
    expect(staffProfileError({ code: '42501', message: 'denied' }, 'admin_manager')).toEqual({ statusCode: 500, message: 'تعذّر حفظ الملف: denied' })
  })
})

describe('studentRowError', () => {
  it('تكرار الهوية 23505 ← 409 بالرسالة العربية دون نصّ Postgres', () => {
    const r = studentRowError({ code: '23505', message: 'duplicate key value violates unique constraint "students_national_id_key"' })
    expect(r).toEqual({ statusCode: 409, message: 'رقم الهوية مسجّل لطالب آخر.' })
  })
  it('غيره ← 400', () => {
    expect(studentRowError({ code: '23503', message: 'fk' })).toEqual({ statusCode: 400, message: 'تعذّر حفظ الطالب: fk' })
  })
})

describe('authCreateError', () => {
  it('التكرار ← 409 بالرسالة المعطاة، وغيره 400', () => {
    expect(authCreateError('User already registered', 'مكرّر')).toEqual({ statusCode: 409, message: 'مكرّر' })
    expect(authCreateError('weak password', 'مكرّر')).toEqual({ statusCode: 400, message: 'weak password' })
    expect(authCreateError(undefined, 'مكرّر')).toEqual({ statusCode: 400, message: 'تعذّر إنشاء الحساب.' })
  })
})
