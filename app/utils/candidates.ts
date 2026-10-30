/**
 * منطقُ مقابلات المرشّحين الخالص: تحويلُ درجات البنود بالأوزان إلى مجموعٍ من 100، ومتوسّطُ تقييمات اللجنة، والتحقّقُ من
 * نموذج التسجيل العامّ، ونصُّ رسالة الدعوة.
 */
import { CANDIDATE_CRITERIA, CRITERION_MAX, MAX_CANDIDATE_LONG, MAX_CANDIDATE_TEXT } from '~/constants/candidates'
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
  residence: string
  nearest_mosque: string
  quran_parts: string
  tajweed_level: string
  education: string
  experience: string
  about: string
}

/** خطأُ نموذج التسجيل بالعربية، أو null. */
export function candidateDraftError(d: CandidateDraft): string | null {
  const name = d.full_name.trim()
  if (name.split(/\s+/).length < 3) return 'اكتب الاسم رباعياً أو ثلاثياً على الأقلّ.'
  if (name.length > MAX_CANDIDATE_TEXT) return `الاسم لا يتجاوز ${MAX_CANDIDATE_TEXT} حرف.`
  if (!new RegExp(`^\\d{${IDENTITY_LENGTH}}$`).test(normalizeDigits(d.national_id).trim())) return `رقم الهوية ${IDENTITY_LENGTH} أرقام.`
  if (!/^05\d{8}$/.test(normalizePhone(d.phone))) return 'رقم الجوال يبدأ بـ 05 ومن 10 أرقام.'
  if (!d.gender) return 'اختر الجنس.'
  const parts = d.quran_parts.trim() === '' ? null : Number(normalizeDigits(d.quran_parts))
  if (parts !== null && (!Number.isInteger(parts) || parts < 0 || parts > 30)) return 'عدد الأجزاء المحفوظة من 0 إلى 30.'
  if ([d.residence, d.nearest_mosque, d.education, d.tajweed_level].some(v => v.trim().length > MAX_CANDIDATE_TEXT)) return `الحقول القصيرة لا تتجاوز ${MAX_CANDIDATE_TEXT} حرف.`
  if ([d.experience, d.about].some(v => v.trim().length > MAX_CANDIDATE_LONG)) return `الحقول الطويلة لا تتجاوز ${MAX_CANDIDATE_LONG} حرف.`
  return null
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
