/**
 * يفحص عاملَ الخدمة عن نسخةٍ جديدة كلّما عاد المستخدم إلى تبويب المنصّة أو تطبيقها على الجوال.
 * المتصفّحُ لا يفحص إلا عند فتح الصفحة، والمنصّةُ تبقى مفتوحةً أيّاماً على الجوال فتعمل بنسخةٍ قديمة؛
 * ومتى وُجدت نسخةٌ نزلت وأعاد `registerType: 'autoUpdate'` التحميلَ وحده (nuxt.config.ts).
 */
const MIN_CHECK_GAP_MS = 60_000

export default defineNuxtPlugin((nuxtApp) => {
  let lastCheck = 0
  nuxtApp.hook('service-worker:registered', ({ registration }) => {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      const now = Date.now()
      if (now - lastCheck < MIN_CHECK_GAP_MS) return
      lastCheck = now
      registration.update().catch(() => {})
    })
  })
})
