/**
 * ثوابتُ كشف حوافز الحلقة: تصنيفاتُ البنود وأدنى طولٍ للبيان.
 * الحدُّ نفسه في القاعدة (قيد `incentive_statement_items_description_len`) — غيّرهما معاً.
 */
export const STATEMENT_ITEM_CATEGORIES = ['جوائز', 'أنشطة', 'ضيافة', 'أخرى'] as const

/** أدنى طولٍ للبيان بعد حذف المسافات — «م» وحدها لا توثّق مصروفاً. */
export const MIN_ITEM_DESCRIPTION_LENGTH = 3
