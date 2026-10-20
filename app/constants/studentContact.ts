/**
 * حدودُ «بيانات التواصل» التي يعدّلها الطالب بنفسه — مطابقةٌ لفحوص `update_my_contact()` في القاعدة
 * (هجرة 20261020100838). القاعدةُ هي الحَكَم؛ هذه لتُعرض الرسالةُ قبل الإرسال.
 */

/** أقلّ عددٍ من أرقام الجوال وأكثره (و`+` اختيارية في أوّله). */
export const CONTACT_PHONE_MIN_DIGITS = 7
export const CONTACT_PHONE_MAX_DIGITS = 15

/** أطولُ نصٍّ للسكن ولأقرب مسجد. */
export const CONTACT_TEXT_MAX = 120

/** أطولُ بريد (حدُّ المعيار). */
export const CONTACT_EMAIL_MAX = 254
