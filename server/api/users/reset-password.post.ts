import { requireAdminManager } from '../../utils/supabaseAdmin'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { parseResetPasswordInput } from '../../utils/accountInput'
import { generateTempPassword } from '../../utils/tempPassword'

/**
 * إعادة تعيين كلمة مرور حسابٍ (موظفاً أو طالباً) — المدير الإداري فقط.
 * الترتيب مقصود: يُرفع علَم must_change_password **أولاً** ثم تُضبط كلمةٌ مؤقّتة يولّدها الخادم،
 * فلا تمرّ لحظةٌ تعمل فيها الكلمة الجديدة والعلَمُ نازل. وتُعاد الكلمة في الردّ مرّةً واحدة (لا تُسجَّل).
 * الجلسات القائمة تُبطَل في القاعدة: رفعُ `must_change_password` يُطلق المشغّل `profiles_revoke_sessions`
 * (← `private.revoke_sessions`)، و`current_user_role()` لا تعطي دوراً لرمزٍ حُذفت جلسته — فلا يستولي حاملُ
 * جلسةٍ قديمة (جهازٌ مسروق) على الحساب بوضع كلمةٍ جديدة (هجرة 20261020093000).
 * وللطالب يُعاد معه معلّمُ حلقته (`teacher`) لزرَّي «أرسلها للمعلّم» واتساب أو محادثةً (طلب المستخدم 2026-11-01).
 */
export default defineEventHandler(async (event) => {
  const { admin, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
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

  const { data: student } = await admin.from('students')
    .select('gender, halaqa:halaqa_id(teacher:profiles!halaqat_teacher_id_fkey(id, full_name, phone, whatsapp))')
    .eq('user_id', userId).maybeSingle()
  const teacher = (student?.halaqa as { teacher: { id: string, full_name: string, phone: string | null, whatsapp: string | null } | null } | null)?.teacher
  return {
    ok: true,
    temp_password: password,
    teacher: student && teacher
      ? { teacher_id: teacher.id, teacher_name: teacher.full_name, teacher_phone: teacher.whatsapp || teacher.phone || null, female: student.gender === 'female' }
      : null
  }
})
