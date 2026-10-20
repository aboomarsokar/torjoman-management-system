/**
 * حماية المسارات (§4.3) — تعمل على كل تنقّل.
 * المسارات العامّة: Landing، الدخول، صفحات auth. ما عداها يتطلّب جلسة.
 * - غير مسجّل يحاول دخول مسار محميّ → يُحوَّل إلى /login.
 * - مسجّل يفتح /login → يُحوَّل إلى /dashboard.
 * - حاجز الحساب (accountGateDecision): must_change_password ← /change-password وحدها، وغير النشط ← خروج.
 *   يعمل في المتصفّح فقط لأن الملف يُجلب هناك (useProfile)؛ وNuxt يعيد تشغيل الوسيط في المتصفّح عند
 *   الإماهة، فيُلحق التحديثَ الكامل للصفحة كما يُلحق التنقّل الداخلي.
 * (الصلاحيات حسب الدور تُفرَض خادميّاً عبر RLS؛ هذه طبقة تجربة المستخدم.)
 */
import type { Database } from '~/types/database.types'
import { CHANGE_PASSWORD_PATH } from '~/constants/auth'
import { accountGateDecision, type GateProfile } from '~/utils/accountGate'
import { isSessionSwitching } from '~/utils/impersonation'

const PUBLIC_PATHS = ['/', '/login']

type Profile = Database['public']['Tables']['profiles']['Row']

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  // /s/<token> صفحة اطّلاع الطالب العامّة (بلا حساب) — /news/<id> شاشة قراءة الخبر العامّة (§4.26)
  const isPublic = PUBLIC_PATHS.includes(to.path) || to.path.startsWith('/auth') || to.path.startsWith('/s/') || to.path.startsWith('/news/')

  if (!user.value) {
    // تبديلُ جلسة النيابة جارٍ: SIGNED_OUT عابرٌ من رمزٍ أبطله الخادم — والتحميلُ الكامل آتٍ
    if (isSessionSwitching()) return abortNavigation()
    return isPublic ? undefined : navigateTo('/login')
  }
  if (to.path === '/login') {
    return navigateTo('/dashboard')
  }
  if (import.meta.server) return

  // الملف المخبّأ (useProfile) إن كان لصاحب الجلسة نفسه — وإلا قراءةٌ خفيفة للعمودين وحدهما
  const uid = user.value.sub
  const supabase = useSupabaseClient<Database>()
  const cached = useNuxtData<Profile | null>('current-profile').data.value
  let profile: GateProfile | null = cached?.id === uid ? cached : null
  if (!profile) {
    const { data, error } = await supabase.from('profiles').select('must_change_password, status').eq('id', uid).maybeSingle()
    profile = error ? null : data
  }

  let decision = accountGateDecision(profile, to.path, isPublic)
  // النادرُ وحده يسأل الخادم: في النيابة لا يُساق المديرُ إلى تغيير كلمةِ غيره، ولا يُخرَج الموظفُ من أجهزته
  const impersonating = decision !== 'allow' && !!(await useImpersonation().ensureChecked())
  if (impersonating) decision = accountGateDecision(profile, to.path, isPublic, { impersonating })
  if (decision === 'sign-out') {
    await supabase.auth.signOut(impersonating ? { scope: 'local' } : undefined)
    return navigateTo('/login')
  }
  if (decision === 'change-password') {
    return navigateTo(CHANGE_PASSWORD_PATH)
  }
})
