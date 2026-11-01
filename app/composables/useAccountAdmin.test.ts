/**
 * عمليات حسابات المدير الإداري — كل عمليةٍ تذهب إلى مسارها الخادمي بالطريقة الصحيحة،
 * والعميلُ لا يرسل كلمة مرورٍ أبداً (الخادم يولّد المؤقّتة).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { staffCredentials, studentCredentials, studentResetCredentials, useAccountAdmin } from './useAccountAdmin'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAccountAdmin', () => {
  it('إنشاء الموظف والطالب بلا حقل كلمة مرور', async () => {
    fetchMock.mockResolvedValue({ id: 'x', employee_number: '1002', temp_password: 'T' })
    const { createStaff, createStudent } = useAccountAdmin()
    await createStaff({ full_name: 'أحمد', role: 'teacher', gender: 'male' })
    await createStudent({ full_name: 'سارة', gender: 'female', national_id: '401234567' })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/users', { method: 'POST', body: { full_name: 'أحمد', role: 'teacher', gender: 'male' } })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/students', { method: 'POST', body: { full_name: 'سارة', gender: 'female', national_id: '401234567' } })
    for (const call of fetchMock.mock.calls) expect(call[1].body).not.toHaveProperty('password')
  })

  it('إعادة التعيين ترسل المعرّف وحده وتعيد الكلمة المؤقّتة', async () => {
    fetchMock.mockResolvedValue({ ok: true, temp_password: 'abcDEF234567' })
    const pw = await useAccountAdmin().resetPassword('u1')
    expect(fetchMock).toHaveBeenCalledWith('/api/users/reset-password', { method: 'POST', body: { user_id: 'u1' } })
    expect(pw).toBe('abcDEF234567')
  })

  it('حذف الطالب وتصحيح هويته عبر مسارَيهما', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    const { deleteStudent, changeStudentNationalId } = useAccountAdmin()
    await deleteStudent('s1')
    await changeStudentNationalId('s1', '401234567')
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/students/s1', { method: 'DELETE' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/students/s1/national-id', { method: 'PATCH', body: { national_id: '401234567' } })
  })
})

describe('بيانات الدخول المعروضة', () => {
  it('الموظف بالرقم الوظيفي، والطالب بالهوية', () => {
    expect(staffCredentials('أحمد', '1002', 'pw', 'created')).toMatchObject({ loginLabel: 'الرقم الوظيفي', loginId: '1002', password: 'pw', title: 'تم إنشاء الحساب' })
    expect(studentCredentials('سارة', '401234567', 'pw', 'reset')).toMatchObject({ loginLabel: 'رقم الهوية', loginId: '401234567', title: 'أُعيد تعيين كلمة المرور' })
  })
})

describe('إعادة تعيين كلمة الطالب مع معلّمه', () => {
  const teacher = { teacher_id: 't1', teacher_name: 'سجى حسن', teacher_phone: '0595467160', female: true }
  it('يضيف زرَّي واتساب والمحادثة للمعلّمة', () => {
    const c = studentResetCredentials('لانا ماهر', '430117606', 'Ab12-xy', teacher)
    expect(c.whatsapp?.label).toBe('أرسلها للمعلّمة على واتساب')
    expect(c.chat).toMatchObject({ recipientId: 't1', label: 'أرسلها للمعلّمة عبر المحادثة' })
    expect(c.chat?.text).toContain('430117606')
  })
  it('بلا معلّم: النافذةُ كما كانت', () => {
    const c = studentResetCredentials('لانا ماهر', '430117606', 'Ab12-xy', null)
    expect(c.whatsapp).toBeUndefined()
    expect(c.chat).toBeUndefined()
  })
  it('resetPasswordWithTeacher يعيد الكلمةَ والمعلّم', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, temp_password: 'pw', teacher })
    await expect(useAccountAdmin().resetPasswordWithTeacher('u1')).resolves.toEqual({ password: 'pw', teacher })
  })
})
