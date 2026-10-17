import { requireAdminManager } from '../../utils/supabaseAdmin'
import { parseResetPasswordInput } from '../../utils/accountInput'

/**
 * إعادة تعيين كلمة مرور حسابٍ (طارئة) — المدير الإداري فقط.
 * يتحقّق أن الهدف موجود، ثم يضبط كلمة جديدة بصلاحية الخدمة ويرفع علَم must_change_password ليغيّرها صاحبها.
 */
export default defineEventHandler(async (event) => {
  const { admin } = await requireAdminManager(event)
  const parsed = parseResetPasswordInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { userId, password } = parsed.value

  const { data: target } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!target) throw createError({ statusCode: 404, statusMessage: 'المستخدم غير موجود.' })

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, { password })
  if (authErr) throw createError({ statusCode: 400, statusMessage: authErr.message || 'تعذّرت إعادة التعيين.' })

  const { error: profErr } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
  if (profErr) throw createError({ statusCode: 500, statusMessage: profErr.message })

  return { ok: true }
})
