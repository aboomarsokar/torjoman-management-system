/**
 * المؤهل التعليمي: قائمة ثابتة بدل الكتابة اليدوية (طلب المستخدم 2026-10-19).
 */
export const EDUCATION_LEVELS = ['دكتوراة', 'ماجستير', 'بكالوريوس', 'دبلوم', 'ثانوية', 'أخرى'] as const

/** عناصر القائمة — والقيمة القديمة المكتوبة يدوياً تبقى خياراً كي لا تُمسح بصمت عند الحفظ. */
export function educationItems(current?: string | null) {
  const items = EDUCATION_LEVELS.map(v => ({ label: v as string, value: v as string }))
  return current && !(EDUCATION_LEVELS as readonly string[]).includes(current)
    ? [...items, { label: current, value: current }]
    : items
}
