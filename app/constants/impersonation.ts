/**
 * الدخول بالنيابة — مصدرٌ واحد للخادم والواجهة: المدّتان، والفاعلان، ومن يُناب عنه، ونصُّ المنع.
 * النطاقُ قائمةٌ بيضاء لكلّ فاعل لا «كلُّ دورٍ إلا…»: النفيُ ينكسر صامتاً مع كلّ دورٍ جديد.
 */
import type { Role } from '~/constants/roles'

/** عمرُ جلسة النيابة — يطابق قيدَ `impersonation_window` في القاعدة. */
export const IMPERSONATION_WINDOW_MINUTES = 30
/** نافذةُ الكتابة في وضع التعديل — لا تتجاوز انتهاءَ الجلسة. */
export const WRITE_WINDOW_MINUTES = 10
/** مدى كنس نيابات الفاعل السابقة عند بدء نيابةٍ جديدة. */
export const STALE_SWEEP_HOURS = 24

export const IMPERSONATOR_ROLES = ['admin_manager', 'technical_manager'] as const
export type ImpersonatorRole = typeof IMPERSONATOR_ROLES[number]

/** قائمةٌ بيضاء لكلّ فاعل — لا «كلُّ دورٍ إلا…» (تنكسر صامتةً مع كلّ دورٍ جديد). */
export const IMPERSONATION_TARGETS: Record<ImpersonatorRole, readonly Role[]> = {
  admin_manager: ['project_supervisor', 'technical_manager', 'women_admin', 'field_supervisor', 'examiner', 'teacher'],
  technical_manager: ['project_supervisor', 'women_admin', 'field_supervisor', 'examiner', 'teacher']
}

/** النصُّ نفسُه في private.assert_session_writable (يحرسه اختبار). */
export const IMPERSONATION_READ_ONLY_MESSAGE = 'أنت تتصفّح بالنيابة — قراءةٌ فقط، فلا يُحفظ شيءٌ باسم غيرك. فعّل وضعَ التعديل من الشريط إن لزم.'

export function isImpersonatorRole(role: Role | null | undefined): role is ImpersonatorRole {
  return role != null && (IMPERSONATOR_ROLES as readonly Role[]).includes(role)
}

/** هل لصاحب هذا الدور أن ينوب عن صاحب ذاك؟ (الدورُ وحده — النشاطُ والنفسُ في الخادم.) */
export function mayImpersonateRole(actorRole: Role | null | undefined, targetRole: Role): boolean {
  return isImpersonatorRole(actorRole) && IMPERSONATION_TARGETS[actorRole].includes(targetRole)
}
