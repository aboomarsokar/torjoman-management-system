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
import { OFFLINE_HOME, OFFLINE_QURAN } from '~/constants/offline'
import { OFFLINE_PATHS } from '~/constants/navigation'
import { hasOfflineTeacher } from '~/utils/offlineDb'
import { isOnlineNow } from '~/utils/reachability'

const PUBLIC_PATHS = ['/', '/login']

type Profile = Database['public']['Tables']['profiles']['Row']

export default defineNuxtRouteMiddleware(async (to) => {
  // بلا إنترنت (البند 14): لا يعمل إلا حضورُ المعلّم وإنجازُه القرآنيّ — يُفتحان بلا جلسةٍ ولا ملفّ (لا شبكةَ
  // تؤكّدهما)، وكلُّ شاشةٍ محميّةٍ تُحوَّل إلى الحضور («الإنجاز القرآني» إلى شاشته)؛ والرئيسيةُ كذلك إن كان على
  // الجهاز معلّمٌ فتحه من قبل (التطبيقُ المثبَّت يُقلع عليها)
  if (import.meta.client && !isOnlineNow()) {
    if (OFFLINE_PATHS.includes(to.path)) return
    const publicRead = to.path.startsWith('/s/') || to.path.startsWith('/news/') || to.path.startsWith('/auth')
    if (!publicRead && (to.path !== '/' || await hasOfflineTeacher())) return navigateTo(to.path === '/reports' ? OFFLINE_QURAN : OFFLINE_HOME)
  }

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
  const impersonation = decision !== 'allow' ? useImpersonation() : null
  const impersonating = !!impersonation && !!(await impersonation.ensureChecked())
  if (impersonating) decision = accountGateDecision(profile, to.path, isPublic, { impersonating })
  if (decision === 'sign-out') {
    if (impersonation && impersonating) {
      // الهدفُ عُطِّل في أثناء النيابة: تُختم على الخادم ثم خروجٌ محلّيّ (لا global يمسّ أجهزةَ الموظف)
      await impersonation.end({ resume: false })
        .catch((err: unknown) => console.error('[auth] تعذّر إنهاءُ النيابة عند الخروج:', err))
      await supabase.auth.signOut({ scope: 'local' })
      impersonation.state.value = null
      impersonation.isChecked.value = false
    } else {
      await supabase.auth.signOut()
    }
    return navigateTo('/login')
  }
  if (decision === 'change-password') {
    return navigateTo(CHANGE_PASSWORD_PATH)
  }
})
