/**
 * روابطُ الصور الشخصية الموقَّعة — **طلبٌ واحدٌ لكلّ شاشة** ومخبأٌ للجلسة.
 * منقولٌ من الصحابة (`useEmployeePhotoUrls.ts`) على المستودع `profile-photos`.
 *
 * في `useState` لا في التخزين الدائم: الرابطُ الموقَّع ينتهي بعد ساعة ولا معنى لحفظه.
 * وفشلُ التوقيع صامت: سياسةٌ ترفض أو شبكةٌ تنقطع **تُبقي الحرفَ الأول** — لا رسالةَ خطأٍ
 * على صورةٍ اختياريّة.
 *
 * الطلباتُ تتداخل (الشريطُ وقائمةٌ في الشاشة نفسها): فالمدخلاتُ الجديدةُ **تُدمج في المخبأ
 * الحاليّ بعد انتهاء الطلب** لا في لقطةٍ أُخذت قبله، ومسارٌ أُبطل أثناء الطلب **لا يُبعث**
 * (عدّادُ إبطالٍ لكلّ مسار — رابطُ ما قبل الرفع يعرض الوجهَ القديم).
 */
import type { Database } from '~/types/database.types'
import { PHOTO_BUCKET, PHOTO_SIGNED_SECONDS } from '~/constants/profilePhoto'
import { pathsToSign, storeSigned, urlFrom, withoutPath, type SignedCache } from '~/utils/signedUrlCache'

/** مفتاحا الحالة — مُصدَّران لا حرفيّان: `useAuth().signOut()` يمحوهما عند الخروج. */
export const PROFILE_PHOTOS_SIGNED_KEY = 'profile-photos:signed'
export const PROFILE_PHOTOS_GENERATIONS_KEY = 'profile-photos:generations'

/** نتيجةُ توقيع دفعةٍ من المسارات — بشكل ما يردّه `createSignedUrls`. */
export interface SignBatchResult {
  data: { path: string | null, signedUrl: string | null, error: string | null }[] | null
  error: unknown
}

/** موقِّعُ دفعة — في التطبيق `createSignedUrls`، وفي الاختبار دالّةٌ مزيَّفة. */
export type SignBatch = (paths: string[]) => Promise<SignBatchResult>

/** حاوٍ تفاعليّ بشكل `Ref` — `useState` في التطبيق و`{ value }` عاديّ في الاختبار. */
export interface ValueBox<T> { value: T }

/**
 * يوقّع ما ينقص من القائمة دفعةً واحدة ويُرجع **المدخلاتِ الجديدة وحدها** (فارغةً إن لم
 * يلزم شيء أو فشل التوقيع أو انقطعت الشبكة).
 */
export async function signMissing(
  sign: SignBatch,
  cache: SignedCache,
  paths: (string | null | undefined)[],
  now: number
): Promise<SignedCache> {
  const need = pathsToSign(cache, paths, now)
  if (need.length === 0) return {}

  try {
    const { data, error } = await sign(need)
    if (error || !data) return {}
    return storeSigned({}, data, now, PHOTO_SIGNED_SECONDS)
  } catch {
    // انقطاعٌ يُبقي الحرفَ الأول.
    return {}
  }
}

/**
 * منطقُ المخبأ على حاويَين — نقيٌّ من Nuxt فيُختبر تداخلُ الطلبات والإبطالُ أثناءها.
 */
export function createProfilePhotoUrlStore(
  cache: ValueBox<SignedCache>,
  generations: ValueBox<Record<string, number>>,
  sign: SignBatch,
  now: () => number = Date.now
) {
  // حمايةٌ ثانية: حالةٌ مُحيت (undefined) تُقرأ مخبأً فارغاً لا تُسقط الشاشة
  const cached = (): SignedCache => cache.value ?? {}
  const generationOf = (path: string) => (generations.value ?? {})[path] ?? 0

  /** يوقّع ما ينقص ويدمجه في المخبأ الحاليّ — إلا ما أُبطل منذ بدء الطلب. */
  async function prime(paths: (string | null | undefined)[]): Promise<void> {
    const startedAt = new Map(
      paths.filter((p): p is string => Boolean(p)).map(p => [p, generationOf(p)])
    )
    const entries = await signMissing(sign, cached(), paths, now())
    const fresh = Object.entries(entries).filter(([path]) => startedAt.get(path) === generationOf(path))
    if (fresh.length === 0) return
    cache.value = { ...cached(), ...Object.fromEntries(fresh) }
  }

  /** يُقرأ في القالب — تفاعليٌّ لأنّ `cache` حالةٌ مشتركة. */
  function urlFor(path: string | null | undefined): string | null {
    return urlFrom(cached(), path, now())
  }

  /** بعد رفعٍ أو إزالة — كي لا يظلّ الرافعُ يرى القديم، ولا يُبعث بطلبٍ كان في الطريق. */
  function invalidate(path: string): void {
    generations.value = { ...(generations.value ?? {}), [path]: generationOf(path) + 1 }
    cache.value = withoutPath(cached(), path)
  }

  return { prime, urlFor, invalidate }
}

export function useProfilePhotoUrls() {
  const client = useSupabaseClient<Database>()
  const cache = useState<SignedCache>(PROFILE_PHOTOS_SIGNED_KEY, () => ({}))
  const generations = useState<Record<string, number>>(PROFILE_PHOTOS_GENERATIONS_KEY, () => ({}))

  return createProfilePhotoUrlStore(
    cache,
    generations,
    need => client.storage.from(PHOTO_BUCKET).createSignedUrls(need, PHOTO_SIGNED_SECONDS)
  )
}
