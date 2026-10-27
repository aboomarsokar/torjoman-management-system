import type { Database } from '~/types/database.types'
import { classifyLoginId, LOGIN_ID_ERROR } from '~/constants/identity'
import { staffEmailFromNumber, studentEmailFromIdentity } from '~/constants/accounts'
import { LOGIN_REJECTION } from '~/constants/auth'
import { loginErrorMessage } from '~/utils/loginError'
import { PROFILE_PHOTOS_GENERATIONS_KEY, PROFILE_PHOTOS_SIGNED_KEY } from '~/composables/useProfilePhotoUrls'
import { clearOfflineCaches } from '~/utils/offlineCache'
import { forgetOfflineTeacher } from '~/utils/offlineDb'

/**
 * المصادقة — الموظف برقمه الوظيفي والطالب برقم هويته، كلاهما من المتصفّح مباشرةً ببريدٍ داخليّ مشتقّ.
 * لماذا لا خادم وسيط للموظف: الدخول من عناوين Vercel القليلة يُشرك الجميع في حدّ محاولات GoTrue لكل IP،
 * ولا يضيف أماناً (اشتقاق البريد من الرقم معروضٌ في الحزمة أصلاً).
 * لا بريد ولا استعادة ذاتية: كلمة المرور يعيد تعيينها المدير الإداري.
 */
export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const impersonation = useImpersonation()

  /**
   * دخول برقم وظيفي (4 خانات) أو رقم هوية (9 خانات) وكلمة مرور.
   * يرمي الخطأ ليلتقطه المستدعي عبر useErrorHandler: رفضٌ واحد، أو «محاولات كثيرة» عند تجاوز الحدّ.
   * الحساب غير النشط: يُسجَّل خروجه فوراً ويُرمى account_disabled.
   */
  async function signInWithIdentifier(identifier: string, password: string) {
    const id = classifyLoginId(identifier)
    if (id.kind === 'invalid') throw new Error(LOGIN_ID_ERROR)

    const email = id.kind === 'staff' ? staffEmailFromNumber(id.id) : studentEmailFromIdentity(id.id)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(loginErrorMessage(error))

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error(LOGIN_REJECTION)
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', auth.user.id).single()
    if (profile?.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('account_disabled')
    }
  }

  /**
   * تسجيل الخروج ثم العودة لشاشة الدخول — ومحوُ روابط الصور الموقَّعة (لا تصلح لمن بعده).
   * ⚠️ في النيابة: `signOut()` بلا نطاق = global = إخراجُ الموظف الحقيقيّ من كلّ أجهزته — فإنهاءٌ على الخادم
   * ثم خروجٌ محلّيّ. وإن تعذّر فحصُ النيابة (شبكة) فمحلّيٌّ احتياطاً.
   */
  async function signOut() {
    const current = await impersonation.ensureChecked()
    if (current || !impersonation.isChecked.value) {
      if (current) {
        await impersonation.end({ resume: false })
          .catch((err: unknown) => console.error('[useAuth] تعذّر إنهاءُ النيابة عند الخروج:', err))
      }
      await supabase.auth.signOut({ scope: 'local' })
    } else {
      await supabase.auth.signOut()
    }
    impersonation.state.value = null
    impersonation.isChecked.value = false
    // تفريغٌ لا محو: `clearNuxtState` يجعل الحالةَ undefined فيسقط أوّلُ قارئٍ لصورةٍ بعد الدخول التالي
    // («Cannot read properties of undefined» في urlFrom)
    clearOfflineCaches()
    await forgetOfflineTeacher()
    useState(PROFILE_PHOTOS_SIGNED_KEY).value = {}
    useState(PROFILE_PHOTOS_GENERATIONS_KEY).value = {}
    await navigateTo('/login')
  }

  return { user, signInWithIdentifier, signOut }
}
