<script setup lang="ts">
/**
 * لوحةُ بلاغ «لم تنعقد الحلقة» في «الحضور اليوميّ» للمعتمِدين والمطّلعين (2026-10-30): السببُ والملاحظةُ والحالةُ ومن بلّغ
 * ومتى. وللمعتمِد «قبول» و«رفض» — ومع الرفض حقلُ «سبب الرفض (اختياري)» يراه المعلّم — ويصحّح قرارَه بعكسه ما دام الشهرُ
 * يسمح. غيرُ المعتمِدين (المديرةُ الإدارية على بنين، ومشرفُ المشروع، والمختبِر) قراءةٌ فقط. الحكمُ للخادم.
 */
import { formatVisitMoment } from '~/utils/visitStatus'
import { OFF_NOTE_MAX, OFF_REASON_LABELS, offStatusLabel } from '~/utils/offDays'
import type { DayOffReport } from '~/composables/useAttendanceDay'

const props = defineProps<{
  /** اليومُ معروضاً (dd-mm-yyyy). */
  dayLabel: string
  off: DayOffReport
  /** القبولُ والرفض متاحان لهذا المستخدم على هذه الحلقة (`canReviewOffDayRole`). */
  canReview: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ review: [approve: boolean, note: string | null] }>()

const rejecting = ref(false)
const reviewNote = ref('')
// تبديلُ اليوم أو الحلقة يعيد اللوحةَ بلاغاً آخر: لا يبقى نموذجُ رفضٍ مفتوحٌ لغيره
watch(() => props.off.id, () => {
  rejecting.value = false
  reviewNote.value = ''
})

const status = computed(() => offStatusLabel({ ...props.off, queued: false }))
const reportedLine = computed(() => {
  const who = props.off.reporterName ? `بلّغ ${props.off.reporterName}` : 'بلاغ'
  return `${who} · ${formatVisitMoment(props.off.reportedAt)}`
})

function approve() {
  emit('review', true, null)
}
function confirmReject() {
  emit('review', false, reviewNote.value)
}
</script>

<template>
  <section
    class="orp"
    :class="off.status"
    aria-label="بلاغ لم تنعقد الحلقة"
  >
    <div class="orp-head">
      <UIcon
        :name="off.status === 'rejected' ? 'i-lucide-circle-x' : off.status === 'approved' ? 'i-lucide-calendar-x' : 'i-lucide-hourglass'"
        class="size-6 shrink-0"
      />
      <div class="orp-text">
        <b>لم تنعقد الحلقة يوم <bdi>{{ dayLabel }}</bdi> — {{ OFF_REASON_LABELS[off.reason] }}</b>
        <span class="orp-status">{{ status }}</span>
      </div>
    </div>
    <p
      v-if="off.note"
      class="orp-note"
    >
      {{ off.note }}
    </p>
    <p class="orp-by">
      {{ reportedLine }}
    </p>
    <p
      v-if="off.status === 'rejected' && off.reviewNote"
      class="orp-review"
    >
      سببُ الرفض: {{ off.reviewNote }}
    </p>

    <template v-if="canReview">
      <div
        v-if="rejecting"
        class="orp-form"
      >
        <UFormField label="سبب الرفض (اختياري)">
          <UTextarea
            v-model="reviewNote"
            :rows="2"
            :maxlength="OFF_NOTE_MAX"
            autoresize
            class="w-full"
          />
        </UFormField>
        <div class="orp-acts">
          <UButton
            label="تأكيد الرفض"
            icon="i-lucide-x"
            color="error"
            size="lg"
            :loading="busy"
            :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
            @click="confirmReject"
          />
          <UButton
            label="تراجع"
            color="neutral"
            variant="ghost"
            size="lg"
            :disabled="busy"
            :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
            @click="rejecting = false"
          />
        </div>
      </div>
      <div
        v-else
        class="orp-acts"
      >
        <UButton
          v-if="off.status !== 'approved'"
          label="قبول"
          icon="i-lucide-check"
          color="primary"
          size="lg"
          :loading="busy"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
          @click="approve"
        />
        <UButton
          v-if="off.status !== 'rejected'"
          label="رفض"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          size="lg"
          :disabled="busy"
          :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
          @click="rejecting = true"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.orp { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; margin-bottom: 14px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); }
.orp.pending { background: var(--chip-warn-bg); color: var(--chip-warn-ink); border-color: color-mix(in srgb, var(--chip-warn-ink) 30%, transparent); }
.orp.rejected { background: var(--err-soft); color: var(--err); border-color: color-mix(in srgb, var(--err) 35%, transparent); }
.orp-head { display: flex; align-items: center; gap: 12px; }
.orp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.orp-text b { font-size: 15.5px; font-weight: 700; color: var(--ink); line-height: 1.6; }
.orp-text bdi { font-variant-numeric: tabular-nums; }
.orp-status { font-size: 13.5px; font-weight: 600; }
.orp-note, .orp-by, .orp-review { margin: 0; font-size: 14px; line-height: 1.7; color: var(--ink-2); }
.orp-by { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.orp-review { font-weight: 600; color: var(--err); }
.orp-form { display: flex; flex-direction: column; gap: 10px; }
.orp-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
@media (max-width: 520px) {
  .orp-acts :deep(button) { flex: 1 1 100%; }
}
</style>
