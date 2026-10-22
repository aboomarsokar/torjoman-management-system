/**
 * تثبيتُ التطبيق (PWA) — حالةٌ واحدةٌ مشتركة: يُلتقط حدثُ beforeinstallprompt مرّةً واحدةً من أوّل لحظة
 * (`plugins/pwa-install.client.ts`) فيصل إليه البانرُ وزرُّ «تثبيت التطبيق» أينما رُكِّبا ومتى — كان كلُّ استدعاءٍ
 * يلتقطه لنفسه فيفوت ما رُكِّب بعد إطلاقه (الزرُّ في لوحة التحكم بعد الانتقال من الدخول).
 * البانرُ تحفيزٌ يُغلق فلا يعود قبل أسبوعين؛ والزرُّ ثابتٌ ما دام التطبيقُ غيرَ مثبَّت (طلب المستخدم 2026-10-22).
 * وحيث لا حوارَ أصليّ (Safari، ومتصفّحاتُ iPhone الأخرى، وما لم يُطلق الحدث) تُعرض خطواتٌ بحسب الجهاز.
 * والمنصّةُ دالّةٌ نقيّة في `utils/installPlatform.ts` (مختبَرة).
 */
import type { InstallPlatform } from '~/utils/installPlatform'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'turjuman:pwa-install-dismissed'
const DISMISS_DAYS = 14 // لا يعود البانرُ قبل أسبوعين من إغلاقه
const SHOW_DELAY_MS = 3000 // مهلةٌ قبل ظهور البانر (كي يرى المستخدمُ القيمةَ أولاً)

// الحالةُ المشتركة — تُكتب في المتصفّح وحده (`listenForInstallPrompt` لا يعمل على الخادم)
const deferred = shallowRef<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
const platform = ref<InstallPlatform>('desktop')
let listening = false

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

/** يلتقط حدثَي التثبيت مرّةً واحدة؛ تستدعيه الإضافةُ مبكراً، وكلُّ استدعاءٍ للـcomposable احتياطاً. */
export function listenForInstallPrompt() {
  if (import.meta.server || listening) return
  listening = true
  installed.value = isStandalone()
  platform.value = installPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // امنع تلميحَ Chrome الافتراضي؛ نعرض بانرنا وزرَّنا بدلاً منه
    deferred.value = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = null
  })
}

export function usePwaInstall() {
  listenForInstallPrompt()
  const ready = ref(false) // انقضت مهلةُ البانر

  /** حوارُ التثبيت الأصليّ متاح (Chromium أطلق الحدث). */
  const canPrompt = computed(() => !!deferred.value)
  /** للبانر: 'none' = لا إرشاد · 'mobile' = الشاشة الرئيسية · 'mac' = Dock (Safari وحده). */
  const manual = computed<'none' | 'mobile' | 'mac'>(() =>
    platform.value === 'ios-safari' ? 'mobile' : platform.value === 'mac-safari' ? 'mac' : 'none')

  const dismissedRecently = () => {
    if (import.meta.server) return false
    const ts = Number(localStorage.getItem(DISMISS_KEY))
    return !!ts && (Date.now() - ts) < DISMISS_DAYS * 24 * 60 * 60 * 1000
  }

  // البانر: بعد المهلة، وغيرُ مثبَّت ولا مُغلَقٍ مؤخّراً، و(الحوارُ متاح أو Safari بإرشاده)
  const visible = computed(() =>
    ready.value && !installed.value && (canPrompt.value || manual.value !== 'none') && !dismissedRecently())

  let timer: ReturnType<typeof setTimeout> | null = null
  onMounted(() => {
    timer = setTimeout(() => {
      ready.value = true
    }, SHOW_DELAY_MS)
  })
  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  /** يفتح حوارَ التثبيت الأصليّ (Chrome/Android/Edge)؛ والحدثُ لا يُستعمل إلا مرّة. */
  async function install() {
    const evt = deferred.value
    if (!evt) return
    await evt.prompt()
    const choice = await evt.userChoice
    deferred.value = null
    if (choice.outcome === 'accepted') installed.value = true
  }

  /** يُخفي البانر ويتذكّر الإغلاق (لا يعود قبل DISMISS_DAYS) — والزرُّ الثابتُ باقٍ. */
  function dismiss() {
    if (!import.meta.server) localStorage.setItem(DISMISS_KEY, String(Date.now()))
    ready.value = false
  }

  return { visible, manual, canPrompt, installed: readonly(installed), platform: readonly(platform), install, dismiss }
}
