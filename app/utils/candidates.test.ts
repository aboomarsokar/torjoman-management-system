import { describe, expect, it } from 'vitest'
import { CANDIDATE_CRITERIA } from '~/constants/candidates'
import { averageScore, candidateDraftError, criterionAverages, inviteMessage, normalizePhone, weightedScore, type CandidateDraft } from './candidates'

const draft = (o: Partial<CandidateDraft> = {}): CandidateDraft => ({
  full_name: 'محمد أحمد سالم', national_id: '123456789', phone: '0599123456', gender: 'male', birth_date: '',
  residence: '', nearest_mosque: '', quran_parts: '', tajweed_level: '', education: '', experience: '', about: '', ...o
})

describe('مقابلات المرشحين', () => {
  it('مجموع الأوزان 100', () => {
    expect(CANDIDATE_CRITERIA.reduce((s, c) => s + c.weight, 0)).toBe(100)
  })

  it('التحويل بالأوزان', () => {
    expect(weightedScore(Array(10).fill(5))).toBe(100)
    expect(weightedScore(Array(10).fill(0))).toBe(0)
    // معالجة المواقف (25) كاملة وحدها
    expect(weightedScore([0, 0, 0, 0, 5, 0, 0, 0, 0, 0])).toBe(25)
    expect(weightedScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(60)
  })

  it('متوسط اللجنة ومتوسط البنود', () => {
    expect(averageScore([])).toBeNull()
    expect(averageScore([{ scores: Array(10).fill(5) }, { scores: Array(10).fill(3) }])).toBe(80)
    const avg = criterionAverages([{ scores: [5, 4, 3, 2, 1, 0, 5, 5, 5, 5] }, { scores: [3, 4, 3, 2, 1, 0, 5, 5, 5, 4] }])
    expect(avg[0]).toBe(4)
    expect(avg[9]).toBe(4.5)
  })

  it('توحيد الجوال', () => {
    expect(normalizePhone('٠٥٩٩ ١٢٣ ٤٥٦')).toBe('0599123456')
    expect(normalizePhone('+970599123456')).toBe('0599123456')
  })

  it('التحقق من التسجيل', () => {
    expect(candidateDraftError(draft())).toBeNull()
    expect(candidateDraftError(draft({ full_name: 'محمد أحمد' }))).toBe('اكتب الاسم رباعياً أو ثلاثياً على الأقلّ.')
    expect(candidateDraftError(draft({ national_id: '12345' }))).toBe('رقم الهوية 9 أرقام.')
    expect(candidateDraftError(draft({ national_id: '١٢٣٤٥٦٧٨٩' }))).toBeNull()
    expect(candidateDraftError(draft({ phone: '0812345678' }))).toBe('رقم الجوال يبدأ بـ 05 ومن 10 أرقام.')
    expect(candidateDraftError(draft({ gender: '' }))).toBe('اختر الجنس.')
    expect(candidateDraftError(draft({ quran_parts: '31' }))).toBe('عدد الأجزاء المحفوظة من 0 إلى 30.')
  })

  it('رسالة الدعوة بالجنس', () => {
    const m = inviteMessage('فاطمة علي حسن', 'female', 'السبت 01-11 الساعة 10:00', 'مقر المشروع')
    expect(m).toContain('الأخت الكريمة فاطمة')
    expect(m).toContain('في مقر المشروع')
  })
})
