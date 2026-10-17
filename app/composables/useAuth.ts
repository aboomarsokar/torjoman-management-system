import type { Database } from '~/types/database.types'
import { classifyLoginId, LOGIN_ID_ERROR } from '~/constants/identity'
import { studentEmailFromIdentity } from '~/constants/accounts'

/** رسالة رفض الدخول الموحّدة — لا تفرّق بين رقم خاطئ وكلمة مرور خاطئة. */
const LOGIN_REJECTION = 'الرقم أو كلمة المرور غير صحيحة.'

/**
 * المصادقة — الموظف برقمه الوظيفي (عبر الخادم)، والطالب برقم هويته (مباشرةً).
 * لا بريد ولا استعادة ذاتية: كلمة المرور يعيد تعيينها المدير الإداري.
 */
export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  /**
   * دخول برقم وظيفي (4 خانات) أو رقم هوية (9 خانات) وكلمة مرور.
   * يرمي الخطأ ليلتقطه المستدعي عبر useErrorHandler.
   * الحساب غير النشط: يُسجَّل خروجه فوراً ويُرمى account_disabled.
   */
  async function signInWithIdentifier(identifier: string, password: string) {
    const id = classifyLoginId(identifier)
    if (id.kind === 'invalid') throw new Error(LOGIN_ID_ERROR)

    if (id.kind === 'staff') {
      const tokens = await $fetch<{ accessToken: string, refreshToken: string }>('/api/auth/staff-login', {
        method: 'POST', body: { employeeNumber: id.id, password }
      })
      const { error } = await supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      if (error) throw new Error(LOGIN_REJECTION)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: studentEmailFromIdentity(id.id), password })
      if (error) throw new Error(LOGIN_REJECTION)
    }

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error(LOGIN_REJECTION)
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', auth.user.id).single()
    if (profile?.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('account_disabled')
    }
  }

  /** تسجيل الخروج ثم العودة لشاشة الدخول. */
  async function signOut() {
    await supabase.auth.signOut()
    await navigateTo('/login')
  }

  return { user, signInWithIdentifier, signOut }
}
