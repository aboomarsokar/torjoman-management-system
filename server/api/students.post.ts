import { requireAdminManager } from '../utils/supabaseAdmin'
import { authCreateError, parseStudentInput } from '../utils/accountInput'
import { studentEmailFromIdentity } from '~/constants/accounts'

/**
 * إنشاء حساب طالب (المدير الإداري فقط): حساب Auth ببريد الهوية + ملف بدور student + صفّ students مربوط.
 * أي فشلٍ بعد إنشاء حساب Auth يتراجع عمّا سبق كي لا تبقى بقايا.
 */
export default defineEventHandler(async (event) => {
  const { admin, user } = await requireAdminManager(event)
  const parsed = parseStudentInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { fullName, gender, nationalId, halaqaId, birthDate, guardianPhone, password } = parsed.value

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: studentEmailFromIdentity(nationalId),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (authErr || !created.user) {
    const failure = authCreateError(authErr?.message, 'رقم الهوية مسجّل لطالب آخر.')
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.message })
  }
  const uid = created.user.id

  const { error: profErr } = await admin.from('profiles').insert({
    id: uid, full_name: fullName, role: 'student', gender, status: 'active', must_change_password: true, assigned_by: user.id
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(uid)
    throw createError({ statusCode: 500, statusMessage: `تعذّر حفظ الملف: ${profErr.message}` })
  }

  const { data: student, error: stuErr } = await admin.from('students').insert({
    full_name: fullName,
    gender,
    national_id: nationalId,
    user_id: uid,
    halaqa_id: halaqaId,
    birth_date: birthDate,
    guardian_phone: guardianPhone,
    created_by: user.id,
    status: 'active'
  }).select('id').single()
  if (stuErr || !student) {
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
    throw createError({ statusCode: 400, statusMessage: `تعذّر حفظ الطالب: ${stuErr?.message ?? ''}` })
  }

  return { id: student.id, user_id: uid }
})
