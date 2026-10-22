/**
 * قوائمُ ثابتةٌ لحقولٍ كانت تُكتب يدوياً في ملفّ العامل (طلب المستخدم 2026-10-22).
 */
export const TAJWEED_LEVELS = ['تأهيلية', 'عليا', 'تأهيل سند', 'سند'] as const
export const RESIDENCE_AREAS = ['شمال غزة', 'غزة', 'النصيرات', 'الوسطى', 'دير البلح', 'خانيونس'] as const

/** عناصرُ القائمة — والقيمةُ القديمة المكتوبة يدوياً تبقى خياراً كي لا تُمسح بصمت عند الحفظ. */
export function choiceItems(list: readonly string[], current?: string | null) {
  const items = list.map(v => ({ label: v, value: v }))
  return current && !list.includes(current) ? [...items, { label: current, value: current }] : items
}
