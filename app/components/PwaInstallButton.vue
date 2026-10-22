<script setup lang="ts">
/**
 * زرُّ «تثبيت التطبيق» الثابت (طلب المستخدم 2026-10-22) — في شاشة الدخول وأسفل القائمة الجانبية، ما دام التطبيقُ
 * غيرَ مثبَّت، ولا يُخفيه إغلاقُ البانر. حيث يتاح حوارُ المتصفّح الأصليّ يفتحه، وإلا فنافذةٌ بخطواتٍ لجهازه.
 * `variant`: «side» بندٌ أعلى القائمة الجانبية، و«top» زرٌّ في الترويسة بجانب الجرس (أيقونةٌ على الجوال وتسميةٌ
 * على الشاشات العريضة)، و«block» بطاقةٌ بعرض النموذج (أعلى شاشة الدخول).
 */
import type { InstallPlatform } from '~/utils/installPlatform'

withDefaults(defineProps<{ variant?: 'side' | 'top' | 'block' }>(), { variant: 'block' })

const { installed, canPrompt, platform, install } = usePwaInstall()
const stepsOpen = ref(false)

async function onClick() {
  if (canPrompt.value) {
    await install()
    return
  }
  stepsOpen.value = true
}

const STEPS: Record<InstallPlatform, { icon: string, text: string }[]> = {
  'ios-safari': [
    { icon: 'i-lucide-share', text: 'اضغط زرّ «المشاركة» في أسفل Safari.' },
    { icon: 'i-lucide-square-plus', text: 'اختر «إضافة إلى الشاشة الرئيسية».' },
    { icon: 'i-lucide-circle-check', text: 'اضغط «إضافة» — فتظهر أيقونةُ ترجمان بين تطبيقاتك.' }
  ],
  'ios-other': [
    { icon: 'i-lucide-share', text: 'اضغط زرّ «المشاركة» بجانب شريط العنوان.' },
    { icon: 'i-lucide-square-plus', text: 'اختر «إضافة إلى الشاشة الرئيسية».' },
    { icon: 'i-lucide-compass', text: 'إن لم تجده فافتح الموقعَ في Safari وكرّر الخطوتين.' }
  ],
  'mac-safari': [
    { icon: 'i-lucide-share', text: 'اضغط زرّ «المشاركة» في شريط Safari.' },
    { icon: 'i-lucide-square-plus', text: 'اختر «إضافة إلى Dock».' }
  ],
  'android': [
    { icon: 'i-lucide-ellipsis-vertical', text: 'اضغط قائمةَ المتصفّح ⋮ في الأعلى.' },
    { icon: 'i-lucide-download', text: 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».' },
    { icon: 'i-lucide-circle-check', text: 'أكّد «تثبيت» — فتظهر أيقونةُ ترجمان بين تطبيقاتك.' }
  ],
  'desktop': [
    { icon: 'i-lucide-monitor-down', text: 'اضغط أيقونةَ التثبيت في طرف شريط العنوان.' },
    { icon: 'i-lucide-ellipsis-vertical', text: 'أو من قائمة المتصفّح ⋮ اختر «تثبيت ترجمان».' }
  ]
}
const steps = computed(() => STEPS[platform.value])
const isPhone = computed(() => ['ios-safari', 'ios-other', 'android'].includes(platform.value))
const label = computed(() => isPhone.value ? 'ثبّت التطبيق على جوالك' : 'ثبّت التطبيق على جهازك')
</script>

<template>
  <ClientOnly>
    <template v-if="!installed">
      <button
        v-if="variant === 'side'"
        type="button"
        class="pwa-side"
        @click="onClick"
      >
        <img
          src="/icon-192.png"
          alt=""
          class="pwa-side-icon"
        >
        <span class="pwa-side-text">
          <b>تثبيت التطبيق</b>
          <small>{{ isPhone ? 'على جوالك' : 'على جهازك' }}</small>
        </span>
        <UIcon
          name="i-lucide-download"
          class="size-[18px] pwa-side-go"
        />
      </button>
      <button
        v-else-if="variant === 'top'"
        type="button"
        class="pwa-top"
        :aria-label="label"
        :title="label"
        @click="onClick"
      >
        <UIcon
          name="i-lucide-download"
          class="size-5 pwa-top-ico"
        />
        <span class="pwa-top-label">ثبّت التطبيق</span>
      </button>
      <!-- بطاقةٌ لافتة (طلب المستخدم 2026-10-22): تدرّجُ الهوية وأيقونةُ التطبيق ولمعةٌ دورية -->
      <button
        v-else
        type="button"
        class="pwa-cta"
        @click="onClick"
      >
        <img
          src="/icon-192.png"
          alt=""
          class="pwa-cta-icon"
        >
        <span class="pwa-cta-text">
          <b>{{ label }}</b>
          <small>يُفتح بنقرةٍ من شاشتك الرئيسية</small>
        </span>
        <span class="pwa-cta-go"><UIcon
          name="i-lucide-download"
          class="size-5"
        /></span>
      </button>

      <UModal
        v-model:open="stepsOpen"
        title="تثبيت تطبيق ترجمان"
        description="يُفتح من أيقونته كأيّ تطبيق، بلا متجر ولا تنزيلٍ كبير."
      >
        <template #body>
          <ol class="pwa-steps">
            <li
              v-for="(s, i) in steps"
              :key="i"
            >
              <span class="pwa-num">{{ i + 1 }}</span>
              <UIcon
                :name="s.icon"
                class="size-5 pwa-ico"
              />
              <span>{{ s.text }}</span>
            </li>
          </ol>
        </template>
        <template #footer>
          <UButton
            label="حسناً"
            color="primary"
            block
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="stepsOpen = false"
          />
        </template>
      </UModal>
    </template>
  </ClientOnly>
</template>

<style scoped>
/* القائمة الجانبية: بندٌ مميَّزٌ بمسحةٍ خضراء (لونُ الهوية الثالث) وأيقونةِ التطبيق — يُرى بين البنود لا يذوب فيها */
.pwa-side { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 52px; padding: 7px 12px 7px 10px; border-radius: 13px; border: 1px solid color-mix(in srgb, var(--green) 45%, transparent); background: color-mix(in srgb, var(--green) 16%, transparent); color: var(--side-strong); font: inherit; cursor: pointer; text-align: start; transition: background .15s, border-color .15s, transform .15s; }
.pwa-side:hover { background: color-mix(in srgb, var(--green) 26%, transparent); border-color: var(--green); }
.pwa-side:active { transform: scale(.98); }
.pwa-side:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.pwa-side-icon { width: 34px; height: 34px; flex: none; border-radius: 9px; background: var(--navy); }
.pwa-side-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; }
.pwa-side-text b { font-size: 14.5px; font-weight: 600; }
.pwa-side-text small { font-size: 12px; color: var(--side-ink); }
.pwa-side-go { flex: none; color: var(--green); }

/* شاشة الدخول: بطاقةٌ بتدرّج الهوية (الكحليّ ← الأزرق) ودائرةِ تنزيلٍ خضراء */
.pwa-cta { position: relative; overflow: hidden; display: flex; align-items: center; gap: 13px; width: 100%; min-height: 72px; padding: 12px 14px; border: 0; border-radius: 18px; background: linear-gradient(135deg, var(--navy), var(--blue)); color: #fff; font: inherit; text-align: start; cursor: pointer; box-shadow: 0 10px 26px -10px color-mix(in srgb, var(--navy) 70%, transparent); transition: transform .15s, box-shadow .2s; }
.pwa-cta:hover { box-shadow: 0 14px 30px -10px color-mix(in srgb, var(--navy) 80%, transparent); }
.pwa-cta:active { transform: scale(.985); }
.pwa-cta:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.pwa-cta-icon { width: 46px; height: 46px; flex: none; border-radius: 12px; background: color-mix(in srgb, #fff 14%, transparent); padding: 3px; }
.pwa-cta-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; line-height: 1.4; }
.pwa-cta-text b { font-size: 16.5px; font-weight: 600; }
.pwa-cta-text small { font-size: 13px; opacity: .85; }
.pwa-cta-go { width: 40px; height: 40px; flex: none; border-radius: 999px; background: var(--green); color: var(--navy); display: inline-flex; align-items: center; justify-content: center; }
/* متحرّكةٌ دائماً (طلب المستخدم 2026-10-22) بإيقاعٍ هادئ: لمعةٌ تعبر البطاقة كلَّ بضع ثوانٍ، والسهمُ يهبط في دائرته،
   وحلقةٌ تنبض حولها — وتسكن كلُّها لمن طلب تقليل الحركة */
.pwa-cta::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, color-mix(in srgb, #fff 24%, transparent) 50%, transparent 65%); transform: translateX(110%); animation: pwa-shine 4.5s ease-in-out .6s infinite; pointer-events: none; }
@keyframes pwa-shine { 0% { transform: translateX(110%); } 40%, 100% { transform: translateX(-110%); } }
.pwa-cta-go { position: relative; }
.pwa-cta-go::before { content: ''; position: absolute; inset: 0; border-radius: inherit; border: 2px solid var(--green); animation: pwa-ring 2.2s ease-out infinite; }
@keyframes pwa-ring { 0% { transform: scale(1); opacity: .9; } 70%, 100% { transform: scale(1.55); opacity: 0; } }
.pwa-cta-go :deep(svg), .pwa-cta-go .iconify, .pwa-side-go, .pwa-top-ico { animation: pwa-drop 2.2s ease-in-out infinite; }
@keyframes pwa-drop { 0%, 55%, 100% { transform: translateY(0); } 25% { transform: translateY(3px); } 40% { transform: translateY(-1px); } }

/* الترويسة: أخضرُ الهوية بين زرّي الوضع والجرس الحياديَّين، بحلقةٍ تنبض — وتسميةٌ على الشاشات العريضة */
.pwa-top { position: relative; height: 44px; min-width: 44px; padding: 0 12px; border-radius: 12px; border: 0; background: var(--green); color: var(--navy); font: inherit; font-size: 14.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; transition: filter .15s, transform .15s; }
.pwa-top::before { content: ''; position: absolute; inset: 0; border-radius: inherit; border: 2px solid var(--green); animation: pwa-ring 2.2s ease-out infinite; pointer-events: none; }
.pwa-top:hover { filter: brightness(1.06); }
.pwa-top:active { transform: scale(.96); }
.pwa-top:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.pwa-top-label { white-space: nowrap; }
@media (max-width: 900px) {
  .pwa-top { padding: 0; }
  .pwa-top-label { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .pwa-cta::after, .pwa-cta-go::before, .pwa-cta-go :deep(svg), .pwa-cta-go .iconify, .pwa-side-go, .pwa-top-ico, .pwa-top::before { animation: none; }
  .pwa-side, .pwa-cta, .pwa-top { transition: none; }
}

.pwa-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.pwa-steps li { display: flex; align-items: flex-start; gap: 10px; font-size: 15.5px; line-height: 1.7; color: var(--ink); }
.pwa-num { flex: none; width: 26px; height: 26px; margin-top: 1px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.pwa-ico { flex: none; margin-top: 3px; color: var(--blue); }
</style>
