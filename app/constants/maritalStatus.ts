/**
 * الحالة الاجتماعية: قائمة ثابتة بدل الكتابة اليدوية (طلب المستخدم 2026-10-19).
 * تُخزَّن بالصيغة المذكّرة (قيمةٌ واحدة للفرز والإحصاء) وتُعرض بجنس صاحب الملف.
 */
export const MARITAL_STATUSES = ['متزوج', 'أعزب', 'أرمل', 'مطلق'] as const
export type MaritalStatus = typeof MARITAL_STATUSES[number]

const FEMININE: Record<MaritalStatus, string> = { متزوج: 'متزوجة', أعزب: 'عزباء', أرمل: 'أرملة', مطلق: 'مطلقة' }

const isKnown = (v: string): v is MaritalStatus => (MARITAL_STATUSES as readonly string[]).includes(v)

/** العرض بجنس صاحب الملف؛ والقيمة القديمة المكتوبة يدوياً تُعرض كما هي. */
export function maritalLabel(value: string | null | undefined, gender: 'male' | 'female' | null | undefined): string {
  if (!value) return ''
  return gender === 'female' && isKnown(value) ? FEMININE[value] : value
}

/** عناصر القائمة بجنس صاحب الملف — والقيمة القديمة غير المعروفة تبقى خياراً كي لا تُمسح بصمت عند الحفظ. */
export function maritalItems(gender: 'male' | 'female' | null | undefined, current?: string | null) {
  const items = MARITAL_STATUSES.map(v => ({ label: maritalLabel(v, gender), value: v as string }))
  return current && !isKnown(current) ? [...items, { label: current, value: current }] : items
}
