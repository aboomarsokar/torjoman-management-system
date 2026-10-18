/**
 * مخبأُ الروابط الموقَّعة — **منطقٌ نقيٌّ بلا Supabase** كي يُختبر (منقولٌ من الصحابة).
 *
 * لماذا مخبأٌ أصلاً: المستودعُ خاصّ، و`<img>` لا يحمل رمزَ الجلسة، فكلُّ صورةٍ تحتاج رابطاً
 * موقَّعاً — وقائمةُ 40 موظفاً بلا مخبأ 40 طلباً في كلّ فتحة.
 */
export interface SignedEntry {
  url: string
  expiresAt: number
}

export type SignedCache = Record<string, SignedEntry>

/** هامشٌ قبل الانتهاء — رابطٌ يُقرأ الآن ويُحمَّل بعد ثوانٍ. */
const RENEW_MARGIN_MS = 60_000

/** المساراتُ التي تحتاج توقيعاً: غيرُ الفارغة، بلا تكرار، وغيرُ المخبّأة الصالحة. */
export function pathsToSign(
  cache: SignedCache,
  paths: (string | null | undefined)[],
  now: number
): string[] {
  const wanted = new Set<string>()

  for (const path of paths) {
    if (!path) continue
    const entry = cache[path]
    if (entry && entry.expiresAt - RENEW_MARGIN_MS > now) continue
    wanted.add(path)
  }

  return [...wanted]
}

/**
 * يحفظ ما نجح توقيعُه — **على مرجعٍ جديد** كي تلحظه `useState`.
 * `signedUrl` بنوع `string | null` كما يردّه `@supabase/storage-js`.
 */
export function storeSigned(
  cache: SignedCache,
  signed: { path: string | null, signedUrl: string | null, error: string | null }[],
  now: number,
  ttlSeconds: number
): SignedCache {
  const next: SignedCache = { ...cache }

  for (const item of signed) {
    if (!item.path || item.error || !item.signedUrl) continue
    next[item.path] = { url: item.signedUrl, expiresAt: now + ttlSeconds * 1000 }
  }

  return next
}

/** الرابطُ الصالح أو `null` — والعرضُ يسقط إلى الحرف. */
export function urlFrom(
  cache: SignedCache,
  path: string | null | undefined,
  now: number
): string | null {
  if (!path) return null
  const entry = cache[path]
  return entry && entry.expiresAt > now ? entry.url : null
}

/** إبطالُ مسارٍ بعد رفعٍ أو إزالة — الاسمُ ثابت، والرابطُ القديم يعرض القديم. */
export function withoutPath(cache: SignedCache, path: string): SignedCache {
  return Object.fromEntries(Object.entries(cache).filter(([key]) => key !== path))
}
