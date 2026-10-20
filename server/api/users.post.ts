import { requireAdminManager } from '../utils/supabaseAdmin'
import { requireWritableSession } from '../utils/impersonationGuard'
import { authCreateError, parseStaffInput, staffProfileError } from '../utils/accountInput'
import { generateTempPassword } from '../utils/tempPassword'
import { staffEmailFromNumber } from '~/constants/accounts'

/**
 * إنشاء حساب موظف (المدير الإداري فقط).
 * يأخذ رقماً وظيفياً من التسلسل (claim_employee_number)، وينشئ حساب Auth ببريدٍ داخليّ مؤكَّد
 * وكلمة مرورٍ مؤقّتة يولّدها الخادم، ثم يكتب الملف (must_change_password=true).
 * ⚠️ الكلمة المؤقّتة تُعاد في الردّ مرّةً واحدة ولا تُسجَّل ولا تُحفظ.
 * ⚠️ الرقم يُستهلك حتى لو فشل الإنشاء لاحقاً — مقبول ولا يُعاد استعماله.
 * ⚠️ المدير الإداري والفني: نشطٌ واحد لكلٍّ منهما (حارسٌ/فهرسٌ في القاعدة يرفع 23505 ← 409).
 */
export default defineEventHandler(async (event) => {
  const { admin, user, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const parsed = parseStaffInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const { fullName, role, gender, phone } = parsed.value
  const password = generateTempPassword()

  const { data: employeeNumber, error: seqErr } = await admin.rpc('claim_employee_number')
  if (seqErr || !employeeNumber) throw createError({ statusCode: 500, statusMessage: 'تعذّر توليد الرقم الوظيفي.' })

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: staffEmailFromNumber(employeeNumber),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (authErr || !created.user) {
    const failure = authCreateError(authErr?.message, 'تعذّر إنشاء الحساب، حاول مرة أخرى.')
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.message })
  }

  const { error: profErr } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
    gender,
    employee_number: employeeNumber,
    phone,
    status: 'active',
    must_change_password: true,
    assigned_by: user.id
  })
  if (profErr) {
    // تراجُع: لا يبقى حساب Auth يتيماً بلا ملف
    await admin.auth.admin.deleteUser(created.user.id)
    const failure = staffProfileError(profErr, role)
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.message })
  }

  return { id: created.user.id, employee_number: employeeNumber, temp_password: password }
})
