/**
 * يفحص عاملَ الخدمة عن نسخةٍ جديدة كلّما عاد المستخدم إلى تبويب المنصّة أو تطبيقها على الجوال.
 * المتصفّحُ لا يفحص إلا عند فتح الصفحة، والمنصّةُ تبقى مفتوحةً أيّاماً على الجوال فتعمل بنسخةٍ قديمة؛
 * ومتى وُجدت نسخةٌ نزلت وأعاد `registerType: 'autoUpdate'` التحميلَ وحده (nuxt.config.ts).
 * ويتتبّع تنزيلَها (طلب المستخدم 2026-10-28): نسبةٌ مئويةٌ وتاريخُ النسخة في `PwaUpdateProgress` — تُعدّ ملفّاتُ النسخة
 * الجديدة التي ليست على الجهاز، ثمّ ما وصل منها إلى الخبيئة. وأوّلُ تثبيتٍ (لا عاملَ يتحكّم بالصفحة) لا يُعرض.
 */
import { APP_UPDATE_STATE_KEY, missingKeys, parsePrecacheEntries, PRECACHE_PREFIX, updatePercent, type AppUpdateState } from '~/utils/appUpdate'

const MIN_CHECK_GAP_MS = 60_000
/** كم مرّةً يُعدّ ما وصل في أثناء التنزيل. */
const PROGRESS_POLL_MS = 400

export default defineNuxtPlugin((nuxtApp) => {
  let lastCheck = 0
  const state = useState<AppUpdateState>(APP_UPDATE_STATE_KEY, () => ({ phase: 'idle', percent: 0, builtAt: null }))

  async function cachedKeys(): Promise<Set<string>> {
    const name = (await caches.keys()).find(k => k.startsWith(PRECACHE_PREFIX))
    if (!name) return new Set()
    const cache = await caches.open(name)
    return new Set((await cache.keys()).map(r => r.url))
  }

  /** يتتبّع عاملاً يُثبَّت: النسبةُ ممّا ينقص الجهاز، وتنتهي باكتمال التثبيت. */
  async function track(worker: ServiceWorker) {
    if (!navigator.serviceWorker.controller || state.value.phase === 'downloading') return
    state.value = { phase: 'downloading', percent: 0, builtAt: null }
    let timer: ReturnType<typeof setInterval> | null = null
    const finish = (phase: 'ready' | 'idle') => {
      if (timer) clearInterval(timer)
      state.value = { ...state.value, phase, percent: phase === 'ready' ? 100 : state.value.percent }
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'activated') finish('ready')
      else if (worker.state === 'redundant') finish('idle')
    })
    $fetch<{ builtAt: string | null }>('/api/version').then((v) => {
      state.value = { ...state.value, builtAt: v.builtAt }
    }).catch(() => undefined)
    try {
      const swText = await fetch(worker.scriptURL, { cache: 'no-store' }).then(r => r.text())
      const missing = missingKeys(parsePrecacheEntries(swText), worker.scriptURL, await cachedKeys())
      if (state.value.phase !== 'downloading') return
      timer = setInterval(async () => {
        const have = await cachedKeys()
        if (state.value.phase !== 'downloading') return
        state.value = { ...state.value, percent: updatePercent(missing.filter(k => have.has(k)).length, missing.length) }
      }, PROGRESS_POLL_MS)
    } catch {
      // تعذّر عدُّ الملفّات: تبقى البطاقةُ بلا نسبة حتى يكتمل التثبيت
    }
  }

  nuxtApp.hook('service-worker:registered', ({ registration }) => {
    if (!registration) return
    if (registration.installing) void track(registration.installing)
    registration.addEventListener('updatefound', () => {
      if (registration.installing) void track(registration.installing)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      const now = Date.now()
      if (now - lastCheck < MIN_CHECK_GAP_MS) return
      lastCheck = now
      registration.update().catch(() => {})
    })
  })
})
