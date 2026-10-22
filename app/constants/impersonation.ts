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

export const IMPERSONATOR_ROLES = ['admin_manager', 'technical_manager', 'women_admin'] as const
export type ImpersonatorRole = typeof IMPERSONATOR_ROLES[number]

/** قائمةٌ بيضاء لكلّ فاعل — لا «كلُّ دورٍ إلا…» (تنكسر صامتةً مع كلّ دورٍ جديد). */
export const IMPERSONATION_TARGETS: Record<ImpersonatorRole, readonly Role[]> = {
  admin_manager: ['project_supervisor', 'technical_manager', 'women_admin', 'field_supervisor', 'examiner', 'teacher'],
  // المدير الفني لا يدخل على الإدارة (مشرف المشروع والمديرَين والمديرة) — قرار المستخدم 2026-10-22
  technical_manager: ['field_supervisor', 'examiner', 'teacher'],
  // المديرةُ الإدارية على قسمها (قرار 2026-10-22) — والأنثى شرطٌ في `mayImpersonate`
  women_admin: ['field_supervisor', 'examiner', 'teacher']
}

/** النصُّ نفسُه في private.assert_session_writable (يحرسه اختبار). */
export const IMPERSONATION_READ_ONLY_MESSAGE = 'أنت تتصفّح بالنيابة — قراءةٌ فقط، فلا يُحفظ شيءٌ باسم غيرك. فعّل وضعَ التعديل من الشريط إن لزم.'

/** ردُّ `GET /api/me/impersonation` — مصدرٌ واحد للخادم والواجهة. */
export interface ImpersonationStatus {
  targetName: string
  actorName: string
  actorRole: ImpersonatorRole
  expiresAt: string
  writeUntil: string | null
  /** المختومةُ تُعرض شريطاً ما دامت الجلسةُ تعمل — شريطٌ يختفي وجلسةٌ باقية هو ما بُني هذا لمنعه. */
  ended: boolean
}

export function isImpersonatorRole(role: Role | null | undefined): role is ImpersonatorRole {
  return role != null && (IMPERSONATOR_ROLES as readonly Role[]).includes(role)
}

/** القسمُ شرطٌ مع الدور (قرار 2026-10-22): المدير الفنيّ للبنين فلا ينوب عن أنثى، والمديرةُ الإدارية للبنات فلا تنوب إلا عن أنثى. */
export function mayImpersonate(actorRole: Role | null | undefined, target: { role: Role, gender: string | null }): boolean {
  if (!mayImpersonateRole(actorRole, target.role)) return false
  if (actorRole === 'technical_manager') return target.gender !== 'female'
  if (actorRole === 'women_admin') return target.gender === 'female'
  return true
}

/** هل لصاحب هذا الدور أن ينوب عن صاحب ذاك؟ (الدورُ وحده — النشاطُ والنفسُ في الخادم.) */
export function mayImpersonateRole(actorRole: Role | null | undefined, targetRole: Role): boolean {
  return isImpersonatorRole(actorRole) && IMPERSONATION_TARGETS[actorRole].includes(targetRole)
}
