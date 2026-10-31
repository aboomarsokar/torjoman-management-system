<script setup lang="ts">
/**
 * تأكيدُ إلغاء طلب ملازم (طلب المستخدم 2026-10-31) — للمعلّم ولطلبه، وللمدير الإداريّ لأيّ طلبٍ لم يُسلَّم.
 * السببُ اختياريّ، ويصل الطرفَ الآخر في الإشعار.
 */
import { MAX_CANCEL_REASON } from '~/constants/booklets'

const props = defineProps<{ summary: string, busy: boolean, byAdmin?: boolean }>()
const emit = defineEmits<{ confirm: [reason: string] }>()
const open = defineModel<boolean>('open', { required: true })

const reason = ref('')
watch(open, (o) => {
  if (o) reason.value = ''
})
const hint = computed(() => props.byAdmin
  ? 'يصل المعلّمَ إشعارٌ بالإلغاء وسببه، وتُفكّ النسخُ المحجوزة.'
  : 'يصل المديرَ الإداريّ إشعارٌ بالإلغاء.')
</script>

<template>
  <UModal
    v-model:open="open"
    title="إلغاءُ طلب الملازم"
  >
    <template #body>
      <div class="cm">
        <p>هل تلغي طلبَ <b>{{ summary }}</b>؟</p>
        <UFormField :label="byAdmin ? 'السبب (يصل المعلّم — اختياريّ)' : 'السبب (اختياريّ)'">
          <UTextarea
            v-model="reason"
            :rows="2"
            autoresize
            :maxlength="MAX_CANCEL_REASON"
            class="w-full"
            :placeholder="byAdmin ? 'مثلاً: الملزمة غير متوفرة حالياً' : 'مثلاً: وصلتنا من مصدرٍ آخر'"
          />
        </UFormField>
        <p class="cm-hint">
          {{ hint }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="تراجع"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          label="نعم، ألغِ الطلب"
          icon="i-lucide-x"
          color="error"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('confirm', reason)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.cm { display: flex; flex-direction: column; gap: 14px; }
.cm p { margin: 0; color: var(--ink); line-height: 1.8; }
.cm .cm-hint { color: var(--ink-3); font-size: 13.5px; }
</style>
