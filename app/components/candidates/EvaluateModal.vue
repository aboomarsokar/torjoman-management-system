<script setup lang="ts">
/**
 * تقييمُ عضو اللجنة لمرشّحٍ من حسابه (طلب المستخدم 2026-10-30): البنودُ العشرة كلٌّ من 0 إلى 5 بأزرارٍ كبيرة، والمجموعُ
 * بالأوزان من 100 يتحدّث مباشرةً، وملاحظة. يُعبّأ بتقييمه السابق إن وُجد.
 */
import type { Candidate } from '~/composables/useCandidates'
import { CANDIDATE_CRITERIA, CRITERION_MAX, MAX_CANDIDATE_LONG } from '~/constants/candidates'
import { weightedScore } from '~/utils/candidates'

const props = defineProps<{ candidate: Candidate | null, evaluatorId: string | null, busy: boolean }>()
const emit = defineEmits<{ save: [scores: (number | null)[], notes: string] }>()
const open = defineModel<boolean>('open', { required: true })

const scores = ref<(number | null)[]>([])
const notes = ref('')
watch(open, (o) => {
  if (!o || !props.candidate) return
  const mine = props.candidate.evaluations.find(e => e.evaluator_id === props.evaluatorId)
  scores.value = mine ? [...mine.scores] : CANDIDATE_CRITERIA.map(() => null)
  notes.value = mine?.notes ?? ''
})
const steps = Array.from({ length: CRITERION_MAX + 1 }, (_, i) => i)
const complete = computed(() => scores.value.every(s => s !== null))
const total = computed(() => weightedScore(scores.value.map(s => s ?? 0)))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="candidate ? `تقييم ${candidate.full_name}` : 'تقييم'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="ev">
        <div
          v-for="(c, i) in CANDIDATE_CRITERIA"
          :key="c.key"
          class="ev-row"
        >
          <div class="ev-label">
            <b>{{ c.label }}</b>
            <span>الوزن {{ c.weight }}</span>
          </div>
          <div
            class="ev-steps"
            role="radiogroup"
            :aria-label="c.label"
          >
            <button
              v-for="n in steps"
              :key="n"
              type="button"
              role="radio"
              :aria-checked="scores[i] === n"
              class="ev-step"
              :class="{ on: scores[i] === n }"
              @click="scores[i] = n"
            >
              {{ n }}
            </button>
          </div>
        </div>
        <UFormField
          label="ملاحظات"
          :hint="`${notes.trim().length}/${MAX_CANDIDATE_LONG}`"
        >
          <UTextarea
            v-model="notes"
            :rows="2"
            autoresize
            class="w-full"
            :maxlength="MAX_CANDIDATE_LONG"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="ev-foot">
        <span class="ev-total">المجموع <b dir="ltr">{{ total }}</b> من 100<template v-if="!complete"> · بقيت بنود</template></span>
        <div class="flex gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            label="احفظ التقييم"
            icon="i-lucide-check"
            color="primary"
            :loading="busy"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="emit('save', [...scores], notes)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.ev { display: flex; flex-direction: column; gap: 4px; }
.ev-row { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px solid var(--line); }
.ev-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ev-label b { font-weight: 600; color: var(--ink); }
.ev-label span { font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.ev-steps { display: flex; gap: 6px; }
.ev-step {
  width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
  color: var(--ink-2); font: inherit; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer;
  transition: background-color .15s var(--ease-out), color .15s var(--ease-out);
}
.ev-step:hover { border-color: var(--blue); }
.ev-step.on { background: var(--navy); border-color: var(--navy); color: var(--on-primary); }
.ev-step:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.ev-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
.ev-total { color: var(--ink-2); font-size: 14px; }
.ev-total b { font-size: 22px; color: var(--ink); font-variant-numeric: tabular-nums; }
@media (max-width: 560px) {
  .ev-steps { width: 100%; justify-content: space-between; }
}
</style>
