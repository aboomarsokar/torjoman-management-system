import { describe, expect, it } from 'vitest'
import {
  authCreateError, HALAQA_GENDER_MISMATCH_MESSAGE, HALAQA_NOT_FOUND_MESSAGE, INVALID_ID_MESSAGE, parseNationalIdInput,
  parseRecordId, parseResetPasswordInput, parseStaffInput, parseStudentInput, staffProfileError, studentHalaqaError,
  studentRowError, trimmedString, WOMEN_ADMIN_GENDER_MESSAGE
} from './accountInput'

const staff = { full_name: ' أحمد ', role: 'teacher', gender: 'male' }
const student = { full_name: 'سارة', gender: 'female', national_id: '٤٠١٢٣٤٥٦٧' }

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
  it('يقبل women_admin كدورٍ يُنشأ (أنثى)', () => {
    expect(parseStaffInput({ ...staff, role: 'women_admin', gender: 'female' }).ok).toBe(true)
  })
  it('يرفض women_admin بجنس الذكر', () => {
    expect(parseStaffInput({ ...staff, role: 'women_admin', gender: 'male' })).toEqual({ ok: false, message: WOMEN_ADMIN_GENDER_MESSAGE })
  })
  it('لا يقبل كلمة مرورٍ من العميل ولا يعيدها', () => {
    const r = parseStaffInput({ ...staff, password: 'Client-Chosen-1' })
    expect(r.ok).toBe(true)
    expect(r.ok && 'password' in r.value).toBe(false)
  })
  it('حقولٌ غير نصّيّة تعود رفضاً لا استثناءً', () => {
    expect(() => parseStaffInput({ ...staff, full_name: 5 })).not.toThrow()
    expect(parseStaffInput({ ...staff, full_name: 5 })).toMatchObject({ ok: false, message: 'الاسم الكامل مطلوب.' })
    expect(parseStaffInput({ ...staff, role: ['teacher'] })).toMatchObject({ ok: false })
    expect(parseStaffInput({ ...staff, phone: 5 })).toMatchObject({ ok: true, value: { phone: null } })
  })
  it('جسمٌ غير كائن يعود رفضاً', () => {
    expect(parseStaffInput(undefined).ok).toBe(false)
    expect(parseStaffInput(null).ok).toBe(false)
    expect(parseStaffInput('x').ok).toBe(false)
  })
  it('يشترط الجنس', () => {
    expect(parseStaffInput({ ...staff, gender: 'other' })).toMatchObject({ ok: false, message: 'الجنس مطلوب.' })
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
  it('يشترط الاسم والجنس', () => {
    expect(parseStudentInput({ ...student, full_name: '  ' }).ok).toBe(false)
    expect(parseStudentInput({ ...student, gender: undefined }).ok).toBe(false)
  })
})

describe('parseNationalIdInput', () => {
  it('يطبّع الأرقام العربية ويقبل تسع خانات', () => {
    expect(parseNationalIdInput({ national_id: ' ٤٠١٢٣٤٥٦٧ ' })).toEqual({ ok: true, value: { nationalId: '401234567' } })
  })
  it('يرفض الطول الخاطئ وغير النصّ والجسم الفارغ', () => {
    expect(parseNationalIdInput({ national_id: '12345678' }).ok).toBe(false)
    expect(parseNationalIdInput({ national_id: 401234567 }).ok).toBe(false)
    expect(parseNationalIdInput(undefined).ok).toBe(false)
  })
})

describe('parseRecordId', () => {
  it('يقبل UUID ويوحّد الحالة', () => {
    expect(parseRecordId('6AA5D0D4-2A9F-4483-B6C8-0CF4C6C98AC4')).toEqual({ ok: true, value: '6aa5d0d4-2a9f-4483-b6c8-0cf4c6c98ac4' })
  })
  it('يرفض غير UUID', () => {
    expect(parseRecordId('1; drop')).toEqual({ ok: false, message: INVALID_ID_MESSAGE })
    expect(parseRecordId(undefined).ok).toBe(false)
  })
})

describe('studentHalaqaError', () => {
  it('يقبل حلقةً من جنس الطالب', () => {
    expect(studentHalaqaError('female', { gender: 'female' })).toBeNull()
    expect(studentHalaqaError('male', { gender: 'male' })).toBeNull()
  })
  it('يرفض حلقةً من الجنس الآخر', () => {
    expect(studentHalaqaError('female', { gender: 'male' })).toBe(HALAQA_GENDER_MISMATCH_MESSAGE)
    expect(studentHalaqaError('male', { gender: 'female' })).toBe('جنس الطالب لا يطابق جنس الحلقة.')
  })
  it('يرفض حلقةً غير موجودة', () => {
    expect(studentHalaqaError('male', null)).toBe(HALAQA_NOT_FOUND_MESSAGE)
  })
  it('حلقة بلا جنسٍ محدَّد لا تُرفض (كحارس القاعدة)', () => {
    expect(studentHalaqaError('female', { gender: null })).toBeNull()
  })
})

describe('parseResetPasswordInput', () => {
  it('يقبل المعرّف وحده ويرفض غير النصّ', () => {
    expect(parseResetPasswordInput({ user_id: ' u1 ' })).toEqual({ ok: true, value: { userId: 'u1' } })
    expect(parseResetPasswordInput({ user_id: 9 }).ok).toBe(false)
    expect(parseResetPasswordInput({}).ok).toBe(false)
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
