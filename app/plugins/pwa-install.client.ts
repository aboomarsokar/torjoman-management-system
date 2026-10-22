/** يلتقط حدثَ تثبيت التطبيق من أوّل لحظة — يُطلقه المتصفّحُ مرّةً واحدةً عند التحميل (انظر `usePwaInstall`). */
export default defineNuxtPlugin(() => {
  listenForInstallPrompt()
})
