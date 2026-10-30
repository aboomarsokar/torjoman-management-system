/**
 * التسجيلُ العامّ في مقابلات المرشّحين والاستعلامُ عن الطلب (بلا حساب): الدالّتان `register_candidate` و`candidate_status_lookup`
 * وحدهما — الزائرُ لا يقرأ الجداول.
 */
import type { Database } from '~/types/database.types'
import { normalizeDigits } from '~/constants/identity'
import { candidateDraftError, draftHalaqaArea, draftResidence, normalizePhone, type CandidateDraft } from '~/utils/candidates'

export interface CandidateLookup { full_name: string, status: Database['public']['Enums']['candidate_status'], interview_at: string | null, interview_place: string | null }

export const blankCandidate = (): CandidateDraft => ({
  full_name: '', national_id: '', phone: '', gender: '', birth_date: '', residence: '', residence_other: '', halaqa_area: '', halaqa_area_other: '',
  nearest_mosque: '', address_detail: '', quran_parts: '', tajweed_level: '', experience_years: '', can_gather: null,
  daily_commitment: null, terms_accepted: false, education: '', experience: '', about: ''
})

export function useCandidateRegistration() {
  const supabase = useSupabaseClient<Database>()
  const busy = ref(false)
  const error = ref<string | null>(null)

  /** يرسل الطلب؛ يعيد true عند النجاح، ويضع الخطأ العربيّ في `error`. */
  async function register(d: CandidateDraft): Promise<boolean> {
    error.value = candidateDraftError(d)
    if (error.value) return false
    busy.value = true
    const { error: e } = await supabase.rpc('register_candidate', {
      p_full_name: d.full_name.trim(),
      p_national_id: normalizeDigits(d.national_id).trim(),
      p_phone: normalizePhone(d.phone),
      p_gender: d.gender as 'male' | 'female',
      p_residence: draftResidence(d),
      p_halaqa_area: draftHalaqaArea(d),
      p_nearest_mosque: d.nearest_mosque.trim(),
      p_address_detail: d.address_detail.trim(),
      p_quran_parts: Number(normalizeDigits(d.quran_parts)),
      p_tajweed_level: d.tajweed_level,
      p_experience_years: Number(normalizeDigits(d.experience_years)),
      p_can_gather: d.can_gather as boolean,
      p_daily_commitment: d.daily_commitment as boolean,
      p_terms_accepted: d.terms_accepted,
      p_birth_date: d.birth_date || undefined,
      p_education: d.education.trim() || undefined,
      p_experience: d.experience.trim() || undefined,
      p_about: d.about.trim() || undefined
    })
    busy.value = false
    if (e) {
      error.value = e.message?.match(/[؀-ۿ]/) ? e.message : 'تعذّر إرسال الطلب — تحقّق من الاتصال وحاول مرّةً أخرى.'
      return false
    }
    return true
  }

  /** الاستعلامُ برقم الهوية والجوال معاً. */
  async function lookup(nationalId: string, phone: string): Promise<CandidateLookup | null | undefined> {
    error.value = null
    busy.value = true
    const { data, error: e } = await supabase.rpc('candidate_status_lookup', { p_national_id: normalizeDigits(nationalId).trim(), p_phone: normalizePhone(phone) })
    busy.value = false
    if (e) {
      error.value = 'تعذّر الاستعلام — حاول مرّةً أخرى.'
      return undefined
    }
    return (data ?? [])[0] ?? null
  }

  return { busy, error, register, lookup }
}
