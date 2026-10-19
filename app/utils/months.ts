/**
 * الشهور بالأرقام لا بالأسماء (قرار المستخدم): العرض `MM-YYYY` عبر `periodLabel` في reportWindow.
 * يُستورد تلقائياً (Nuxt auto-imports من app/utils).
 */

/** عناصر UiSelect للأشهر: التسمية `01`…`12` والقيمة 1–12. */
export const monthItems = Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1).padStart(2, '0'), value: i + 1 }))

/** مفتاح مصدر الحركة المالية المرحَّلة لشهرٍ (`salaries:2026-10`) — فريدٌ في القاعدة فلا تتكرّر الحركة. */
export const monthSourceKey = (source: 'salaries' | 'incentives', m: number, y: number) =>
  `${source}:${y}-${String(m).padStart(2, '0')}`
