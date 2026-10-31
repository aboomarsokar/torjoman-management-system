/**
 * مكتبةُ المشروع وصورُ الهويات (طلب المستخدم 2026-10-31) — الحدودُ والأنواع تطابق قيودَ القاعدة والمستودعين
 * (`library` و`id-cards`).
 */
export const LIBRARY_BUCKET = 'library'
export const ID_CARD_BUCKET = 'id-cards'

/** 50 م.ب لكلّ ملفّ في المكتبة (قيدُ المستودع). */
export const LIBRARY_MAX_BYTES = 50 * 1024 * 1024
/** 5 م.ب لصورة الهوية بعد التصغير (قيدُ المستودع). */
export const ID_CARD_MAX_BYTES = 5 * 1024 * 1024
/** أطولُ ضلعٍ لصورة الهوية بعد التصغير — يكفي لقراءة الأرقام بوضوح. */
export const ID_CARD_MAX_SIDE = 1600
/** جودةُ JPEG لصورة الهوية بعد التصغير. */
export const ID_CARD_JPEG_QUALITY = 0.85
/** صلاحيةُ رابط فتح الملفّ أو تنزيله بالثواني — قصيرةٌ لأنّ الرابط يُفتح فوراً. */
export const SIGNED_URL_SECONDS = 60

/** الامتداداتُ المقبولة في المكتبة ونوعُ كلٍّ منها. */
export const LIBRARY_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}
export const LIBRARY_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx'

export type LibraryAudience = 'all' | 'staff'
export const AUDIENCE_LABEL: Record<LibraryAudience, string> = { all: 'الجميع', staff: 'الكادر وحده' }
/** تصنيفاتٌ مقترحة — والمديرُ يكتب غيرها. */
export const LIBRARY_CATEGORIES = ['المقرّرات', 'الأدلّة والتعليمات', 'النماذج', 'الخطط', 'عام'] as const
export const DEFAULT_CATEGORY = 'عام'
export const MAX_LIBRARY_TITLE = 150
export const MAX_LIBRARY_DESCRIPTION = 500
export const MAX_LIBRARY_CATEGORY = 60
