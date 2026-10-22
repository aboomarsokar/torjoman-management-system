/**
 * نطاقُ الدخول بالنيابة ومدخلاتُه — دوالّ نقيّة بلا h3 ولا قاعدة (نمط accountInput): تُرجع قراراً ولا ترمي،
 * والمسارُ يحوّل القرارَ خطأً.
 * ⚠️ «لا نيابة داخل نيابة» يُفحص أوّلاً: المديرُ الإداري ينوب عن المدير الفني فتصير الجلسةُ «مديراً فنياً»
 * — وبلا هذا الفحص تبدأ نيابةً ثانية لا يقول سجلُّها من بدأ (ثغرةُ الصحابة).
 */
import type { Role } from '~/constants/roles'
import { isImpersonatorRole, mayImpersonate } from '~/constants/impersonation'
import { parseRecordId, type Parsed } from './accountInput'

export type Decision = { ok: true } | { ok: false, statusCode: 400 | 403, message: string }

export const NESTED_IMPERSONATION_MESSAGE = 'لا نيابةَ داخل نيابة — أنهِ النيابةَ الحاليّة أولاً.'

export function assertMayImpersonate(
  actor: { id: string, role: Role, isImpersonating: boolean },
  target: { id: string, role: Role, status: string, gender: string | null }
): Decision {
  if (actor.isImpersonating) return { ok: false, statusCode: 403, message: NESTED_IMPERSONATION_MESSAGE }
  if (!isImpersonatorRole(actor.role)) {
    return { ok: false, statusCode: 403, message: 'الدخولُ بالنيابة للمدير الإداري والمدير الفني وحدهما.' }
  }
  if (actor.id === target.id) return { ok: false, statusCode: 400, message: 'أنت في حسابك أصلاً.' }
  if (target.status !== 'active') return { ok: false, statusCode: 400, message: 'هذا الحساب غير مُفعَّل — لا يُناب عنه.' }
  if (!mayImpersonate(actor.role, target)) {
    return { ok: false, statusCode: 403, message: 'لا تملك الدخولَ بحساب صاحب هذا الدور.' }
  }
  return { ok: true }
}

/**
 * إلى أين يعود الفاعلُ عند الإنهاء: القائمةُ أو ملفُّ الهدف أو صفحتُه مشرفاً — وكلُّ ما سواه ملفُّ الهدف.
 * لا رابطَ حرٌّ من الطلب: قائمةٌ مغلقةٌ لا تقود خارج النظام.
 */
export function impersonationReturnTo(from: unknown, targetId: string): string {
  const allowed = ['/users', `/profile/${targetId}`, `/supervisors/${targetId}`]
  return typeof from === 'string' && allowed.includes(from) ? from : `/profile/${targetId}`
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {}
}

/** معرّفُ ملفّ الهدف وحده — لا بريدَ يُقبل من الطلب (`generateLink` يُنشئ حساباً لبريدٍ مجهول). */
export function parseImpersonateInput(body: unknown): Parsed<{ profileId: string, from: string | null }> {
  const raw = asRecord(body)
  const id = parseRecordId(raw.profileId)
  if (!id.ok) return id
  return { ok: true, value: { profileId: id.value, from: typeof raw.from === 'string' && raw.from ? raw.from : null } }
}

export function parseWriteModeInput(body: unknown): Parsed<{ on: boolean }> {
  const on = asRecord(body).on
  if (typeof on !== 'boolean') return { ok: false, message: 'حدّد فتحَ وضع التعديل أو إغلاقه.' }
  return { ok: true, value: { on } }
}

/** `resume` افتراضاً true (العودةُ إلى حساب الفاعل)؛ false = خروجٌ بلا عودة. */
export function parseEndInput(body: unknown): Parsed<{ resume: boolean }> {
  const resume = asRecord(body).resume
  if (resume === undefined) return { ok: true, value: { resume: true } }
  if (typeof resume !== 'boolean') return { ok: false, message: 'قيمةُ العودة غير صالحة.' }
  return { ok: true, value: { resume } }
}

/** مطالبةُ `session_id` من رمز الوصول (بلا تحقّقٍ من التوقيع — الرمزُ صادرٌ للتوّ من GoTrue نفسه). */
export function sessionIdFromAccessToken(token: string): string | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { session_id?: unknown }
    return typeof claims.session_id === 'string' && claims.session_id ? claims.session_id : null
  } catch {
    return null
  }
}
