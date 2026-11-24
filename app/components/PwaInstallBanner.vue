<script setup lang="ts">
/**
 * بانر تحفيز تثبيت التطبيق (PWA) — يظهر أسفل الشاشة بعد مهلة قصيرة حين يكون
 * الموقع قابلاً للتثبيت. زرّ «تثبيت التطبيق» يفتح الحوار الأصلي؛ على iOS يظهر
 * إرشاد يدوي (شارك ← أضف إلى الشاشة الرئيسية). قابل للإغلاق مع ذاكرة.
 */
const { visible, manual, install, dismiss } = usePwaInstall()
const showSteps = ref(false)

/** Safari يحتاج تثبيتاً يدويّاً (لا يدعم beforeinstallprompt). */
const isManual = computed(() => manual.value !== 'none')
/** الخطوة الثانية تختلف: الجوّال ← الشاشة الرئيسية · الماك ← Dock. */
const targetLabel = computed(() => manual.value === 'mac' ? 'إضافة إلى Dock' : 'إضافة إلى الشاشة الرئيسية')
const shareHint = computed(() => manual.value === 'mac'
  ? 'اضغط زرّ «المشاركة» في شريط Safari'
  : 'اضغط زرّ «المشاركة» في أسفل Safari')

async function onInstall() {
  if (isManual.value) {
    showSteps.value = !showSteps.value
    return
  }
  await install()
}
</script>

<template>
  <ClientOnly>
    <Transition name="pwa-slide">
      <div
        v-if="visible"
        class="pwa-banner"
        role="dialog"
        aria-label="تثبيت التطبيق"
      >
        <button
          class="pwa-close"
          aria-label="إغلاق"
          @click="dismiss"
        >
          <UIcon
            name="i-lucide-x"
            class="size-5"
          />
        </button>

        <div class="pwa-head">
          <img
            src="/icon-192.png"
            alt="ترجمان"
            class="pwa-icon"
          >
          <div class="pwa-text">
            <p class="pwa-title">
              ثبّت تطبيق ترجمان على شاشتك الرئيسية
            </p>
            <p class="pwa-sub">
              وصول أسرع بنقرة واحدة، وتجربة كتطبيق مستقلّ.
            </p>
          </div>
        </div>

        <!-- إرشاد Safari (لا يدعم التثبيت البرمجي) -->
        <div
          v-if="isManual && showSteps"
          class="pwa-ios"
        >
          <p class="pwa-ios-step">
            <UIcon
              name="i-lucide-share"
              class="size-4"
            />
            {{ shareHint }}
          </p>
          <p class="pwa-ios-step">
            <UIcon
              name="i-lucide-plus-square"
              class="size-4"
            />
            اختر «{{ targetLabel }}»
          </p>
        </div>

        <UButton
          :label="isManual ? (showSteps ? 'إخفاء الخطوات' : 'كيف أثبّته؟') : 'تثبيت التطبيق'"
          :icon="isManual ? 'i-lucide-share' : 'i-lucide-download'"
          color="primary"
          size="lg"
          block
          :ui="{ base: 'rounded-[14px] font-bold' }"
          @click="onInstall"
        />
      </div>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.pwa-banner {
  position: fixed;
  inset-inline: 16px;
  bottom: 16px;
  z-index: 60;
  max-width: 460px;
  margin-inline: auto;
  padding: 18px 18px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
}
.pwa-close {
  position: absolute;
  inset-inline-start: 12px;
  top: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--ink-3);
  background: transparent;
  transition: background .15s, color .15s;
}
.pwa-close:hover { background: var(--surface-3); color: var(--ink); }
.pwa-head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; padding-inline-end: 28px; }
.pwa-icon { width: 54px; height: 54px; border-radius: 15px; flex-shrink: 0; box-shadow: var(--shadow); }
.pwa-text { min-width: 0; }
.pwa-title { margin: 0 0 4px; font-size: 15.5px; font-weight: 800; color: var(--ink); line-height: 1.4; }
.pwa-sub { margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.6; }
.pwa-ios { margin-bottom: 14px; padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; display: flex; flex-direction: column; gap: 8px; }
.pwa-ios-step { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink); }

.pwa-slide-enter-active, .pwa-slide-leave-active { transition: transform .35s cubic-bezier(.16, 1, .3, 1), opacity .35s; }
.pwa-slide-enter-from, .pwa-slide-leave-to { transform: translateY(24px); opacity: 0; }

@media (max-width: 380px) {
  .pwa-title { font-size: 14.5px; }
}
</style>
