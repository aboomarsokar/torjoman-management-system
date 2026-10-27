/**
 * عمليات حسابات المدير الإداري عبر مسارات الخادم (service_role خادميّاً فقط):
 * إنشاء موظف/طالب، وإعادة تعيين كلمة المرور، وحذف الطالب مع حسابه، وتصحيح هويته (معرّف دخوله).
 * كلمة المرور المؤقّتة يولّدها الخادم ويعيدها مرّةً واحدة — تُعرض في AccountCredentialsModal ولا تُحفظ.
 */

/** ما تعرضه نافذة بيانات الدخول بعد الإنشاء أو إعادة التعيين. */
export interface AccountCredentials {
  title: string
  message: string
  loginLabel: string
  loginId: string
  password: string
  /** زرٌّ اختياريّ يفتح واتساب برسالةٍ جاهزة (بياناتُ الطالب لمعلّمه — 2026-10-27). */
  whatsapp?: { label: string, url: string } | null
}

export type CredentialsEvent = 'created' | 'reset'

export interface StaffCreateBody {
  full_name: string
  role: string
  gender: 'male' | 'female'
  phone?: string
}

export interface StudentCreateBody {
  full_name: string
  gender: 'male' | 'female'
  national_id: string
  halaqa_id?: string
  birth_date?: string
  guardian_phone?: string
}

/** بيانات دخول موظف: الرقم الوظيفي + الكلمة المؤقّتة. */
export function staffCredentials(name: string, employeeNumber: string, password: string, kind: CredentialsEvent): AccountCredentials {
  return {
    title: kind === 'created' ? 'تم إنشاء الحساب' : 'أُعيد تعيين كلمة المرور',
    message: kind === 'created'
      ? `أُنشئ حساب «${name}». يدخل بهذا الرقم الوظيفي وكلمة المرور المؤقّتة:`
      : `كلمة مرور «${name}» الجديدة مؤقّتة — يدخل بها برقمه الوظيفي:`,
    loginLabel: 'الرقم الوظيفي',
    loginId: employeeNumber,
    password
  }
}

/** بيانات دخول طالب: رقم الهوية + الكلمة المؤقّتة. */
export function studentCredentials(name: string, nationalId: string, password: string, kind: CredentialsEvent): AccountCredentials {
  return {
    title: kind === 'created' ? 'تمت إضافة الطالب' : 'أُعيد تعيين كلمة المرور',
    message: kind === 'created'
      ? `أُنشئ حساب «${name}». يدخل برقم هويته وكلمة المرور المؤقّتة:`
      : `كلمة مرور «${name}» الجديدة مؤقّتة — يدخل بها برقم هويته:`,
    loginLabel: 'رقم الهوية',
    loginId: nationalId,
    password
  }
}

export function useAccountAdmin() {
  function createStaff(body: StaffCreateBody) {
    return $fetch<{ id: string, employee_number: string, temp_password: string }>('/api/users', { method: 'POST', body })
  }

  function createStudent(body: StudentCreateBody) {
    return $fetch<{ id: string, user_id: string, temp_password: string }>('/api/students', { method: 'POST', body })
  }

  /** يعيد الكلمة المؤقّتة الجديدة (ويرفع الخادم علَم التغيير قبلها). */
  async function resetPassword(userId: string): Promise<string> {
    const res = await $fetch<{ ok: boolean, temp_password: string }>('/api/users/reset-password', { method: 'POST', body: { user_id: userId } })
    return res.temp_password
  }

  /** حذف الطالب مع ملف حسابه وحساب Auth — فلا يبقى دخولٌ لطالبٍ محذوف ويمكن إعادة إنشائه بهويته. */
  function deleteStudent(studentId: string) {
    return $fetch<{ ok: boolean }>(`/api/students/${studentId}`, { method: 'DELETE' })
  }

  /** تصحيح رقم الهوية: صفّ الطالب وبريد الدخول المشتقّ منه معاً. */
  function changeStudentNationalId(studentId: string, nationalId: string) {
    return $fetch<{ ok: boolean }>(`/api/students/${studentId}/national-id`, { method: 'PATCH', body: { national_id: nationalId } })
  }

  return { createStaff, createStudent, resetPassword, deleteStudent, changeStudentNationalId }
}
