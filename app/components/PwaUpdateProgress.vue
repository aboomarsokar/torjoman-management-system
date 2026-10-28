<script setup lang="ts">
/**
 * بطاقةُ تنزيل نسخة التطبيق الجديدة (طلب المستخدم 2026-10-28، للأدوار كلّها): «جاري تنزيل النسخة الجديدة» بتاريخها
 * ونسبةٍ مئويةٍ وشريط — بلا عدّ الملفّات (قرار المستخدم). باكتمالها «اكتمل التنزيل — يُعاد تشغيل التطبيق» ثمّ يعيد
 * `autoUpdate` التحميل؛ وإن لم يُعِده خلال `READY_HIDE_MS` تختفي البطاقة. الحالةُ من إضافة `pwa-update`.
 */
import { APP_UPDATE_STATE_KEY, type AppUpdateState } from '~/utils/appUpdate'
import { formatSavedAt } from '~/utils/offlineSnapshot'

const READY_HIDE_MS = 8_000

const state = useState<AppUpdateState>(APP_UPDATE_STATE_KEY, () => ({ phase: 'idle', percent: 0, builtAt: null }))
const ready = computed(() => state.value.phase === 'ready')
const version = computed(() => (state.value.builtAt ? `نسخة ${formatSavedAt(state.value.builtAt)}` : null))

watch(ready, (r) => {
  if (r) setTimeout(() => (state.value = { ...state.value, phase: 'idle' }), READY_HIDE_MS)
})
</script>

<template>
  <ClientOnly>
    <Transition name="upd-slide">
      <div
        v-if="state.phase !== 'idle'"
        class="upd"
        role="status"
        aria-live="polite"
      >
        <div class="upd-head">
          <span
            class="upd-ico"
            :class="{ done: ready }"
          >
            <UIcon
              :name="ready ? 'i-lucide-circle-check' : 'i-lucide-download'"
              class="size-5"
            />
          </span>
          <div class="upd-text">
            <p class="upd-title">
              {{ ready ? 'اكتمل التنزيل — يُعاد تشغيل التطبيق' : 'جاري تنزيل النسخة الجديدة' }}
            </p>
            <p
              v-if="version"
              class="upd-ver"
            >
              <bdi>{{ version }}</bdi>
            </p>
          </div>
          <b class="upd-pct"><bdi>{{ state.percent }}%</bdi></b>
        </div>
        <div
          class="upd-bar"
          role="progressbar"
          :aria-valuenow="state.percent"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="نسبة التنزيل"
        >
          <span :style="{ inlineSize: `${state.percent}%` }" />
        </div>
      </div>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.upd {
  position: fixed;
  inset-inline: 16px;
  bottom: 16px;
  z-index: 61;
  max-width: 420px;
  margin-inline: auto;
  padding: 14px 16px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
}
.upd-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.upd-ico { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: var(--blue-soft); color: var(--blue-ink); }
.upd-ico.done { background: var(--green-soft); color: var(--green-ink); }
.upd-text { flex: 1; min-width: 0; }
.upd-title { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--ink); line-height: 1.4; }
.upd-ver { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.upd-pct { flex: none; font-size: 18px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.upd-bar { height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.upd-bar span { display: block; block-size: 100%; border-radius: inherit; background: var(--blue-ink); transition: inline-size .35s ease; }
.upd-ico.done ~ .upd-pct { color: var(--green-ink); }

.upd-slide-enter-active, .upd-slide-leave-active { transition: transform .35s cubic-bezier(.16, 1, .3, 1), opacity .35s; }
.upd-slide-enter-from, .upd-slide-leave-to { transform: translateY(24px); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .upd-bar span, .upd-slide-enter-active, .upd-slide-leave-active { transition: none; }
}
</style>
