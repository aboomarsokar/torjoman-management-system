import { describe, expect, it } from 'vitest'
import { blankStudentRequest, studentRequestError } from './useStudentRequests'

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
