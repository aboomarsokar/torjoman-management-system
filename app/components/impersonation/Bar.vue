<script setup lang="ts">
/**
 * شريطُ الدخول بالنيابة — أعلى العمود الرئيس في لوحة كلّ دور، لا يُخفى في شاشة ما دامت الجلسةُ نيابة.
 * أصفر للقراءة («أنت تتصفّح بحساب X · قراءةٌ فقط · تنتهي HH:MM»)، وأحمر في وضع التعديل بعدٍّ تنازليّ.
 * الحالةُ من الخادم (useImpersonation): انغلاقُ النافذة يسأل الخادمَ ولا يبدّل اللونَ محلّياً،
 * وبلوغُ الانتهاء (أو صفٌّ مختوم) يعود إلى حساب الفاعل — والتعثّرُ يُعاد بعد مهلة، والرسالةُ بعد ردّ الخادم.
 * العدُّ بالثواني مخفيٌّ عن قارئ الشاشة (منطقةٌ حيّة)، ويُقرأ بدلَه الدقائقُ وحدها.
 */
import { WRITE_WINDOW_MINUTES } from '~/constants/impersonation'
import { clockLabel, countdownLabel, expired, minutesLeftLabel, writeOpen } from '~/utils/impersonation'

const { state, refresh, end, setWriteMode } = useImpersonation()
const { handle } = useErrorHandler()
const toast = useToast()

const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const writing = computed(() => writeOpen(state.value, now.value))
const endsAt = computed(() => (state.value ? clockLabel(state.value.expiresAt) : ''))
const countdown = computed(() => (state.value?.writeUntil ? countdownLabel(state.value.writeUntil, now.value) : '00:00'))
// لقارئ الشاشة: الدقائقُ وحدها (لا يُعلَن العدُّ كلَّ ثانية في المنطقة الحيّة)
const minutesLeft = computed(() => (state.value?.writeUntil ? minutesLeftLabel(state.value.writeUntil, now.value) : ''))
const writeLabel = `فعّل التعديل — ${WRITE_WINDOW_MINUTES} دقائق`

// انغلاقُ نافذة الكتابة: الخادمُ يُسأل (قد مدّدها أو أغلقها) — لا تبديلَ لونٍ محلّياً
watch(writing, (open, was) => {
  if (was && !open) void refresh()
})

const busy = ref(false)
/** إنهاءٌ جارٍ — ويبقى مرفوعاً بعد النجاح (التحميلُ آتٍ) كي لا تُعاد المحاولة. */
let ending = false
/** الإنهاءُ التلقائيّ المتعثّر يُعاد بعد مهلة، لا كلَّ ثانية؛ ورسالةُ تعثّره مرّةً واحدة. */
const AUTO_END_RETRY_MS = 10_000
let nextAutoEnd = 0
let autoEndFailed = false

async function run(task: () => Promise<void>, fallback: string) {
  if (busy.value) return
  busy.value = true
  try {
    await task()
  } catch (err) {
    handle(err, fallback)
  } finally {
    busy.value = false
  }
}

/** يُنهي النيابة؛ والرسالةُ بعد ردّ الخادم: «تعود إلى حسابك» للعودة، و«سجّل دخولك» يقولها end نفسُه عند الرفض. */
async function finish(auto = false) {
  if (ending) return
  ending = true
  busy.value = true
  try {
    const outcome = await end()
    if (auto && outcome === 'resumed') {
      toast.add({ title: 'انتهت مدّةُ النيابة — تعود إلى حسابك.', color: 'warning', icon: 'i-lucide-timer-off' })
    }
  } catch (err) {
    ending = false
    nextAutoEnd = Date.now() + AUTO_END_RETRY_MS
    if (!auto || !autoEndFailed) handle(err, 'تعذّر إنهاءُ النيابة.')
    if (auto) autoEndFailed = true
  } finally {
    busy.value = false
  }
}

// النبضةُ تُعيد محاولةَ الإنهاء ما دامت النيابةُ منتهيةً أو مختومة ولم ينجح الإنهاء
onMounted(() => {
  tick = setInterval(() => {
    now.value = Date.now()
    const s = state.value
    if (s && (s.ended || expired(s, now.value)) && !ending && now.value >= nextAutoEnd) void finish(true)
  }, 1000)
})
onUnmounted(() => {
  if (tick) clearInterval(tick)
})

const toggleWrite = (on: boolean) => run(() => setWriteMode(on), 'تعذّر تبديلُ وضع التعديل.')
</script>

<template>
  <div
    v-if="state"
    class="imp"
    :class="writing ? 'imp-write' : 'imp-read'"
    role="status"
    aria-live="polite"
  >
    <p class="imp-text">
      <UIcon
        :name="writing ? 'i-lucide-pencil' : 'i-lucide-eye'"
        class="size-5 shrink-0"
      />
      <span v-if="writing">
        أنت تعدّل باسم <strong>{{ state.targetName }}</strong> — كلُّ تعديلٍ مسجَّل · <bdi
          dir="ltr"
          aria-hidden="true"
        >{{ countdown }}</bdi><span class="sr-only">{{ minutesLeft }}</span>
      </span>
      <span v-else>
        أنت تتصفّح بحساب <strong>{{ state.targetName }}</strong> · قراءةٌ فقط · تنتهي <bdi dir="ltr">{{ endsAt }}</bdi>
      </span>
    </p>
    <div class="imp-actions">
      <button
        v-if="writing"
        type="button"
        class="imp-btn"
        :disabled="busy"
        @click="toggleWrite(false)"
      >
        <UIcon
          name="i-lucide-pencil-off"
          class="size-[18px]"
        />
        أوقف التعديل
      </button>
      <button
        v-else
        type="button"
        class="imp-btn"
        :disabled="busy || state.ended"
        @click="toggleWrite(true)"
      >
        <UIcon
          name="i-lucide-pencil"
          class="size-[18px]"
        />
        {{ writeLabel }}
      </button>
      <button
        type="button"
        class="imp-btn imp-btn-strong"
        :disabled="busy"
        @click="finish()"
      >
        <UIcon
          name="i-lucide-log-out"
          class="size-[18px]"
        />
        إنهاء النيابة
      </button>
    </div>
  </div>
</template>

<style scoped>
.imp { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 8px 32px; border-bottom: 1px solid; }
.imp-read { background: var(--imp-read-bg); color: var(--imp-read-ink); border-color: var(--imp-read-line); }
.imp-write { background: var(--imp-write-bg); color: var(--imp-write-ink); border-color: var(--imp-write-line); }
.imp-text { display: flex; align-items: center; gap: 8px; margin: 0; min-width: 0; font-size: 14.5px; font-weight: 500; line-height: 1.6; }
.imp-text strong { font-weight: 700; }
.imp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.imp-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: var(--r-control); border: 1px solid currentColor; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
.imp-btn:hover:not(:disabled) { opacity: .85; }
.imp-btn:disabled { opacity: .55; cursor: default; }
.imp-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
/* «إنهاء النيابة» معكوسُ اللونين — الأوضحُ في الشريط */
.imp-read .imp-btn-strong { background: var(--imp-read-ink); color: var(--imp-read-bg); border-color: var(--imp-read-ink); }
.imp-write .imp-btn-strong { background: var(--imp-write-ink); color: var(--imp-write-bg); border-color: var(--imp-write-ink); }
@media (max-width: 620px) {
  .imp { padding: 8px 16px; }
  .imp-actions { width: 100%; }
  .imp-btn { flex: 1 1 auto; justify-content: center; }
}
</style>
