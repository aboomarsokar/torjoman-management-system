<script setup lang="ts">
/**
 * نافذةُ «لم تنعقد الحلقة» (2026-10-30) في شاشة حضور المعلّم: أربعةُ أسبابٍ بأزرارٍ كبيرة تُضغط بالإبهام، وملاحظةٌ تصير
 * إلزاميةً مع «سبب آخر»، و«تأكيد». ومع يومٍ سُجّل حضورُه تنبيهٌ أنّه سيُمحى. تُفتح فارغةً أو معبّأةً («عدّل البلاغ»)،
 * والحفظُ (`reportOff`) في `useOfflineAttendance`: كتابةٌ على الجهاز فوريّة فلا حالةَ انشغال، ونقرٌ مزدوجٌ يكتب السطرَ نفسَه.
 */
import { OFF_NOTE_MAX, OFF_REASONS, OFF_REASON_LABELS, offInputError, type OffReason } from '~/utils/offDays'

const props = defineProps<{
  /** اليومُ معروضاً (dd-mm-yyyy). */
  dayLabel: string
  /** سُجّل حضورُ اليوم — فيُنبَّه أنّه سيُمحى. */
  held: boolean
  /** تعبئةٌ مسبقة لتعديل بلاغٍ مرفوض. */
  initial?: { reason: OffReason, note: string | null } | null
}>()
const emit = defineEmits<{ confirm: [reason: OffReason, note: string | null] }>()
const open = defineModel<boolean>('open', { required: true })

const reason = ref<OffReason | null>(null)
const note = ref('')
const tried = ref(false)
watch(open, (o) => {
  if (!o) return
  reason.value = props.initial?.reason ?? null
  note.value = props.initial?.note ?? ''
  tried.value = false
})
const error = computed(() => offInputError(reason.value, note.value))
const ICONS: Record<OffReason, string> = {
  official_holiday: 'i-lucide-calendar-off',
  security: 'i-lucide-shield-alert',
  teacher_sick: 'i-lucide-thermometer',
  other: 'i-lucide-message-square-more'
}

function onConfirm() {
  tried.value = true
  if (error.value || !reason.value) return
  emit('confirm', reason.value, note.value)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="لم تنعقد الحلقة"
    :description="`يوم ${dayLabel} — اختر السبب، ويصل البلاغُ لمن يعتمده.`"
  >
    <template #body>
      <div class="om">
        <div
          v-if="held"
          class="om-warn"
          role="alert"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="size-5 shrink-0"
          />سيُمحى حضورُ هذا اليوم المسجَّل.
        </div>
        <div
          class="om-reasons"
          role="radiogroup"
          aria-label="سبب عدم الانعقاد"
        >
          <button
            v-for="r in OFF_REASONS"
            :key="r"
            type="button"
            role="radio"
            class="om-reason"
            :class="{ on: reason === r }"
            :aria-checked="reason === r"
            @click="reason = r"
          >
            <UIcon
              :name="ICONS[r]"
              class="size-5 shrink-0"
            />
            <span>{{ OFF_REASON_LABELS[r] }}</span>
          </button>
        </div>
        <UFormField :label="reason === 'other' ? 'ملاحظة (إلزاميةٌ مع «سبب آخر»)' : 'ملاحظة (اختياريّة)'">
          <UTextarea
            v-model="note"
            :rows="2"
            :maxlength="OFF_NOTE_MAX"
            autoresize
            class="w-full"
          />
        </UFormField>
        <p
          v-if="tried && error"
          class="om-error"
          role="alert"
        >
          {{ error }}
        </p>
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
          label="تأكيد"
          icon="i-lucide-check"
          color="primary"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.om { display: flex; flex-direction: column; gap: 14px; }
.om-warn { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 13px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 14.5px; font-weight: 600; }
.om-reasons { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.om-reason { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; border-radius: 13px; border: 1.5px solid var(--line-2); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 15px; font-weight: 600; text-align: start; cursor: pointer; transition: border-color .12s, background .12s; }
.om-reason:active { transform: scale(.98); }
.om-reason.on { border-color: var(--blue); background: var(--blue-soft); color: var(--ink); box-shadow: inset 0 0 0 1px var(--blue); }
.om-reason:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.om-error { margin: 0; font-size: 14px; font-weight: 600; color: var(--err); }
</style>
