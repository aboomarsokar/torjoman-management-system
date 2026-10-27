/** نطاقُ مرسِلي SMS (منطقٌ صرفٌ يُختبر بلا Nuxt) — يستعمله requireSmsSender ومسارُ الإرسال. */
import { normalizeLocalPhone } from '~/utils/sms'

export type SmsSection = 'male' | 'female'
/** القسمُ المفروض على كلّ دورٍ يرسل — null للمدير الإداريّ (بلا قيد). */
export const SMS_SENDER_SECTION: Record<string, SmsSection | null> = {
  admin_manager: null,
  technical_manager: 'male',
  women_admin: 'female'
}

/** الأرقامُ التي ليست لعاملٍ من القسم — `staff` جوّالاتُ العاملين النشطين من القسم بأيّ صيغة. */
export function phonesOutsideSection(phones: string[], staff: (string | null)[]): string[] {
  const allowed = new Set(staff.map(p => normalizeLocalPhone(p)).filter((p): p is string => !!p))
  return phones.filter(p => !allowed.has(p))
}
