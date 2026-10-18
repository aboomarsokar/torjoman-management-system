/**
 * روابطُ الصور الشخصية الموقَّعة — **طلبٌ واحدٌ لكلّ شاشة** ومخبأٌ للجلسة.
 * منقولٌ من الصحابة (`useEmployeePhotoUrls.ts`) على المستودع `profile-photos`.
 *
 * في `useState` لا في التخزين الدائم: الرابطُ الموقَّع ينتهي بعد ساعة ولا معنى لحفظه.
 * وفشلُ التوقيع صامت: سياسةٌ ترفض أو شبكةٌ تنقطع **تُبقي الحرفَ الأول** — لا رسالةَ خطأٍ
 * على صورةٍ اختياريّة.
 */
import type { Database } from '~/types/database.types'
import { PHOTO_BUCKET, PHOTO_SIGNED_SECONDS } from '~/constants/profilePhoto'
import { pathsToSign, storeSigned, urlFrom, withoutPath, type SignedCache } from '~/utils/signedUrlCache'

/** مفتاحُ المخبأ — مُصدَّرٌ لا حرفيّ: `useAuth().signOut()` يمحوه عند الخروج. */
export const PROFILE_PHOTOS_SIGNED_KEY = 'profile-photos:signed'

/** نتيجةُ توقيع دفعةٍ من المسارات — بشكل ما يردّه `createSignedUrls`. */
export interface SignBatchResult {
  data: { path: string | null, signedUrl: string | null, error: string | null }[] | null
  error: unknown
}

/**
 * يوقّع ما ينقص من القائمة دفعةً واحدة ويُرجع المخبأ الجديد (أو القديمَ نفسَه إن لم يلزم
 * شيء أو فشل التوقيع). نقيٌّ إلا من `sign` — فيُختبر بلا Supabase.
 */
export async function signMissing(
  sign: (paths: string[]) => Promise<SignBatchResult>,
  cache: SignedCache,
  paths: (string | null | undefined)[],
  now: number
): Promise<SignedCache> {
  const need = pathsToSign(cache, paths, now)
  if (need.length === 0) return cache

  try {
    const { data, error } = await sign(need)
    if (error || !data) return cache
    return storeSigned(cache, data, now, PHOTO_SIGNED_SECONDS)
  } catch {
    // انقطاعٌ يُبقي الحرفَ الأول.
    return cache
  }
}

export function useProfilePhotoUrls() {
  const client = useSupabaseClient<Database>()
  const cache = useState<SignedCache>(PROFILE_PHOTOS_SIGNED_KEY, () => ({}))

  /** يوقّع ما ينقص من القائمة دفعةً واحدة. */
  async function prime(paths: (string | null | undefined)[]): Promise<void> {
    cache.value = await signMissing(
      need => client.storage.from(PHOTO_BUCKET).createSignedUrls(need, PHOTO_SIGNED_SECONDS),
      cache.value,
      paths,
      Date.now()
    )
  }

  /** يُقرأ في القالب — تفاعليٌّ لأنّ `cache` حالةٌ مشتركة. */
  function urlFor(path: string | null | undefined): string | null {
    return urlFrom(cache.value, path, Date.now())
  }

  /** بعد رفعٍ أو إزالة — كي لا يظلّ الرافعُ يرى القديم. */
  function invalidate(path: string): void {
    cache.value = withoutPath(cache.value, path)
  }

  return { prime, urlFor, invalidate }
}
