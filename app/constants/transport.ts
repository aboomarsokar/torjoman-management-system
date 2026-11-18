/**
 * ثوابتُ كشف المواصلات — الأدوارُ تطابق `private.can_log_transport()` (يحرسها اختبار).
 * ⚠️ **والمديرةُ الإدارية للقسم النسائي منذ 2026-11-18** (طلب المستخدم: «كشف مواصلات لمشرفة القسم النسائي شيماء عواد»).
 */
export const TRANSPORT_LOGGER_ROLES = ['field_supervisor', 'examiner', 'women_admin'] as const
export const TRANSPORT_DESCRIPTION_MAX = 200
/** الغرضُ من الرحلة — إلزاميٌّ للجديدة (2026-11-03، قيدُ `transport_trips_purpose_len`). */
export const TRANSPORT_PURPOSE_MAX = 200
export const TRANSPORT_NOTES_MAX = 500
export const TRANSPORT_AMOUNT_MAX = 10000
