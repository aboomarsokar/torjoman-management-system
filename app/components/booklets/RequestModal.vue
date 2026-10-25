<script setup lang="ts">
/**
 * «اطلب ملازم» (المعلّم — طلب المستخدم 2026-10-25): الملزمةُ وعددُ النسخ وملاحظةٌ اختياريّة، والحلقةُ حلقتُه.
 * يُشعَر المديرُ الإداريّ بالطلب، والتحقّقُ في `useBookletRequests`.
 */
import { BOOKLETS } from '~/constants/booklets'
import type { RequestDraft } from '~/composables/useBookletRequests'

defineProps<{ busy: boolean }>()
const emit = defineEmits<{ save: [draft: RequestDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const blank = (): RequestDraft => ({ booklet: undefined, copies: '', note: '' })
const form = reactive<RequestDraft>(blank())
watch(open, (o) => {
  if (o) Object.assign(form, blank())
})
const bookletItems = BOOKLETS.map(b => ({ label: `الملزمة ${b.no} — ${b.label}`, value: b.no }))
</script>

<template>
  <UModal
    v-model:open="open"
    title="طلبُ ملازم"
    description="يصل طلبُك إلى المدير الإداري ليجهّز النسخ."
  >
    <template #body>
      <div class="rf">
        <UFormField label="الملزمة">
          <UiSelect
            v-model="form.booklet"
            :items="bookletItems"
            placeholder="اختر الملزمة"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="عدد النسخ">
          <UInput
            v-model="form.copies"
            type="number"
            inputmode="numeric"
            min="1"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="ملاحظة (اختياريّة)">
          <UTextarea
            v-model="form.note"
            :rows="2"
            autoresize
            class="w-full"
            placeholder="مثلاً: لطلابٍ التحقوا هذا الشهر"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="open = false"
        />
        <UButton
          label="أرسل الطلب"
          icon="i-lucide-send"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save', { ...form })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rf { display: flex; flex-direction: column; gap: 14px; }
</style>
