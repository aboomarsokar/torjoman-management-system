import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { authCreateError, DUPLICATE_IDENTITY_MESSAGE, studentHalaqaError, studentRowError } from './accountInput'
import type { StudentInput } from './accountInput'
import { generateTempPassword } from './tempPassword'
import { studentEmailFromIdentity } from '~/constants/accounts'

/** حقولٌ اختياريّةٌ تُكتب في صفّ الطالب بعد إنشائه (من طلب المعلّم مثلاً). */
export interface StudentExtras {
  tajweed_level?: string | null
  residence?: string | null
  nearest_mosque?: string | null
}

/**
 * إنشاء حساب طالب بعميل الخدمة: حساب Auth ببريد الهوية + ملف بدور student + صفّ students مربوط.
 * كلمة المرور مؤقّتة يولّدها الخادم وتُعاد مرّةً واحدة (لا تُسجَّل). أي فشلٍ بعد إنشاء حساب Auth يتراجع عمّا سبق.
 * يستدعيه `POST /api/students` و`POST /api/student-requests/:id/approve` — والمستدعي يتحقّق من المدير الإداري
 * ومن جلسةٍ كاتبة قبله.
 */
export async function createStudentAccount(
  admin: SupabaseClient<Database>, input: StudentInput, createdBy: string, extras: StudentExtras = {}
): Promise<{ id: string, user_id: string, temp_password: string }> {
  const { fullName, gender, nationalId, halaqaId, birthDate, guardianPhone } = input
  const password = generateTempPassword()

  // فحصٌ مسبق: صفّ طالبٍ قديمٌ بلا حساب يحمل الهوية نفسها — فلا يُنشأ حساب Auth ثم يُحذف
  const { data: existing } = await admin.from('students').select('id').eq('national_id', nationalId).maybeSingle()
  if (existing) throw createError({ statusCode: 409, statusMessage: DUPLICATE_IDENTITY_MESSAGE })

  // عميل الخدمة لا يمرّ بحارس guard_student_assignment — فيُفحص وجود الحلقة وتطابق الجنس هنا قبل إنشاء الحساب
  if (halaqaId) {
    const { data: halaqa } = await admin.from('halaqat').select('gender').eq('id', halaqaId).maybeSingle()
    const halaqaError = studentHalaqaError(gender, halaqa)
    if (halaqaError) throw createError({ statusCode: 400, statusMessage: halaqaError })
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: studentEmailFromIdentity(nationalId),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })
  if (authErr || !created.user) {
    const failure = authCreateError(authErr?.message, DUPLICATE_IDENTITY_MESSAGE)
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.message })
  }
  const uid = created.user.id

  const { error: profErr } = await admin.from('profiles').insert({
    id: uid, full_name: fullName, role: 'student', gender, status: 'active', must_change_password: true, assigned_by: createdBy
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
    tajweed_level: extras.tajweed_level ?? null,
    residence: extras.residence ?? null,
    nearest_mosque: extras.nearest_mosque ?? null,
    created_by: createdBy,
    status: 'active'
  }).select('id').single()
  if (stuErr || !student) {
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
    const failure = studentRowError(stuErr ?? { message: '' })
    throw createError({ statusCode: failure.statusCode, statusMessage: failure.message })
  }

  return { id: student.id, user_id: uid, temp_password: password }
}
