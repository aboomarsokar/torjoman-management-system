<script setup lang="ts">
/**
 * تسجيلُ تسليم ملازم لحلقة (المدير الإداري) — الحلقةُ والملزمةُ وعددُ النسخ والتاريخ وملاحظةٌ اختياريّة.
 * التسليمُ يتكرّر (دفعةٌ ثانية من الملزمة نفسها صفٌّ جديد)، والتحقّقُ في `useBooklets`.
 */
import { PROJECT_START_DATE } from '~/constants/project'
import { BOOKLETS } from '~/constants/booklets'
import type { DeliveryDraft } from '~/composables/useBooklets'
import type { HalaqaLite } from '~/utils/booklets'
import { gazaToday } from '~/utils/reportWindow'

const props = defineProps<{
  halaqat: HalaqaLite[]
  busy: boolean
}>()
const emit = defineEmits<{ save: [draft: DeliveryDraft, today: string] }>()
const open = defineModel<boolean>('open', { required: true })

const today = gazaToday()
const blank = (): DeliveryDraft => ({ halaqaId: undefined, booklet: undefined, copies: '', deliveredOn: today, note: '' })
const form = reactive<DeliveryDraft>(blank())
watch(open, (o) => {
  if (o) Object.assign(form, blank())
})

const halaqaItems = computed(() => props.halaqat.map(h => ({
  label: h.status === 'active' ? h.name : `${h.name} (متوقفة)`,
  value: h.id
})))
const bookletItems = BOOKLETS.map(b => ({ label: `الملزمة ${b.no} — ${b.label}`, value: b.no }))
</script>

<template>
  <UModal
    v-model:open="open"
    title="تسليم ملازم"
    description="سجّل ما استلمته الحلقة من نسخ ملزمةٍ واحدة."
  >
    <template #body>
      <div class="form">
        <UFormField label="الحلقة">
          <UiSelect
            v-model="form.halaqaId"
            :items="halaqaItems"
            placeholder="اختر الحلقة"
            size="lg"
          />
        </UFormField>
        <UFormField label="الملزمة">
          <UiSelect
            v-model="form.booklet"
            :items="bookletItems"
            placeholder="اختر الملزمة"
            size="lg"
          />
        </UFormField>
        <div class="pair">
          <UFormField label="عدد النسخ">
            <UInput
              v-model="form.copies"
              inputmode="numeric"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] min-h-11' }"
            />
          </UFormField>
          <UFormField label="تاريخ التسليم">
            <UInput
              v-model="form.deliveredOn"
              type="date"
              :min="PROJECT_START_DATE"
              :max="today"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] min-h-11' }"
            />
          </UFormField>
        </div>
        <UFormField
          label="ملاحظة"
          hint="اختياري"
        >
          <UInput
            v-model="form.note"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          @click="open = false"
        />
        <UButton
          label="تسجيل التسليم"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          class="min-h-11"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="emit('save', { ...form }, today)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.foot { display: flex; justify-content: flex-end; gap: 10px; width: 100%; }
@media (max-width: 480px) { .pair { grid-template-columns: 1fr; } }
</style>
