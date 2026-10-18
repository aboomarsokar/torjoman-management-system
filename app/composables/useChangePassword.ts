/**
 * تغيير صاحب الحساب كلمةَ مروره — مشتركٌ بين نافذة الملف/«صفحتي» وشاشة «غيّر كلمة مرورك أولاً».
 * الخطوتان: كلمة Auth الجديدة ثم إنزال علَم must_change_password (حارس القاعدة يسمح لصاحبه بإنزاله فقط).
 * ⚠️ فشلُ إنزال العلَم خطأٌ ظاهر لا يُبتلع: وإلا بقي صاحبه محبوساً خلف شاشة التغيير والرسالةُ تقول «تمّ».
 */
import type { Database } from '~/types/database.types'
import { PASSWORD_MIN_LENGTH } from '~/constants/auth'

export const PASSWORD_TOO_SHORT = `كلمة المرور ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`
export const PASSWORD_MISMATCH = 'الكلمتان غير متطابقتين.'
export const PASSWORD_SAME_AS_CURRENT = 'اختر كلمة مرورٍ مختلفة عن الحالية.'
export const FLAG_CLEAR_FAILED = 'تغيّرت كلمة المرور لكن تعذّر تحديث حالة حسابك — أعد المحاولة بكلمةٍ أخرى أو تواصل مع المدير الإداري.'

/** فحص المدخلين قبل أي طلب: الطول والتطابق. null = صالح. */
export function passwordChangeError(next: string, confirm: string): string | null {
  if (next.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT
  if (next !== confirm) return PASSWORD_MISMATCH
  return null
}

/** خطوات التغيير محقونةً — كي تُختبر بلا Supabase. */
export interface PasswordChangeSteps {
  updatePassword: (next: string) => Promise<{ error: { code?: string, message: string } | null }>
  clearFlag: () => Promise<{ error: unknown, rows: number }>
  reloadProfile: () => Promise<unknown>
}

/** يغيّر الكلمة ثم ينزل العلَم ثم يعيد قراءة الملف — ويرمي رسالةً عربية عند أيّ تعثّر. */
export async function applyPasswordChange(next: string, steps: PasswordChangeSteps): Promise<void> {
  const { error } = await steps.updatePassword(next)
  if (error) {
    if (error.code === 'same_password') throw new Error(PASSWORD_SAME_AS_CURRENT)
    throw error
  }
  const flag = await steps.clearFlag()
  if (flag.error || flag.rows === 0) throw new Error(FLAG_CLEAR_FAILED)
  await steps.reloadProfile()
}

export function useChangePassword() {
  const supabase = useSupabaseClient<Database>()
  const { fetchProfile } = useProfile()

  async function changeOwnPassword(profileId: string, next: string): Promise<void> {
    await applyPasswordChange(next, {
      updatePassword: password => supabase.auth.updateUser({ password }),
      clearFlag: async () => {
        const { data, error } = await supabase.from('profiles').update({ must_change_password: false }).eq('id', profileId).select('id')
        return { error, rows: data?.length ?? 0 }
      },
      reloadProfile: () => fetchProfile()
    })
  }

  return { changeOwnPassword }
}
