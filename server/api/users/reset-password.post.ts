import { requireAdminManager } from '../../utils/supabaseAdmin'
import { parseResetPasswordInput } from '../../utils/accountInput'
import { generateTempPassword } from '../../utils/tempPassword'

/**
 * إعادة تعيين كلمة مرور حسابٍ (موظفاً أو طالباً) — المدير الإداري فقط.
 * الترتيب مقصود: يُرفع علَم must_change_password **أولاً** ثم تُضبط كلمةٌ مؤقّتة يولّدها الخادم،
 * فلا تمرّ لحظةٌ تعمل فيها الكلمة الجديدة والعلَمُ نازل. وتُعاد الكلمة في الردّ مرّةً واحدة (لا تُسجَّل).
 * الجلسات القائمة تُبطَل في القاعدة: رفعُ `must_change_password` يُطلق المشغّل `profiles_revoke_sessions`
 * (← `private.revoke_sessions`)، و`current_user_role()` لا تعطي دوراً لرمزٍ حُذفت جلسته — فلا يستولي حاملُ
 * جلسةٍ قديمة (جهازٌ مسروق) على الحساب بوضع كلمةٍ جديدة (هجرة 20261020093000).
 */
export default defineEventHandler(async (event) => {
  const { admin } = await requireAdminManager(event)
  const parsed = parseResetPasswordInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { userId } = parsed.value

  const { data: target } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!target) throw createError({ statusCode: 404, statusMessage: 'المستخدم غير موجود.' })

  const { error: profErr } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
  if (profErr) throw createError({ statusCode: 500, statusMessage: 'تعذّر تحديث حالة الحساب، لم تُغيَّر كلمة المرور.' })

  const password = generateTempPassword()
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, { password })
  if (authErr) throw createError({ statusCode: 400, statusMessage: 'تعذّرت إعادة التعيين، حاول مرة أخرى.' })

  return { ok: true, temp_password: password }
})
