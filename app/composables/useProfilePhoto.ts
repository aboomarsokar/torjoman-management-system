/**
 * رفعُ الصورة الشخصية وإزالتُها — لصاحب الحساب وللمدير الإداري. منقولٌ من الصحابة
 * (`useEmployeePhoto.ts`) ومكيَّفٌ على `profiles.photo_path`. سياساتُ المستودع وقيدُ
 * `profiles_photo_path_shape` هي الحَكَم لا هذا الملفّ (ولا صورة لحساب أنثى).
 *
 * التصغيرُ في المتصفّح قبل الرفع (اقتصاصٌ مركزيٌّ إلى 256×256)، والحدُّ مفروضٌ في المستودع أيضاً.
 * الخطواتُ في دالّتين نقيّتين على «واجهة» صغيرة كي تُختبر بلا Supabase.
 */
import type { Database } from '~/types/database.types'
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_SIDE, photoPath } from '~/constants/profilePhoto'
import { shrinkToSquare } from '~/utils/imageSquare'

/** ما تحتاجه خطواتُ الرفع والإزالة من المستودع وجدول profiles. */
export interface PhotoBackend {
  /** رفعٌ باستبدال (`upsert`) — الاسمُ ثابت. */
  uploadObject: (path: string, blob: Blob) => Promise<{ error: unknown }>
  /** حذفُ الكائن — فشلُه لا يُفشل الإزالة. */
  removeObject: (path: string) => Promise<unknown>
  /** يكتب المسار (أو null) في صفّ الحساب ويُرجع الصفوفَ المتأثّرة. */
  setPhotoPath: (profileId: string, path: string | null) => Promise<{ data: { id: string }[] | null, error: unknown }>
}

export const PHOTO_TOO_LARGE = 'الصورة كبيرة حتى بعد التصغير. جرّب صورة أوضح وأبسط.'
export const PHOTO_SAVE_DENIED = 'تعذّر حفظ الصورة — لا تملك صلاحية تعديل هذا الملف.'
export const PHOTO_REMOVE_DENIED = 'تعذّر إزالة الصورة — لا تملك صلاحية تعديل هذا الملف.'

/**
 * يصغّر ويرفع ثم يثبّت المسار في الصفّ.
 * الصفُّ يُحدَّث **بعد** الرفع: لو سبق ثم فشل الرفع لأشار الصفُّ إلى ملفٍّ لا وجود له.
 * و«صفر صفوف» رفضٌ صامتٌ من RLS فيُرمى بالعربية.
 */
export async function uploadProfilePhoto(
  backend: PhotoBackend,
  profileId: string,
  file: File,
  shrink: (file: File, side: number) => Promise<Blob> = shrinkToSquare
): Promise<string> {
  const shrunk = await shrink(file, PHOTO_SIDE)
  // فحصٌ بعد التصغير لا قبله: الحدُّ على ما يُرفع فعلاً.
  if (shrunk.size > PHOTO_MAX_BYTES) throw new Error(PHOTO_TOO_LARGE)

  const path = photoPath(profileId)
  const { error: uploadError } = await backend.uploadObject(path, shrunk)
  if (uploadError) throw uploadError

  const { data, error } = await backend.setPhotoPath(profileId, path)
  if (error) throw error
  if (!data || data.length === 0) throw new Error(PHOTO_SAVE_DENIED)
  return path
}

/**
 * يُفرِّغ العمودَ أوّلاً ثم يحذف الملفّ — العكسُ يترك الصفَّ يُشير إلى ملفٍّ محذوف.
 * وفشلُ حذف الملفّ لا يُفشل الإزالة: اختفت من الشاشات، واليتيمُ أهون.
 */
export async function removeProfilePhoto(backend: PhotoBackend, profileId: string): Promise<void> {
  const { data, error } = await backend.setPhotoPath(profileId, null)
  if (error) throw error
  if (!data || data.length === 0) throw new Error(PHOTO_REMOVE_DENIED)

  try {
    await backend.removeObject(photoPath(profileId))
  } catch {
    // يتيمٌ في المستودع أهونُ من إزالةٍ فاشلة.
  }
}

export function useProfilePhoto() {
  const client = useSupabaseClient<Database>()
  const isSaving = ref(false)

  const backend: PhotoBackend = {
    // النوعُ نوعُ ما خرج لا ما طُلب: سفاري قد يُخرج PNG من toBlob('image/webp').
    uploadObject: (path, blob) => client.storage.from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: true }),
    removeObject: path => client.storage.from(PHOTO_BUCKET).remove([path]),
    setPhotoPath: async (profileId, path) => await client.from('profiles')
      .update({ photo_path: path })
      .eq('id', profileId)
      .select('id')
  }

  async function withSaving<T>(task: () => Promise<T>): Promise<T> {
    isSaving.value = true
    try {
      return await task()
    } finally {
      isSaving.value = false
    }
  }

  /** يرفع الصورة ويثبّت مسارها في صفّ الحساب. */
  function upload(profileId: string, file: File): Promise<string> {
    return withSaving(() => uploadProfilePhoto(backend, profileId, file))
  }

  /** يُزيل الصورة. */
  function remove(profileId: string): Promise<void> {
    return withSaving(() => removeProfilePhoto(backend, profileId))
  }

  return { isSaving, upload, remove }
}
