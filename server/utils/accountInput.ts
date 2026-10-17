/**
 * التحقّق من مدخلات إنشاء الحسابات وترجمة أخطاء القاعدة — دوالّ نقيّة بلا Nuxt ولا قاعدة (قابلة للاختبار).
 * ⚠️ كل حقل يُفحص نوعُه قبل `.trim()`: جسمٌ بحقلٍ غير نصّيّ يعود 400 لا 500.
 */
import { STAFF_ROLES, type Role } from '~/constants/roles'
import { IDENTITY_ERROR, isValidIdentity, normalizeDigits } from '~/constants/identity'

export type AccountGender = 'male' | 'female'

export const MIN_PASSWORD_LENGTH = 8
export const PASSWORD_ERROR = `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`

/** رمز Postgres لانتهاك التفرّد — يرفعه فهرس الفريد والحارسُ على المدير الإداري. */
export const UNIQUE_VIOLATION = '23505'

export type Parsed<T> = { ok: true, value: T } | { ok: false, message: string }

/** النصّ مقصوصاً إن كان نصّاً، وإلا فارغ (فيسقط في فحص «مطلوب»). */
export function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** نصّ اختياريّ: فارغ أو غير نصّي ← null. */
export function optionalString(value: unknown): string | null {
  return trimmedString(value) || null
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {}
}

function isGender(value: unknown): value is AccountGender {
  return value === 'male' || value === 'female'
}

function passwordOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface StaffInput {
  fullName: string
  role: Role
  gender: AccountGender
  phone: string | null
  password: string
}

export function parseStaffInput(body: unknown): Parsed<StaffInput> {
  const raw = asRecord(body)
  const fullName = trimmedString(raw.full_name)
  const password = passwordOf(raw.password)
  if (!fullName) return { ok: false, message: 'الاسم الكامل مطلوب.' }
  const role = raw.role
  if (typeof role !== 'string' || !STAFF_ROLES.includes(role as Role)) return { ok: false, message: 'الدور غير صالح.' }
  if (!isGender(raw.gender)) return { ok: false, message: 'الجنس مطلوب.' }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, message: PASSWORD_ERROR }
  return { ok: true, value: { fullName, role: role as Role, gender: raw.gender, phone: optionalString(raw.phone), password } }
}

export interface StudentInput {
  fullName: string
  gender: AccountGender
  nationalId: string
  halaqaId: string | null
  birthDate: string | null
  guardianPhone: string | null
  password: string
}

export function parseStudentInput(body: unknown): Parsed<StudentInput> {
  const raw = asRecord(body)
  const fullName = trimmedString(raw.full_name)
  const nationalId = normalizeDigits(trimmedString(raw.national_id))
  const password = passwordOf(raw.password)
  if (!fullName) return { ok: false, message: 'اسم الطالب مطلوب.' }
  if (!isGender(raw.gender)) return { ok: false, message: 'الجنس مطلوب.' }
  if (!isValidIdentity(nationalId)) return { ok: false, message: IDENTITY_ERROR }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, message: PASSWORD_ERROR }
  return {
    ok: true,
    value: {
      fullName,
      gender: raw.gender,
      nationalId,
      halaqaId: optionalString(raw.halaqa_id),
      birthDate: optionalString(raw.birth_date),
      guardianPhone: optionalString(raw.guardian_phone),
      password
    }
  }
}

export interface ResetPasswordInput {
  userId: string
  password: string
}

export function parseResetPasswordInput(body: unknown): Parsed<ResetPasswordInput> {
  const raw = asRecord(body)
  const userId = trimmedString(raw.user_id)
  const password = passwordOf(raw.password)
  if (!userId) return { ok: false, message: 'معرّف المستخدم مطلوب.' }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, message: PASSWORD_ERROR }
  return { ok: true, value: { userId, password } }
}

/**
 * يترجم خطأ كتابة ملف الموظف إلى حالةٍ ورسالةٍ عربية.
 * التفرّد على دورٍ فردٍ (إداري/فني) يعني أن هناك شاغلاً نشطاً بالفعل ← 409؛ وما عداه 500.
 */
export function staffProfileError(error: { code?: string, message: string }, role: Role): { statusCode: number, message: string } {
  if (error.code === UNIQUE_VIOLATION) {
    if (role === 'admin_manager') return { statusCode: 409, message: 'يوجد مدير إداري نشط بالفعل.' }
    if (role === 'technical_manager') return { statusCode: 409, message: 'يوجد مدير فني نشط بالفعل.' }
    return { statusCode: 409, message: 'تعارض في بيانات الحساب، حاول مرة أخرى.' }
  }
  return { statusCode: 500, message: `تعذّر حفظ الملف: ${error.message}` }
}

export const DUPLICATE_IDENTITY_MESSAGE = 'رقم الهوية مسجّل لطالب آخر.'

/** يترجم خطأ إدراج صفّ الطالب: تفرّد الهوية ← 409 بالعربية، وما عداه 400 (لا نصّ Postgres الخام للتكرار). */
export function studentRowError(error: { code?: string, message: string }): { statusCode: number, message: string } {
  if (error.code === UNIQUE_VIOLATION) return { statusCode: 409, message: DUPLICATE_IDENTITY_MESSAGE }
  return { statusCode: 400, message: `تعذّر حفظ الطالب: ${error.message}` }
}

/** يترجم خطأ إنشاء حساب Auth: التكرار يعني أن المعرّف مسجّل لحسابٍ آخر. */
export function authCreateError(message: string | undefined, duplicateMessage: string): { statusCode: number, message: string } {
  if (/already|exists|registered/i.test(message ?? '')) return { statusCode: 409, message: duplicateMessage }
  return { statusCode: 400, message: message || 'تعذّر إنشاء الحساب.' }
}
