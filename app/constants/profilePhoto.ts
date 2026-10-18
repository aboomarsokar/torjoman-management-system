/**
 * الصورة الشخصية — **اختياريّةٌ دائماً** لكلّ حساب (موظفون وطلاب)، وتظهر في الشاشات
 * الداخليّة وحدَها. منقولةٌ من الصحابة (`employeePhoto.ts`) ومكيَّفةٌ على `profiles`.
 *
 * قرار المستخدم 2026-10-18: **لا صور لقسم البنات** — أيُّ حساب `gender = 'female'` لا صورة له،
 * والقاعدةُ ترفض (القيد `profiles_photo_path_shape` وسياساتُ المستودع)، والعرضُ الحرفُ الأول دائماً.
 */

/** ضلعُ الصورة المخزَّنة — أكبرُ موضعٍ يعرضها 70 بكسلاً، فـ256 تكفي الشاشاتِ الكثيفة. */
export const PHOTO_SIDE = 256

/** حدُّ المستودع (256 كيلوبايت) — يطابق `file_size_limit` في الهجرة. */
export const PHOTO_MAX_BYTES = 256 * 1024

/** ما يقبله المستودع — والتصغيرُ يُخرج `webp` عادةً. */
export const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp'

/** المستودعُ الخاصّ — القراءةُ بروابطَ موقَّعة. */
export const PHOTO_BUCKET = 'profile-photos'

/** مدّةُ الرابط الموقَّع — ساعةٌ تكفي جلسةَ عمل، ومخبأُ الجلسة يجدّده. */
export const PHOTO_SIGNED_SECONDS = 3600

/** جودةُ ترميز webp عند التصغير. */
export const PHOTO_WEBP_QUALITY = 0.9

/**
 * اسمٌ ثابتٌ لا فريد — والقيدُ يفرض شكلَه `<profile_id>/photo.webp`، فالاستبدالُ `upsert`
 * ولا يتراكم يتيم.
 */
export function photoPath(profileId: string): string {
  return `${profileId}/photo.webp`
}

/** هل يجوز لهذا الحساب صورة؟ لا لأيّ حساب أنثى (والجنسُ الفارغ لا يمنع، كالقيد). */
export function canHavePhoto(gender: string | null | undefined): boolean {
  return gender !== 'female'
}

/**
 * المسارُ الذي يُعرض — `null` للأنثى مهما كان في الصفّ، فالعرضُ الحرفُ الأول دائماً
 * (حراسةٌ ثانية فوق قيد القاعدة).
 */
export function displayPhotoPath(row: { gender?: string | null, photo_path?: string | null } | null | undefined): string | null {
  if (!row || !canHavePhoto(row.gender)) return null
  return row.photo_path ?? null
}
