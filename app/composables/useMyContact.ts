/**
 * الطالب يعدّل أربعة حقولٍ من بياناته بنفسه (طلب المستخدم 2026-10-20): جوّاله، وبريد وليّ أمره، والسكن،
 * وأقرب مسجد — عبر `update_my_contact()` التي تكتب الأعمدةَ الأربعة وحدها في صفّه، فلا يمرّ غيرُها.
 * التطبيعُ والتحقّقُ هنا نقيّان ومختبَران، ويطابقان فحوصَ القاعدة (وهي الحَكَم).
 */
import type { Database } from '~/types/database.types'
import { normalizeDigits } from '~/constants/identity'
import { CONTACT_EMAIL_MAX, CONTACT_PHONE_MAX_DIGITS, CONTACT_PHONE_MIN_DIGITS, CONTACT_TEXT_MAX } from '~/constants/studentContact'

export interface MyContactInput {
  phone: string
  guardian_email: string
  residence: string
  nearest_mosque: string
}

export type MyContactResult = { ok: true, value: MyContactInput } | { ok: false, message: string }

const PHONE_PATTERN = new RegExp(`^\\+?[0-9]{${CONTACT_PHONE_MIN_DIGITS},${CONTACT_PHONE_MAX_DIGITS}}$`)
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * يطبّع ويتحقّق: الجوّالُ بأرقامٍ لاتينية بلا مسافاتٍ ولا شُرَطٍ ولا أقواس، والبريدُ بحروفٍ صغيرة،
 * والنصوصُ مقصوصةُ الأطراف. الفارغُ مقبولٌ (مسحٌ مقصود) ويُحفظ null في القاعدة.
 */
export function normalizeMyContact(input: MyContactInput): MyContactResult {
  const phone = normalizeDigits(input.phone).replace(/[\s\-()]/g, '')
  const email = input.guardian_email.trim().toLowerCase()
  const residence = input.residence.trim()
  const mosque = input.nearest_mosque.trim()

  if (phone && !PHONE_PATTERN.test(phone)) {
    return { ok: false, message: `رقم الجوال غير صحيح — أرقامٌ فقط (${CONTACT_PHONE_MIN_DIGITS} إلى ${CONTACT_PHONE_MAX_DIGITS}).` }
  }
  if (email && (email.length > CONTACT_EMAIL_MAX || !EMAIL_PATTERN.test(email))) {
    return { ok: false, message: 'البريد الإلكتروني غير صحيح.' }
  }
  if (residence.length > CONTACT_TEXT_MAX || mosque.length > CONTACT_TEXT_MAX) {
    return { ok: false, message: `النصّ أطول من ${CONTACT_TEXT_MAX} حرفاً.` }
  }
  return { ok: true, value: { phone, guardian_email: email, residence, nearest_mosque: mosque } }
}

export function useMyContact() {
  const supabase = useSupabaseClient<Database>()
  const saving = ref(false)

  /** يحفظ الحقولَ الأربعة (مطبَّعةً سلفاً بـnormalizeMyContact). */
  async function saveMyContact(value: MyContactInput): Promise<void> {
    saving.value = true
    try {
      const { error } = await supabase.rpc('update_my_contact', {
        p_phone: value.phone,
        p_guardian_email: value.guardian_email,
        p_residence: value.residence,
        p_nearest_mosque: value.nearest_mosque
      })
      if (error) throw error
    } finally {
      saving.value = false
    }
  }

  return { saving, saveMyContact }
}
