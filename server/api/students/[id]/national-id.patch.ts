import { requireAdminManager } from '../../../utils/supabaseAdmin'
import { requireWritableSession } from '../../../utils/impersonationGuard'
import { authCreateError, DUPLICATE_IDENTITY_MESSAGE, parseNationalIdInput, parseRecordId, studentRowError } from '../../../utils/accountInput'
import { studentEmailFromIdentity } from '~/constants/accounts'

/**
 * تصحيح رقم هوية الطالب (المدير الإداري فقط) — الهوية معرّف الدخول، فيتغيّر معها بريد Auth المشتقّ منها.
 * الترتيب: فحص التكرار ← بريد Auth (مؤكَّد) ← صفّ students؛ وإن فشل الصفّ يُعاد البريد القديم كي لا يتباعدا.
 * لماذا خادميّ: التحديث المباشر كان يغيّر students.national_id وحده فيعجز الطالب عن الدخول بهويته المصحَّحة.
 */
export default defineEventHandler(async (event) => {
  const { admin, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const parsedId = parseRecordId(getRouterParam(event, 'id'))
  if (!parsedId.ok) throw createError({ statusCode: 400, statusMessage: parsedId.message })
  const parsed = parseNationalIdInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const studentId = parsedId.value
  const { nationalId } = parsed.value

  const { data: student, error: readErr } = await admin.from('students').select('id, user_id, national_id').eq('id', studentId).maybeSingle()
  if (readErr) throw createError({ statusCode: 500, statusMessage: 'تعذّرت قراءة سجلّ الطالب.' })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'الطالب غير موجود.' })
  if (student.national_id === nationalId) return { ok: true }

  const { data: taken } = await admin.from('students').select('id').eq('national_id', nationalId).neq('id', studentId).maybeSingle()
  if (taken) throw createError({ statusCode: 409, statusMessage: DUPLICATE_IDENTITY_MESSAGE })

  if (student.user_id) {
    const { error: authErr } = await admin.auth.admin.updateUserById(student.user_id, {
      email: studentEmailFromIdentity(nationalId),
      email_confirm: true
    })
    if (authErr) {
      const failure = authCreateError(authErr.message, DUPLICATE_IDENTITY_MESSAGE)
      throw createError({ statusCode: failure.statusCode, statusMessage: failure.statusCode === 409 ? failure.message : 'تعذّر تحديث معرّف دخول الطالب.' })
    }
  }

  const { error: rowErr } = await admin.from('students').update({ national_id: nationalId }).eq('id', studentId)
  if (rowErr) {
    if (student.user_id && student.national_id) {
      await admin.auth.admin.updateUserById(student.user_id, { email: studentEmailFromIdentity(student.national_id), email_confirm: true })
    }
    const failure = studentRowError(rowErr)
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.statusCode === 409 ? failure.message : 'تعذّر حفظ رقم الهوية.' })
  }

  return { ok: true }
})
