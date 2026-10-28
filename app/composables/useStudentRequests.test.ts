import { describe, expect, it } from 'vitest'
import { blankStudentRequest, chatFor, studentRequestError } from './useStudentRequests'

const draft = (over: Partial<ReturnType<typeof blankStudentRequest>> = {}) =>
  ({ ...blankStudentRequest(), full_name: 'مصطفى عاطف مصطفى التتر', national_id: '432248433', ...over })

describe('studentRequestError', () => {
  it('يقبل طلباً صحيحاً، والجوالُ اختياريّ', () => {
    expect(studentRequestError(draft())).toBeNull()
    expect(studentRequestError(draft({ guardian_phone: '0595143593' }))).toBeNull()
  })
  it('يطلب الاسم رباعياً', () => {
    expect(studentRequestError(draft({ full_name: 'علي' }))).toBe('اكتب اسم الطالب رباعياً.')
  })
  it('الهويةُ تسعُ خانات بخانة تحقّقٍ صحيحة (والأرقامُ العربية تُطبَّع)', () => {
    expect(studentRequestError(draft({ national_id: '43224843' }))).toBe('رقم الهوية تسع خانات.')
    expect(studentRequestError(draft({ national_id: '432165479' }))).toBe('رقم الهوية غير صحيح — تحقّق من خاناته.')
    expect(studentRequestError(draft({ national_id: '٤٣٢٢٤٨٤٣٣' }))).toBeNull()
  })
  it('جوالُ وليّ الأمر 05 وعشرُ خانات', () => {
    expect(studentRequestError(draft({ guardian_phone: '599514359' }))).toBe('جوال وليّ الأمر عشر خانات يبدأ بـ05.')
  })
})

describe('chatFor', () => {
  const res = { teacher_id: 't1', teacher_name: 'سجى حسن', full_name: 'آية أحمد', national_id: '432248433', temp_password: 'Ab12-xy', female: true }
  it('للمعلّمة بالمؤنّث وبالرسالة غير المنسّقة', () => {
    const c = chatFor(res)!
    expect(c.label).toBe('أرسلها للمعلّمة عبر المحادثة')
    expect(c.recipientId).toBe('t1')
    expect(c.text).toContain('Ab12-xy')
    expect(c.text).not.toContain('*')
  })
  it('null لحلقةٍ بلا معلّم', () => {
    expect(chatFor({ ...res, teacher_id: null })).toBeNull()
  })
})
