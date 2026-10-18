/**
 * حاجز الحساب بعد الدخول — قرارٌ نقيّ يطبّقه وسيط المسارات (auth.global.ts):
 * - الحساب غير النشط ← خروج (لا يستعمل التطبيق ولو بقيت جلسته).
 * - must_change_password قائم ← شاشة تغيير الكلمة وحدها (والصفحات العامّة والخروج).
 * - تعذّرت قراءة الملف ← مرور: الحاجز طبقة تجربة، والحكم لـRLS (ولا يُحبس أحدٌ بانقطاع الشبكة).
 */
import { CHANGE_PASSWORD_PATH } from '~/constants/auth'

export interface GateProfile {
  must_change_password: boolean
  status: string
}

export type GateDecision = 'allow' | 'change-password' | 'sign-out'

export function accountGateDecision(profile: GateProfile | null, path: string, isPublic: boolean): GateDecision {
  if (!profile) return 'allow'
  if (profile.status !== 'active') return 'sign-out'
  if (profile.must_change_password && !isPublic && path !== CHANGE_PASSWORD_PATH) return 'change-password'
  return 'allow'
}
