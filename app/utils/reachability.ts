/**
 * «هل الجهازُ متّصلٌ فعلاً؟» (نمطُ الصحابة): `navigator.onLine` يقول «متّصل» على شبكةٍ ميتة (واي‑فاي بلا إنترنت)،
 * فطلبٌ إلى الخادم فشل فشلاً شبكيّاً يجعل الجهازَ منقطعاً مدّةً حتى ينجح طلبٌ بعده. حالةٌ على مستوى الوحدة —
 * يكتبها حارسُ الشبكة (الإضافة) ويقرؤها الحارسُ العامّ والشاشة.
 */
import { NETWORK_FAILURE_WINDOW_MS } from '~/constants/offline'

let lastFailureAt = 0

export function noteNetworkFailure(now: number = Date.now()): void {
  lastFailureAt = now
}

export function noteNetworkSuccess(): void {
  lastFailureAt = 0
}

/** متّصلٌ فعلاً: النظامُ يقول نعم، ولا فشلَ شبكيّاً قريباً لم يتبعه نجاح. */
export function effectivelyOnline(navigatorOnline: boolean, now: number = Date.now()): boolean {
  if (!navigatorOnline) return false
  return !lastFailureAt || now - lastFailureAt > NETWORK_FAILURE_WINDOW_MS
}

/** حكمُ الآن في المتصفّح (الخادمُ يُعدّ متّصلاً). */
export function isOnlineNow(): boolean {
  return typeof navigator === 'undefined' ? true : effectivelyOnline(navigator.onLine)
}

/** نداءاتُ الدخول تُقطع بلا اتصال بردٍّ فوريّ (لا رفض) — وإلا انتظر عميلُ Supabase تجديدَ الرمز ثلاثين ثانية. */
export function shouldShortCircuitAuth(url: string, online: boolean): boolean {
  return !online && url.includes('/auth/v1/')
}

/** ردٌّ مصطنع: 503 يصير خطأً يفشل مرّةً واحدةً فوراً، ولا تُمحى به الجلسة. */
export function offlineAuthResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'network_offline', error_description: 'fetch failed: offline', msg: 'fetch failed: offline' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}
