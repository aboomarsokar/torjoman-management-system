/**
 * منطقُ مقابلات المرشّحين الخالص: تحويلُ درجات البنود بالأوزان إلى مجموعٍ من 100، ومتوسّطُ تقييمات اللجنة، والتحقّقُ من
 * نموذج التسجيل العامّ، ونصُّ رسالة الدعوة.
 */
import {
  ADVANCED_TAJWEED_LEVELS, CANDIDATE_CRITERIA, CRITERION_MAX, ELIGIBLE_RESIDENCE, MAX_ADDRESS_DETAIL, MAX_CANDIDATE_LONG, MAX_CANDIDATE_TEXT,
  MAX_EXPERIENCE_YEARS, MAX_HALAQA_AREA, MIN_EXPERIENCE_YEARS, MIN_TEACHER_PARTS, OTHER_AREA
} from '~/constants/candidates'
import { IDENTITY_LENGTH, normalizeDigits } from '~/constants/identity'

/** مجموعُ تقييمٍ واحد من 100: كلُّ بندٍ (من 5) × وزنه ÷ 5، بخانةٍ عشريّةٍ واحدة. */
export function weightedScore(scores: readonly number[]): number {
  const total = CANDIDATE_CRITERIA.reduce((sum, c, i) => sum + (Number(scores[i] ?? 0) / CRITERION_MAX) * c.weight, 0)
  return Math.round(total * 10) / 10
}

/** متوسّطُ مجاميع اللجنة، أو null بلا تقييم. */
export function averageScore(evaluations: readonly { scores: readonly number[] }[]): number | null {
  if (!evaluations.length) return null
  const sum = evaluations.reduce((s, e) => s + weightedScore(e.scores), 0)
  return Math.round((sum / evaluations.length) * 10) / 10
}

/** متوسّطُ كلّ بندٍ بين المقيّمين (من 5) — لعرض التفصيل. */
export function criterionAverages(evaluations: readonly { scores: readonly number[] }[]): (number | null)[] {
  return CANDIDATE_CRITERIA.map((_, i) => {
    if (!evaluations.length) return null
    const s = evaluations.reduce((sum, e) => sum + Number(e.scores[i] ?? 0), 0)
    return Math.round((s / evaluations.length) * 10) / 10
  })
}

/** الجوالُ بأرقامٍ لاتينية بلا فراغات، ويقبل 970/972 في أوّله فيُعيده 05…. */
export function normalizePhone(value: string): string {
  let p = normalizeDigits(value).replace(/\D/g, '')
  if (/^(970|972)5\d{8}$/.test(p)) p = '0' + p.slice(3)
  return p
}

export interface CandidateDraft {
  full_name: string
  national_id: string
  phone: string
  gender: 'male' | 'female' | ''
  birth_date: string
  /** من قائمة السكن، أو «أخرى» مع `residence_other`. */
  residence: string
  residence_other: string
  /** من قائمة المناطق، أو «أخرى» مع `halaqa_area_other`. */
  halaqa_area: string
  halaqa_area_other: string
  nearest_mosque: string
  address_detail: string
  quran_parts: string
  tajweed_level: string
  experience_years: string
  can_gather: boolean | null
  daily_commitment: boolean | null
  terms_accepted: boolean
  education: string
  experience: string
  about: string
}

/** السكنُ كما يُحفظ: الخيارُ، أو النصُّ المكتوب عند «أخرى». */
export const draftResidence = (d: Pick<CandidateDraft, 'residence' | 'residence_other'>) =>
  (d.residence === OTHER_AREA ? d.residence_other : d.residence).trim()

/** منطقةُ الحلقة كما تُحفظ: الخيارُ، أو النصُّ المكتوب عند «أخرى». */
export const draftHalaqaArea = (d: Pick<CandidateDraft, 'halaqa_area' | 'halaqa_area_other'>) =>
  (d.halaqa_area === OTHER_AREA ? d.halaqa_area_other : d.halaqa_area).trim()

const toInt = (v: string) => v.trim() === '' ? null : Number(normalizeDigits(v))

/** خطأُ نموذج التسجيل بالعربية، أو null. */
export function candidateDraftError(d: CandidateDraft): string | null {
  const name = d.full_name.trim()
  if (name.split(/\s+/).length < 3) return 'اكتب الاسم رباعياً أو ثلاثياً على الأقلّ.'
  if (name.length > MAX_CANDIDATE_TEXT) return `الاسم لا يتجاوز ${MAX_CANDIDATE_TEXT} حرف.`
  if (!new RegExp(`^\\d{${IDENTITY_LENGTH}}$`).test(normalizeDigits(d.national_id).trim())) return `رقم الهوية ${IDENTITY_LENGTH} أرقام.`
  if (!/^05\d{8}$/.test(normalizePhone(d.phone))) return 'رقم الجوال يبدأ بـ 05 ومن 10 أرقام.'
  if (!d.gender) return 'اختر الجنس.'
  if (!draftResidence(d)) return d.residence === OTHER_AREA ? 'اكتب مكان السكن.' : 'اختر مكان السكن.'
  if (!draftHalaqaArea(d)) return d.halaqa_area === OTHER_AREA ? 'اكتب منطقة الحلقة.' : 'اختر منطقة الحلقة.'
  if (!d.nearest_mosque.trim()) return 'اكتب اسم المسجد أو المصلّى.'
  if (!d.address_detail.trim()) return 'اكتب العنوان بالتفصيل.'
  const parts = toInt(d.quran_parts)
  if (parts === null || !Number.isInteger(parts) || parts < 0 || parts > 30) return 'عدد الأجزاء المحفوظة من 0 إلى 30.'
  if (!d.tajweed_level) return 'اختر مستوى التجويد.'
  const years = toInt(d.experience_years)
  if (years === null || !Number.isInteger(years) || years < 0 || years > MAX_EXPERIENCE_YEARS) return `سنوات الخبرة من 0 إلى ${MAX_EXPERIENCE_YEARS}.`
  if (d.can_gather === null) return 'أجب: هل تستطيع جمع 15 طالباً؟'
  if (d.daily_commitment === null) return 'أجب: هل تستطيع التفرّغ ساعتين يومياً؟'
  if ([draftResidence(d), d.nearest_mosque, d.education].some(v => v.trim().length > MAX_CANDIDATE_TEXT)) return `الحقول القصيرة لا تتجاوز ${MAX_CANDIDATE_TEXT} حرف.`
  if (draftHalaqaArea(d).length > MAX_HALAQA_AREA || d.address_detail.trim().length > MAX_ADDRESS_DETAIL) return `العنوان لا يتجاوز ${MAX_ADDRESS_DETAIL} حرف.`
  if ([d.experience, d.about].some(v => v.trim().length > MAX_CANDIDATE_LONG)) return `الحقول الطويلة لا تتجاوز ${MAX_CANDIDATE_LONG} حرف.`
  if (!d.terms_accepted) return 'أقرّ بقراءة الشروط قبل الإرسال.'
  return null
}

export interface EligibilityInput {
  residence: string | null
  quran_parts: number | null
  tajweed_level: string | null
  experience_years: number | null
  can_gather: boolean | null
  daily_commitment: boolean | null
}

/**
 * الشروطُ التي لا تنطبق على المرشّح بحسب ما سجّله — علامةٌ للإدارة لا رفضٌ آليّ (قرار المستخدم 2026-10-30: «يسجّل ويُعلَّم»).
 * الحقلُ الفارغ (طلباتٌ قديمة) لا يُحسب مخالفة.
 */
export function eligibilityIssues(c: EligibilityInput): string[] {
  const out: string[] = []
  if (c.residence && c.residence !== ELIGIBLE_RESIDENCE) out.push('السكن خارج مدينة غزة')
  if (c.quran_parts != null && c.quran_parts < MIN_TEACHER_PARTS) out.push(`يحفظ أقلّ من ${MIN_TEACHER_PARTS} أجزاء`)
  if (c.tajweed_level && !(ADVANCED_TAJWEED_LEVELS as readonly string[]).includes(c.tajweed_level)) out.push('لم يجتز الدورة العليا في التجويد')
  if (c.experience_years != null && c.experience_years < MIN_EXPERIENCE_YEARS) out.push(`خبرته أقلّ من ${MIN_EXPERIENCE_YEARS} سنوات`)
  if (c.can_gather === false) out.push('لا يستطيع جمع 15 طالباً')
  if (c.daily_commitment === false) out.push('لا يستطيع التفرّغ ساعتين يومياً')
  return out
}

/** رسالةُ دعوة المقابلة جاهزةً للنسخ (واتس أو SMS). */
export function inviteMessage(name: string, gender: 'male' | 'female', when: string, place: string | null): string {
  const you = gender === 'female' ? 'الأخت الكريمة' : 'الأخ الكريم'
  const first = name.trim().split(/\s+/)[0] ?? ''
  return [
    `${you} ${first}، السلام عليكم ورحمة الله`,
    `يسرّنا دعوتك إلى مقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية يوم ${when}${place ? ` في ${place}` : ''}.`,
    'نرجو الحضور في الموعد، وجزاك الله خيراً.'
  ].join('\n')
}
