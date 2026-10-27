/**
 * حارسُ الشبكة (الحضورُ بلا إنترنت — نمطُ الصحابة، 2026-10-26): يلفّ `fetch`:
 *   • نداءاتُ الدخول بلا اتصال تُقطع بردٍّ فوريّ — وإلا وقف الإقلاعُ ثلاثين ثانيةً ينتظر تجديدَ رمزٍ لن يأتي.
 *   • نجاحُ طلبٍ إلى الخادم أو فشلُه الشبكيّ يُسجَّل، فيُعرف أنّ «الواي‑فاي» بلا إنترنت (`reachability`).
 * لا يغيّر شيئاً حين يكون الاتصالُ سليماً.
 *
 * ⚠️ **يُركَّب عند تحميل الملفّ لا في `setup`** (قياسٌ على الجوال 2026-10-27: الشاشةُ بلا اتصالٍ بعد 28.9 ثانية):
 * إضافةُ Supabase تنتظر `getSession()` في إعدادها — فيُجدَّد الرمزُ المنتهي ويُعاد 30 ثانية — **وتسبق إضافتَنا**
 * ولو كانت `enforce: 'pre'`. وملفّاتُ الإضافات تُستورد كلُّها قبل تشغيل أيٍّ منها، فالتركيبُ هنا يسبقها.
 */
import { isOnlineNow, noteNetworkFailure, noteNetworkSuccess, offlineAuthResponse, shouldShortCircuitAuth } from '~/utils/reachability'

const GUARDED = Symbol.for('torjoman:network-guard')
type Guarded = typeof globalThis.fetch & { [GUARDED]?: true }

function installNetworkGuard() {
  if (typeof window === 'undefined' || (globalThis.fetch as Guarded)[GUARDED]) return
  const original = globalThis.fetch.bind(globalThis)
  const host = globalThis.location.host

  const guarded: Guarded = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (shouldShortCircuitAuth(url, isOnlineNow())) return offlineAuthResponse()
    const remote = url.startsWith('http') && !url.includes(host)
    try {
      const res = await original(input, init)
      if (remote) noteNetworkSuccess()
      return res
    } catch (err) {
      // إلغاءُ الطلب عمداً ليس انقطاعاً
      if (remote && !(err instanceof DOMException && err.name === 'AbortError')) noteNetworkFailure()
      throw err
    }
  }
  guarded[GUARDED] = true
  globalThis.fetch = guarded
}

installNetworkGuard()

export default defineNuxtPlugin({
  name: 'offline-network-guard',
  enforce: 'pre',
  setup: installNetworkGuard
})
