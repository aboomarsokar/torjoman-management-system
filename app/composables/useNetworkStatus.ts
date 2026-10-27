/**
 * حالُ الاتصال للقالب (الحضورُ بلا إنترنت — طلب المستخدم 2026-10-26: «ليش لمن يضغط على أي تبويب أثناء عدم الاتصال
 * لا يحدث أي رياكشن»): يتبع أحداثَ النظام ويُعاد فحصُه كلَّ 15 ثانية (شبكةٌ ميتةٌ تُعلَن حيّة — `reachability`).
 */
import { isOnlineNow } from '~/utils/reachability'

const RECHECK_MS = 15_000

export function useNetworkStatus() {
  const online = ref(true)
  let timer: ReturnType<typeof setInterval> | null = null
  const check = () => {
    online.value = isOnlineNow()
  }
  onMounted(() => {
    check()
    window.addEventListener('online', check)
    window.addEventListener('offline', check)
    timer = setInterval(check, RECHECK_MS)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', check)
    window.removeEventListener('offline', check)
    if (timer) clearInterval(timer)
  })
  return { online, check }
}
