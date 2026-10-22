<script setup lang="ts">
/**
 * زرُّ «تثبيت التطبيق» الثابت (طلب المستخدم 2026-10-22) — في شاشة الدخول وأسفل القائمة الجانبية، ما دام التطبيقُ
 * غيرَ مثبَّت، ولا يُخفيه إغلاقُ البانر. حيث يتاح حوارُ المتصفّح الأصليّ يفتحه، وإلا فنافذةٌ بخطواتٍ لجهازه.
 * `variant`: «side» بندٌ بشكل بنود القائمة الجانبية، و«block» زرٌّ بعرض النموذج (شاشة الدخول).
 */
import type { InstallPlatform } from '~/utils/installPlatform'

withDefaults(defineProps<{ variant?: 'side' | 'block' }>(), { variant: 'block' })

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
const label = computed(() => ['ios-safari', 'ios-other', 'android'].includes(platform.value)
  ? 'ثبّت التطبيق على جوالك'
  : 'ثبّت التطبيق على جهازك')
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
        <UIcon
          name="i-lucide-download"
          class="size-[18px]"
        />
        <span>تثبيت التطبيق</span>
      </button>
      <UButton
        v-else
        :label="label"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="lg"
        block
        :ui="{ base: 'rounded-[14px] min-h-12 text-[15.5px] font-semibold' }"
        @click="onClick"
      />

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
/* بشكل بنود القائمة الجانبية (`.nav-item` في الهيكل) — المتغيّراتُ موروثةٌ من `.side` */
.pwa-side { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 14px; border-radius: 11px; border: 1px dashed var(--side-line); background: transparent; color: var(--side-ink); font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; text-align: start; transition: background .15s, color .15s, border-color .15s; }
.pwa-side:hover { background: var(--side-hover); color: var(--side-strong); border-color: transparent; }
.pwa-side:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }

.pwa-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.pwa-steps li { display: flex; align-items: flex-start; gap: 10px; font-size: 15.5px; line-height: 1.7; color: var(--ink); }
.pwa-num { flex: none; width: 26px; height: 26px; margin-top: 1px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.pwa-ico { flex: none; margin-top: 3px; color: var(--blue); }
</style>
