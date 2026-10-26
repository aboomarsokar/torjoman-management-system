/**
 * «جاهزٌ للعمل بلا اتصال» (نمطُ الصحابة): التخزينُ المسبق يجري بعد الفتح بثوانٍ — فيُراقَب حتى تصير شاشةُ الحضور
 * في خبيئة عامل الخدمة، ولا تُقال «جاهز» قبلها. بلا عامل خدمةٍ (التطوير) تبقى `unsupported` ولا تُعرض الشارة.
 */
import { OFFLINE_HOME } from '~/constants/offline'

export type Readiness = 'unsupported' | 'preparing' | 'ready'

/** هل في الخبيئة نسخةٌ من شاشة الحضور (مفتاحُ Workbox يحمل معامل المراجعة، فتُطابَق بلا استعلام)؟ */
export async function isOfflineShellCached(path: string = OFFLINE_HOME): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  return !!(await caches.match(path, { ignoreSearch: true }))
}

export function useOfflineReadiness() {
  const state = ref<Readiness>('unsupported')
  let timer: ReturnType<typeof setInterval> | null = null

  async function check() {
    if (await isOfflineShellCached()) {
      state.value = 'ready'
      if (timer) clearInterval(timer)
      timer = null
    }
  }

  onMounted(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      // أوّلُ فتحٍ يسجّل العاملَ ولا يتحكّم بعد: يُنتظر تحكّمُه
      if (!('serviceWorker' in navigator)) return
      navigator.serviceWorker.ready.then(() => {
        state.value = state.value === 'ready' ? 'ready' : 'preparing'
        void check()
      }).catch(() => undefined)
    } else {
      state.value = 'preparing'
    }
    await check()
    if (state.value !== 'ready') timer = setInterval(() => void check(), 3000)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return { state }
}
