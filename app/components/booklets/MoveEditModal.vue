<script setup lang="ts">
/**
 * تعديلُ حركة مخزونٍ بعد حفظها (طلب المستخدم 2026-10-28): الملاحظة، والتاريخُ للتوريد والجرد
 * (حركةُ التسليم تتبع تاريخَ التسليم). العددُ لا يُعدَّل هنا — يُضبط بـ«جرد».
 */
import type { StockMove } from '~/composables/useBookletStock'
import { BOOKLETS, MAX_BOOKLET_NOTE } from '~/constants/booklets'
import { PROJECT_START_DATE } from '~/constants/project'
import { gazaToday } from '~/utils/reportWindow'

const props = defineProps<{ move: StockMove | null, busy: boolean }>()
const emit = defineEmits<{ save: [id: string, note: string, movedOn: string | null] }>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive({ note: '', movedOn: '' })
const today = gazaToday()
watch(open, (o) => {
  if (o && props.move) Object.assign(form, { note: props.move.note ?? '', movedOn: props.move.moved_on })
})
const datable = computed(() => props.move?.reason === 'supply' || props.move?.reason === 'count')
const title = computed(() => {
  const m = props.move
  if (!m) return 'تعديل الحركة'
  const kind = { supply: 'توريد', count: 'جرد', delivery: 'تسليم', delivery_removed: 'إرجاع' }[m.reason] ?? ''
  return `تعديل ${kind} — ${BOOKLETS.find(b => b.no === m.booklet)?.label ?? ''}`
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
  >
    <template #body>
      <div class="me">
        <UFormField
          v-if="datable"
          label="التاريخ"
        >
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
        <p
          v-else
          class="me-hint"
        >
          تاريخُ هذه الحركة هو تاريخُ التسليم نفسه.
        </p>
        <UFormField
          label="ملاحظة"
          :hint="`${form.note.trim().length}/${MAX_BOOKLET_NOTE}`"
        >
          <UTextarea
            v-model="form.note"
            :rows="2"
            autoresize
            class="w-full"
            :maxlength="MAX_BOOKLET_NOTE"
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
          label="احفظ"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="move && emit('save', move.id, form.note, datable ? form.movedOn : null)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.me { display: flex; flex-direction: column; gap: 14px; }
.me-hint { margin: 0; font-size: 13px; color: var(--ink-3); }
</style>
