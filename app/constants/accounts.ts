/**
 * البريد الداخلي للحسابات — Supabase يشترط بريداً، والمستخدمون بلا بريد.
 * ⚠️ لا يُرسل إلى هذين النطاقين شيء، ولا خادم بريد عليهما.
 * ⚠️ بريد الطالب يُشتقّ في شاشة الدخول وعند الإنشاء — لو اختلف البناءان حرفاً
 * صار حسابٌ لا يدخله صاحبه. ومثله بريد الموظف في الخادم.
 */
import { normalizeDigits } from './identity'

export const OWNED_DOMAIN = 'torjoman.org'
export const STAFF_EMAIL_DOMAIN = `staff.${OWNED_DOMAIN}`
export const STUDENT_EMAIL_DOMAIN = `students.${OWNED_DOMAIN}`

export function staffEmailFromNumber(employeeNumber: string): string {
  return `${normalizeDigits(employeeNumber.trim())}@${STAFF_EMAIL_DOMAIN}`
}

export function studentEmailFromIdentity(identity: string): string {
  return `${normalizeDigits(identity.trim())}@${STUDENT_EMAIL_DOMAIN}`
}
