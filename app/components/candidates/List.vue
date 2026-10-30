<script setup lang="ts">
/**
 * قائمةُ المرشّحين (طلب المستخدم 2026-10-30): الاسمُ والجوال، والجنسُ والأجزاء ومنطقةُ الحلقة، وعلامةُ «لا تنطبق الشروط»،
 * والحالة، وموعدُ المقابلة، ومتوسّطُ اللجنة.
 * للمدير: تحديدٌ متعدّد للدعوة دفعةً واحدة. الضغطُ على الصفّ يفتح ملفّ المرشّح.
 */
import type { Candidate } from '~/composables/useCandidates'
import { CANDIDATE_PASS_MARK, CANDIDATE_STATUS_COLOR, CANDIDATE_STATUS_LABEL } from '~/constants/candidates'
import { averageScore, eligibilityIssues } from '~/utils/candidates'

const props = defineProps<{ rows: Candidate[], selectable: boolean, me: string | null }>()
const emit = defineEmits<{ open: [c: Candidate] }>()
const selected = defineModel<string[]>('selected', { default: () => [] })

const toggle = (id: string) => (selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id])
const allOn = computed(() => props.rows.length > 0 && props.rows.every(r => selected.value.includes(r.id)))
const toggleAll = () => (selected.value = allOn.value ? [] : props.rows.map(r => r.id))
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ' ·')
const flags = computed(() => Object.fromEntries(props.rows.map(r => [r.id, eligibilityIssues(r)])))
const mineDone = (c: Candidate) => !!props.me && c.evaluations.some(e => e.evaluator_id === props.me)
</script>

<template>
  <div class="cl">
    <div
      v-if="selectable && rows.length"
      class="cl-all"
    >
      <UCheckbox
        :model-value="allOn"
        label="تحديد الكل"
        @update:model-value="toggleAll"
      />
    </div>
    <ul class="cl-list">
      <li
        v-for="c in rows"
        :key="c.id"
        class="cl-row"
        :class="{ on: selected.includes(c.id) }"
      >
        <UCheckbox
          v-if="selectable"
          :model-value="selected.includes(c.id)"
          :aria-label="`تحديد ${c.full_name}`"
          @update:model-value="toggle(c.id)"
        />
        <button
          type="button"
          class="cl-main"
          @click="emit('open', c)"
        >
          <span class="cl-name">
            <b>{{ c.full_name }}</b>
            <small><bdi dir="ltr">{{ c.phone }}</bdi> · {{ c.gender === 'female' ? 'أنثى' : 'ذكر' }}<template v-if="c.quran_parts != null"> · {{ c.quran_parts }} جزءاً</template><template v-if="c.halaqa_area"> · {{ c.halaqa_area }}</template></small>
          </span>
          <span class="cl-meta">
            <span
              v-if="flags[c.id]?.length"
              class="cl-flag"
              :title="flags[c.id]?.join('، ')"
            ><UIcon
              name="i-lucide-triangle-alert"
              class="size-3.5"
            />لا تنطبق الشروط</span>
            <UBadge
              :label="CANDIDATE_STATUS_LABEL[c.status]"
              :color="CANDIDATE_STATUS_COLOR[c.status]"
              variant="soft"
            />
            <span
              v-if="c.interview_at"
              class="cl-when"
            ><UIcon
              name="i-lucide-calendar"
              class="size-3.5"
            /><bdi dir="ltr">{{ when(c.interview_at) }}</bdi></span>
            <span
              v-if="averageScore(c.evaluations) !== null"
              class="cl-score"
              :class="{ pass: (averageScore(c.evaluations) ?? 0) >= CANDIDATE_PASS_MARK }"
            >{{ averageScore(c.evaluations) }} · {{ c.evaluations.length }} تقييم</span>
            <span
              v-else-if="c.committee.includes(me ?? '') && !mineDone(c)"
              class="cl-todo"
            >بانتظار تقييمك</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cl { display: flex; flex-direction: column; gap: 8px; }
.cl-all { padding: 0 14px; }
.cl-list { list-style: none; margin: 0; padding: 0; background: var(--surface); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
.cl-row { display: flex; align-items: center; gap: 12px; padding: 0 14px; border-top: 1px solid var(--line); }
.cl-row:first-child { border-top: 0; }
.cl-row.on { background: var(--blue-soft); }
.cl-main {
  flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap;
  padding: 12px 0; background: none; border: 0; font: inherit; color: inherit; text-align: start; cursor: pointer;
}
.cl-main:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 8px; }
.cl-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cl-name b { font-weight: 600; color: var(--ink); }
.cl-name small { color: var(--ink-3); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.cl-meta { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.cl-when { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cl-score { font-size: 13px; font-weight: 700; color: var(--err); font-variant-numeric: tabular-nums; }
.cl-score.pass { color: var(--green-ink); }
.cl-flag { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--err); background: var(--err-soft); padding: 2px 10px; border-radius: 999px; }
.cl-todo { font-size: 12.5px; font-weight: 600; color: var(--chip-warn-ink); background: var(--chip-warn-bg); padding: 2px 10px; border-radius: 999px; }
@media (hover: hover) {
  .cl-row:hover { background: var(--bg); }
  .cl-row.on:hover { background: var(--blue-soft); }
}
</style>
