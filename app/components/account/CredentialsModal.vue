<script setup lang="ts">
/**
 * بيانات الدخول بعد إنشاء حسابٍ أو إعادة تعيين كلمته — معرّف الدخول (الرقم الوظيفي أو الهوية)
 * وكلمة المرور المؤقّتة التي ولّدها الخادم، كلٌّ منهما قابلٌ للنسخ.
 * ⚠️ الكلمة تظهر هنا مرّةً واحدة: لا تُحفظ في الواجهة ولا يمكن استرجاعها بعد الإغلاق (تُعاد التعيين عند الحاجة).
 */
import type { AccountCredentials } from '~/composables/useAccountAdmin'

interface Props {
  /** البيانات المعروضة؛ null = النافذة مغلقة. */
  credentials: AccountCredentials | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()
const toast = useToast()

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `نُسخ ${label}.`, color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    toast.add({ title: `تعذّر النسخ — انسخ ${label} يدوياً.`, color: 'warning', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <UModal
    :open="!!props.credentials"
    :title="props.credentials?.title"
    :dismissible="false"
    @update:open="(v) => { if (!v) emit('close') }"
  >
    <template #body>
      <div
        v-if="props.credentials"
        class="creds"
      >
        <p class="creds-msg">
          {{ props.credentials.message }}
        </p>
        <div class="creds-row">
          <div class="creds-cell">
            <span class="creds-label">{{ props.credentials.loginLabel }}</span>
            <span
              class="creds-value"
              dir="ltr"
            >{{ props.credentials.loginId }}</span>
          </div>
          <UButton
            label="نسخ"
            color="primary"
            variant="soft"
            size="lg"
            icon="i-lucide-copy"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="copy(props.credentials.loginId, props.credentials.loginLabel)"
          />
        </div>
        <div class="creds-row">
          <div class="creds-cell">
            <span class="creds-label">كلمة المرور المؤقّتة</span>
            <span
              class="creds-value creds-pw"
              dir="ltr"
            >{{ props.credentials.password }}</span>
          </div>
          <UButton
            label="نسخ"
            color="primary"
            variant="soft"
            size="lg"
            icon="i-lucide-copy"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="copy(props.credentials.password, 'كلمة المرور')"
          />
        </div>
        <p class="creds-warn">
          <UIcon
            name="i-lucide-shield-alert"
            class="size-4 flex-none"
          />
          تظهر الكلمة هذه المرّة فقط — سلّمها لصاحب الحساب الآن. سيُطلب منه تغييرها عند أول دخول.
        </p>
        <div class="creds-actions">
          <UButton
            label="تمّ"
            color="neutral"
            variant="outline"
            size="lg"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
            @click="emit('close')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.creds { display: flex; flex-direction: column; gap: 14px; }
.creds-msg { margin: 0; color: var(--ink-2); line-height: 1.7; }
.creds-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line); }
.creds-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.creds-label { font-size: 13px; color: var(--ink-3); }
.creds-value { font-size: 26px; font-weight: 700; color: var(--ink); letter-spacing: .1em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.creds-pw { font-size: 22px; letter-spacing: .06em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.creds-warn { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.6; }
.creds-actions { display: flex; justify-content: flex-end; }
</style>
