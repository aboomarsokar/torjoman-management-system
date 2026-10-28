<script setup lang="ts">
/**
 * نافذةُ «توريد» (نسخٌ وصلت تُضاف) أو «جرد» (العددُ الفعليّ وحدُّ التنبيه) لملزمةٍ واحدة (طلب المستخدم 2026-10-28).
 */
import type { StockAction, StockDraft } from '~/composables/useBookletStock'
import { BOOKLETS } from '~/constants/booklets'
import { PROJECT_START_DATE } from '~/constants/project'
import { gazaToday } from '~/utils/reportWindow'

const props = defineProps<{ booklet: number | null, action: StockAction, current: number | null, alertAt: number | null, busy: boolean }>()
const emit = defineEmits<{ save: [d: StockDraft] }>()
const open = defineModel<boolean>('open', { required: true })

const DEFAULT_ALERT = 20
const form = reactive({ copies: '', alertAt: String(DEFAULT_ALERT), note: '', movedOn: gazaToday() })
const today = gazaToday()
watch(open, (o) => {
  if (!o) return
  form.copies = props.action === 'count' && props.current !== null ? String(props.current) : ''
  form.alertAt = String(props.alertAt ?? DEFAULT_ALERT)
  form.note = ''
  form.movedOn = gazaToday()
})
const label = computed(() => BOOKLETS.find(b => b.no === props.booklet)?.label ?? '')
const title = computed(() => `${props.action === 'supply' ? 'توريد' : 'جرد'} — ملزمة ${label.value}`)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
  >
    <template #body>
      <div class="sm">
        <p class="sm-now">
          الرصيدُ الحاليّ: <b>{{ current ?? 'لم يُجرد بعد' }}</b>
        </p>
        <UFormField :label="action === 'supply' ? 'عدد النسخ الواردة' : 'العدد الفعليّ الموجود'">
          <UInput
            v-model="form.copies"
            type="number"
            inputmode="numeric"
            min="0"
            dir="ltr"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField
          v-if="action === 'count'"
          label="حدّ التنبيه (ينبّه عند هذا العدد أو أقلّ)"
        >
          <UInput
            v-model="form.alertAt"
            type="number"
            inputmode="numeric"
            min="0"
            dir="ltr"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField :label="action === 'supply' ? 'تاريخ التوريد' : 'تاريخ الجرد'">
          <UInput
            v-model="form.movedOn"
            type="date"
            :min="PROJECT_START_DATE"
            :max="today"
            dir="ltr"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
        <UFormField label="ملاحظة (اختياريّة)">
          <UInput
            v-model="form.note"
            size="xl"
            class="w-full"
            :placeholder="action === 'supply' ? 'مثلاً: طبعة المطبعة 28/10' : 'مثلاً: جردُ المستودع'"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
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
          :label="action === 'supply' ? 'أضف إلى المخزون' : 'احفظ الجرد'"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="booklet && emit('save', { booklet, action, copies: form.copies, alertAt: form.alertAt, note: form.note, movedOn: form.movedOn })"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; gap: 14px; }
.sm-now { margin: 0; color: var(--ink-2); }
.sm-now b { color: var(--ink); }
</style>
