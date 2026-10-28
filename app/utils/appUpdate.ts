/**
 * تقدّمُ تنزيل نسخة التطبيق الجديدة (طلب المستخدم 2026-10-28): عاملُ الخدمة يُنزّل ملفّاتِ النسخة في الخلفية بصمت، فتقرأ
 * الشاشةُ قائمتَها من `sw.js` الجديد وتعدّ ما وصل منها إلى خبيئة الجهاز. ما لم يتغيّر بين النسختين موجودٌ أصلاً فلا يُنزَّل
 * ولا يُحسب — فالنسبةُ لِما يُنزَّل فعلاً. دوالُّ نقيّةٌ مختبَرة.
 */

export interface PrecacheEntry { url: string, revision: string | null }

export type AppUpdatePhase = 'idle' | 'downloading' | 'ready'
export interface AppUpdateState { phase: AppUpdatePhase, percent: number, builtAt: string | null }

/** مفتاحُ حالة التحديث المشتركة بين الإضافة والبطاقة (`useState`). */
export const APP_UPDATE_STATE_KEY = 'app-update'

/** بادئةُ خبيئة ملفّات النسخة عند workbox. */
export const PRECACHE_PREFIX = 'workbox-precache'

/** قائمةُ ملفّات النسخة كما يكتبها workbox في `sw.js`: `{url:"…",revision:"…"|null}`. */
export function parsePrecacheEntries(swText: string): PrecacheEntry[] {
  const out: PrecacheEntry[] = []
  for (const m of swText.matchAll(/\{url:"([^"]+)",revision:(?:null|"([^"]*)")\}/g)) {
    out.push({ url: m[1]!, revision: m[2] ?? null })
  }
  return out
}

/** مفتاحُ الملفّ في الخبيئة كما يصنعه workbox: الرابطُ المطلق، وبرقم مراجعته إن كان له رقم. */
export function precacheCacheKey(entry: PrecacheEntry, base: string): string {
  const url = new URL(entry.url, base)
  if (entry.revision) url.searchParams.set('__WB_REVISION__', entry.revision)
  return url.href
}

/** ما ستُنزّله النسخةُ الجديدة: ملفّاتُها التي ليست على الجهاز بعد. */
export function missingKeys(entries: PrecacheEntry[], base: string, cached: Set<string>): string[] {
  return entries.map(e => precacheCacheKey(e, base)).filter(k => !cached.has(k))
}

/** النسبةُ المئوية — لا تبلغ 100 إلا باكتمال كلّ الملفّات، ولا شيءَ يُنزَّل = 100. */
export function updatePercent(done: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(100, Math.floor((done / total) * 100))
}
