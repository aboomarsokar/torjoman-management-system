<script setup lang="ts">
/**
 * شريطُ يومٍ فيه بلاغ «لم تنعقد الحلقة» (2026-10-30) بدل قائمة الطلاب في شاشة المعلّم: «لم تنعقد الحلقة يوم … — السبب ·
 * الحالة» وملاحظتُه، وسببُ الرفض إن وُجد. والأزرار ما دام البلاغُ غيرَ معتمَد: «تراجع — الحلقة انعقدت»، ومع الرفض
 * «تراجع وسجّل الحضور» و«عدّل البلاغ». القرارُ في `useOfflineAttendance` والشريطُ يعرض ويُبلغ.
 */
import { OFF_REASON_LABELS, offStatusLabel, type ShownOff } from '~/utils/offDays'

const props = defineProps<{
  /** اليومُ معروضاً (dd-mm-yyyy). */
  dayLabel: string
  off: ShownOff
  /** «تراجع» متاح (صاحبُ الحلقة، والبلاغُ غيرُ معتمَد، والشهرُ غيرُ معتمَد) — وبغيره لا أزرارَ أصلاً. */
  canWithdraw: boolean
  /** «عدّل البلاغ» متاح (اليومُ يقبل البلاغ). */
  canEdit: boolean
  /** سببُ منع التعديل ظاهراً تحت الزرّ حين يُعطَّل (لا يُخفى)، أو `null`. */
  editBlock?: string | null
  busy?: boolean
}>()
const emit = defineEmits<{ withdraw: [], edit: [] }>()

/** لونُ الشريط بالحالة: على الجهاز · معلّق · معتمَد · مرفوض. */
const tone = computed(() => props.off.queued ? 'queued' : props.off.status)
const icon = computed(() => props.off.queued
  ? 'i-lucide-cloud-upload'
  : props.off.status === 'rejected' ? 'i-lucide-circle-x' : 'i-lucide-calendar-x')
</script>

<template>
  <section
    class="ob"
    :class="tone"
    aria-label="بلاغ لم تنعقد الحلقة"
  >
    <div class="ob-head">
      <UIcon
        :name="icon"
        class="size-6 shrink-0"
      />
      <div class="ob-text">
        <b>لم تنعقد الحلقة يوم <bdi>{{ dayLabel }}</bdi> — {{ OFF_REASON_LABELS[off.reason] }}</b>
        <span class="ob-status">{{ offStatusLabel(off) }}</span>
      </div>
    </div>
    <p
      v-if="off.note"
      class="ob-note"
    >
      {{ off.note }}
    </p>
    <p
      v-if="off.status === 'rejected' && off.reviewNote"
      class="ob-review"
    >
      سببُ الرفض: {{ off.reviewNote }}
    </p>
    <div
      v-if="canWithdraw"
      class="ob-acts"
    >
      <UButton
        :label="off.status === 'rejected' ? 'تراجع وسجّل الحضور' : 'تراجع — الحلقة انعقدت'"
        icon="i-lucide-undo-2"
        color="neutral"
        variant="outline"
        size="lg"
        :loading="busy"
        :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
        @click="emit('withdraw')"
      />
      <UButton
        v-if="off.status === 'rejected'"
        label="عدّل البلاغ"
        icon="i-lucide-pencil"
        color="primary"
        size="lg"
        :disabled="!canEdit || busy"
        :ui="{ base: 'min-h-11 rounded-xl font-semibold justify-center' }"
        @click="emit('edit')"
      />
      <small
        v-if="off.status === 'rejected' && !canEdit && editBlock"
        class="ob-block"
      >{{ editBlock }}</small>
    </div>
  </section>
</template>

<style scoped>
.ob { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-2); }
.ob.queued { background: var(--blue-soft); color: var(--blue-ink); border-color: color-mix(in srgb, var(--blue) 35%, transparent); }
.ob.pending { background: var(--chip-warn-bg); color: var(--chip-warn-ink); border-color: color-mix(in srgb, var(--chip-warn-ink) 30%, transparent); }
.ob.rejected { background: var(--err-soft); color: var(--err); border-color: color-mix(in srgb, var(--err) 35%, transparent); }
.ob-head { display: flex; align-items: center; gap: 12px; }
.ob-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ob-text b { font-size: 15.5px; font-weight: 700; color: var(--ink); line-height: 1.6; }
.ob-text bdi { font-variant-numeric: tabular-nums; }
.ob-status { font-size: 13.5px; font-weight: 600; }
.ob-note, .ob-review { margin: 0; font-size: 14px; line-height: 1.7; color: var(--ink-2); }
.ob-review { font-weight: 600; color: var(--err); }
.ob-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.ob-block { flex: 1 1 100%; font-size: 12.5px; font-weight: 600; color: var(--ink-2); line-height: 1.5; }
@media (max-width: 520px) {
  .ob-acts :deep(button) { flex: 1 1 100%; }
}
</style>
