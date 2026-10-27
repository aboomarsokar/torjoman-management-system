/**
 * موقظُ صناديق الرفع (البند 14 — نمطُ الصحابة، 2026-10-27): يرفع ما حُفظ بلا إنترنت **من أيّ شاشة** — لا من شاشة
 * الحضور أو الإنجاز وحدها. يقرأ الصناديقَ عند الإقلاع ويرفعها، ويوقظها عند عودة الشبكة وعودة التطبيق للواجهة.
 * والصندوقُ الفارغ لا يطلب شيئاً من الخادم.
 */
import type { Database } from '~/types/database.types'
import { flushAllQueues, loadQueue, queueOnline, registeredQueues } from '~/composables/useOfflineQueue'
import '~/utils/offlineQueues'
import { isOnlineNow, noteNetworkSuccess } from '~/utils/reachability'

export default defineNuxtPlugin({
  name: 'offline-sync',
  dependsOn: ['offline-network-guard'],
  setup() {
    const supabase = useSupabaseClient<Database>()
    const wake = () => {
      queueOnline.value = isOnlineNow()
      void flushAllQueues(supabase)
    }

    queueOnline.value = isOnlineNow()
    void Promise.all(registeredQueues().map(loadQueue)).then(wake).catch(() => undefined)

    window.addEventListener('online', () => {
      // النظامُ يُعلن العودة: يُمحى أثرُ الفشل الأخير فلا يُعدّ الجهازُ منقطعاً بقيّةَ المهلة
      noteNetworkSuccess()
      wake()
    })
    window.addEventListener('offline', () => {
      queueOnline.value = false
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake()
    })
    // الرفعُ بجلسة صاحب السطر وحدها: الدخولُ يوقظ ما انتظره
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') wake()
    })
  }
})
