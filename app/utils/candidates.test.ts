import { describe, expect, it } from 'vitest'
import { CANDIDATE_CRITERIA } from '~/constants/candidates'
import { averageScore, candidateDraftError, criterionAverages, eligibilityIssues, inviteMessage, normalizePhone, weightedScore, type CandidateDraft } from './candidates'

const draft = (o: Partial<CandidateDraft> = {}): CandidateDraft => ({
  full_name: 'محمد أحمد سالم', national_id: '123456789', phone: '0599123456', gender: 'male', birth_date: '',
  residence: 'غزة', residence_other: '', halaqa_area: 'الرمال', halaqa_area_other: '', nearest_mosque: 'مسجد الهدى', address_detail: 'شارع الوحدة',
  quran_parts: '10', tajweed_level: 'عليا', experience_years: '6', can_gather: true, daily_commitment: true, terms_accepted: true,
  education: '', experience: '', about: '', ...o
})

describe('مقابلات المرشحين', () => {
  it('مجموع الأوزان 100', () => {
    expect(CANDIDATE_CRITERIA.reduce((s, c) => s + c.weight, 0)).toBe(100)
  })

  it('التحويل بالأوزان', () => {
    expect(weightedScore(Array(10).fill(10))).toBe(100)
    expect(weightedScore(Array(10).fill(0))).toBe(0)
    // معالجة المواقف (25) كاملة وحدها
    expect(weightedScore([0, 0, 0, 0, 10, 0, 0, 0, 0, 0])).toBe(25)
    expect(weightedScore([6, 6, 6, 6, 6, 6, 6, 6, 6, 6])).toBe(60)
  })

  it('متوسط اللجنة ومتوسط البنود', () => {
    expect(averageScore([])).toBeNull()
    expect(averageScore([{ scores: Array(10).fill(10) }, { scores: Array(10).fill(6) }])).toBe(80)
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
    expect(candidateDraftError(draft({ quran_parts: '' }))).toBe('عدد الأجزاء المحفوظة من 0 إلى 30.')
    expect(candidateDraftError(draft({ residence: 'أخرى' }))).toBe('اكتب مكان السكن.')
    expect(candidateDraftError(draft({ residence: 'أخرى', residence_other: 'رفح' }))).toBeNull()
    expect(candidateDraftError(draft({ halaqa_area: '' }))).toBe('اختر منطقة الحلقة.')
    expect(candidateDraftError(draft({ halaqa_area: 'أخرى' }))).toBe('اكتب منطقة الحلقة.')
    expect(candidateDraftError(draft({ halaqa_area: 'أخرى', halaqa_area_other: 'جباليا' }))).toBeNull()
    expect(candidateDraftError(draft({ address_detail: ' ' }))).toBe('اكتب العنوان بالتفصيل.')
    expect(candidateDraftError(draft({ can_gather: null }))).toBe('أجب: هل تستطيع جمع 15 طالباً؟')
    expect(candidateDraftError(draft({ daily_commitment: false }))).toBeNull()
    expect(candidateDraftError(draft({ terms_accepted: false }))).toBe('أقرّ بقراءة الشروط قبل الإرسال.')
  })

  it('علامة عدم انطباق الشروط', () => {
    const ok = { residence: 'غزة', quran_parts: 5, tajweed_level: 'عليا', experience_years: 5, can_gather: true, daily_commitment: true }
    expect(eligibilityIssues(ok)).toEqual([])
    expect(eligibilityIssues({ ...ok, residence: 'النصيرات', quran_parts: 3, tajweed_level: 'تأهيلية', experience_years: 2, can_gather: false, daily_commitment: false })).toHaveLength(6)
    // الطلبات القديمة بلا الحقول الجديدة لا تُعلَّم
    expect(eligibilityIssues({ residence: null, quran_parts: null, tajweed_level: null, experience_years: null, can_gather: null, daily_commitment: null })).toEqual([])
  })

  it('رسالة الدعوة بالجنس', () => {
    const m = inviteMessage('فاطمة علي حسن', 'female', 'السبت 01-11 الساعة 10:00', 'مقر المشروع')
    expect(m).toContain('الأخت الكريمة فاطمة')
    expect(m).toContain('في مقر المشروع')
  })
})
