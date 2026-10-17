/**
 * أرقام الهوية والرقم الوظيفي — مشتركة بين الواجهة والخادم (منقولة من الصحابة).
 * التطبيع قبل أي تحقّق وقبل الحفظ: لوحة المفاتيح العربية تكتب محارف غير اللاتينية.
 */

/** رقم الهوية الفلسطينية: تسع خانات. */
export const IDENTITY_LENGTH = 9

/**
 * الرقم الوظيفي: أربع خانات تبدأ من 1001 (قرار المستخدم 2026-10-17).
 * ⚠️ نهائيّ: بعد أن يحفظ الناس أرقامهم لا يُغيَّر الطول.
 */
export const EMPLOYEE_NUMBER_LENGTH = 4
export const FIRST_EMPLOYEE_NUMBER = 1001

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0)
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660
    return String(code - base)
  })
}

/** الأرقام وحدها بعد التطبيع — يتسامح مع المسافات والشُّرَط. */
export function digitsOnly(value: string): string {
  return normalizeDigits(value).replace(/\D/g, '')
}

export function isValidIdentity(value: string): boolean {
  return new RegExp(`^\\d{${IDENTITY_LENGTH}}$`).test(normalizeDigits(value.trim()))
}

export function isValidEmployeeNumber(value: string): boolean {
  return new RegExp(`^\\d{${EMPLOYEE_NUMBER_LENGTH}}$`).test(normalizeDigits(value.trim()))
}

export type LoginId = { kind: 'staff' | 'student', id: string } | { kind: 'invalid' }

/** شاشة الدخول حقلٌ واحد: الطول يفرّق الموظف (4) عن الطالب (9). */
export function classifyLoginId(value: string): LoginId {
  const raw = normalizeDigits(value).replace(/[\s-]/g, '')
  if (!/^\d+$/.test(raw)) return { kind: 'invalid' }
  if (raw.length === EMPLOYEE_NUMBER_LENGTH) return { kind: 'staff', id: raw }
  if (raw.length === IDENTITY_LENGTH) return { kind: 'student', id: raw }
  return { kind: 'invalid' }
}

export const IDENTITY_ERROR = `رقم الهوية ${IDENTITY_LENGTH} أرقام بالضبط`
export const LOGIN_ID_ERROR = 'أدخل رقمك الوظيفي (4 أرقام) أو رقم هويتك (9 أرقام).'
