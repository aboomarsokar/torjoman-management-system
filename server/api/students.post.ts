import { requireAdminManager } from '../utils/supabaseAdmin'
import { requireWritableSession } from '../utils/impersonationGuard'
import { parseStudentInput } from '../utils/accountInput'
import { createStudentAccount } from '../utils/createStudentAccount'

/**
 * إنشاء حساب طالب (المدير الإداري فقط): حساب Auth ببريد الهوية + ملف بدور student + صفّ students مربوط.
 * كلمة المرور مؤقّتة يولّدها الخادم وتُعاد في الردّ مرّةً واحدة (لا تُسجَّل)، ويغيّرها الطالب عند أول دخول.
 * الخطواتُ والتراجعُ عند الفشل في `createStudentAccount` (يشاركه مسارُ قبول طلب المعلّم).
 */
export default defineEventHandler(async (event) => {
  const { admin, user, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const parsed = parseStudentInput(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return createStudentAccount(admin, parsed.value, user.id)
})
