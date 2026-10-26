/**
 * حارسُ الشبكة (الحضورُ بلا إنترنت — نمطُ الصحابة، 2026-10-26): يُركَّب قبل عميل Supabase فيلفّ `fetch`:
 *   • نداءاتُ الدخول بلا اتصال تُقطع بردٍّ فوريّ — وإلا وقف الإقلاعُ ثلاثين ثانيةً ينتظر تجديدَ رمزٍ لن يأتي.
 *   • نجاحُ طلبٍ إلى الخادم أو فشلُه الشبكيّ يُسجَّل، فيُعرف أنّ «الواي‑فاي» بلا إنترنت (`reachability`).
 * لا يغيّر شيئاً حين يكون الاتصالُ سليماً.
 */
import { isOnlineNow, noteNetworkFailure, noteNetworkSuccess, offlineAuthResponse, shouldShortCircuitAuth } from '~/utils/reachability'

const GUARDED = Symbol.for('torjoman:network-guard')
type Guarded = typeof globalThis.fetch & { [GUARDED]?: true }

export default defineNuxtPlugin({
  name: 'offline-network-guard',
  enforce: 'pre',
  setup() {
    if ((globalThis.fetch as Guarded)[GUARDED]) return
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
})
