<script setup lang="ts">
/**
 * تفصيلُ علامة الطالب واختباراتُه السابقة (طلبا المستخدم 2026-10-22): يُفتح بالضغط على العلامة في «نتائج الطلاب».
 * أعلاه سجلُّ اختبارات الطالب كلُّها (ما يسمح به نطاق الناظر — RLS) بالأحدث، والمختارُ يُفصَّل: ثلاثةُ أسئلةٍ
 * بفروعها (الحفظ والفهم والتدبّر، من 10)، والتجويدُ (من 9)، ومجموعُ كلّ فرعٍ عبر الأسئلة، وحدُّ الاجتياز يومَها،
 * والمختبِرُ وملاحظاتُه. الحسابُ في `utils/examBreakdown.ts`.
 */
import type { Database } from '~/types/database.types'
import type { ExamCycleRow } from '~/utils/exams/cycles'
import { toExamCycle } from '~/utils/exams/cycles'
import { examTargetText } from '~/utils/exams/nomination'
import { BRANCH_MAX, TAJWEED_MAX, branchTotals, examBreakdown, type ScoreRow } from '~/utils/examBreakdown'
import { EXAM_MAX_TOTAL } from '~/constants/exams'

const props = defineProps<{ studentId: string | null, studentName: string, resultId: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()

type HistoryRow = ScoreRow & {
  id: string
  exam_date: string
  total_score: number | null
  passed: boolean | null
  pass_mark_snapshot: number
  notes: string | null
  examiner: { full_name: string } | null
  exam_list_item: { exam_cycle: ExamCycleRow | null } | null
}

const history = ref<HistoryRow[]>([])
const loading = ref(false)
const selectedId = ref<string | null>(null)

watch([open, () => props.studentId, () => props.resultId], async ([isOpen, sid, rid]) => {
  if (!isOpen || !sid) return
  selectedId.value = rid
  loading.value = true
  const { data, error } = await supabase.from('exam_results')
    .select('id, exam_date, total_score, passed, pass_mark_snapshot, notes, q1_memorization, q1_understanding, q1_reflection, q2_memorization, q2_understanding, q2_reflection, q3_memorization, q3_understanding, q3_reflection, tajweed_score, examiner:examiner_id(full_name), exam_list_item:exam_list_item_id(exam_cycle:exam_cycle_id(id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order))')
    .eq('student_id', sid)
    .order('exam_date', { ascending: false })
    .returns<HistoryRow[]>()
  loading.value = false
  if (error) {
    handle(error)
    return
  }
  history.value = data ?? []
  if (!history.value.some(h => h.id === selectedId.value)) selectedId.value = history.value[0]?.id ?? null
}, { immediate: true })

const titleOf = (h: HistoryRow) => examTargetText(h.exam_list_item?.exam_cycle ? toExamCycle(h.exam_list_item.exam_cycle) : null)
const selected = computed(() => history.value.find(h => h.id === selectedId.value) ?? null)
const breakdown = computed(() => (selected.value ? examBreakdown(selected.value) : null))
const branches = computed(() => (selected.value ? branchTotals(selected.value) : []))
const day = (iso: string) => iso.split('-').reverse().join('-')
const passedCount = computed(() => history.value.filter(h => h.passed === true).length)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`اختبارات ${studentName}`"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="rd">
        <p
          v-if="loading && !history.length"
          class="rd-empty"
        >
          جارٍ التحميل…
        </p>
        <p
          v-else-if="!history.length"
          class="rd-empty"
        >
          لا اختبارات مرصودة لهذا الطالب.
        </p>
        <template v-else>
          <!-- سجلُّ الاختبارات: الضغطُ يفصّل -->
          <section>
            <h4 class="rd-h">
              كلُّ اختباراته
              <span class="rd-count">{{ history.length }}</span>
              <span class="rd-sub">اجتاز {{ passedCount }}</span>
            </h4>
            <ul class="rd-list">
              <li
                v-for="h in history"
                :key="h.id"
              >
                <button
                  type="button"
                  class="rd-item"
                  :class="{ on: h.id === selectedId }"
                  :aria-pressed="h.id === selectedId"
                  @click="selectedId = h.id"
                >
                  <span class="rd-item-main">
                    <span class="rd-item-title">{{ titleOf(h).title }}</span>
                    <span class="rd-item-sub">{{ titleOf(h).detail }} · <bdi dir="ltr">{{ day(h.exam_date) }}</bdi></span>
                  </span>
                  <span class="rd-score"><b>{{ h.total_score ?? '—' }}</b>/{{ EXAM_MAX_TOTAL }}</span>
                  <UBadge
                    :label="h.passed ? 'مجتاز' : 'غير مجتاز'"
                    :color="h.passed ? 'success' : 'error'"
                    variant="soft"
                  />
                </button>
              </li>
            </ul>
          </section>

          <!-- تفصيلُ المختار -->
          <section
            v-if="selected && breakdown"
            class="rd-detail"
            aria-live="polite"
          >
            <header class="rd-detail-head">
              <div>
                <h4>{{ titleOf(selected).title }}</h4>
                <p>
                  {{ titleOf(selected).detail }} · <bdi dir="ltr">{{ day(selected.exam_date) }}</bdi>
                  <template v-if="selected.examiner">
                    · المختبِر {{ selected.examiner.full_name }}
                  </template>
                </p>
              </div>
              <span
                class="rd-total"
                :class="selected.passed ? 'ok' : 'no'"
              >
                <b>{{ breakdown.total }}</b><small>من {{ EXAM_MAX_TOTAL }} · الاجتياز {{ selected.pass_mark_snapshot }}</small>
              </span>
            </header>

            <div class="rd-qs">
              <div
                v-for="q in breakdown.questions"
                :key="q.title"
                class="rd-q"
              >
                <div class="rd-q-head">
                  <span>{{ q.title }}</span><b>{{ q.sum }}<small>/{{ q.max }}</small></b>
                </div>
                <ul>
                  <li
                    v-for="b in q.branches"
                    :key="b.label"
                  >
                    <span>{{ b.label }}</span>
                    <span class="rd-bar"><i :style="{ width: `${(b.score / BRANCH_MAX) * 100}%` }" /></span>
                    <b>{{ b.score }}</b>
                  </li>
                </ul>
              </div>
              <div class="rd-q">
                <div class="rd-q-head">
                  <span>التجويد</span><b>{{ breakdown.tajweed }}<small>/{{ TAJWEED_MAX }}</small></b>
                </div>
                <p class="rd-q-note">
                  الدرجةُ من 7 إلى 9.
                </p>
              </div>
            </div>

            <div class="rd-branches">
              <span
                v-for="b in branches"
                :key="b.label"
              >{{ b.label }} في الأسئلة كلّها <b>{{ b.score }}</b>/{{ b.max }}</span>
            </div>

            <p
              v-if="selected.notes"
              class="rd-notes"
            >
              <b>ملاحظات المختبِر:</b> {{ selected.notes }}
            </p>
          </section>
        </template>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 16px; }
.rd-empty { margin: 0; padding: 20px; border-radius: 13px; background: var(--surface-2); text-align: center; color: var(--ink-2); }
.rd-h { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--ink); }
.rd-count { min-width: 24px; padding: 0 8px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 12.5px; text-align: center; line-height: 22px; }
.rd-sub { margin-inline-start: auto; font-size: 12.5px; font-weight: 600; color: var(--green-ink); }
.rd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
.rd-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); text-align: start; font: inherit; color: inherit; cursor: pointer; }
.rd-item:hover { border-color: var(--blue); }
.rd-item.on { border-color: var(--blue); background: var(--blue-soft); }
.rd-item:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.rd-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rd-item-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.rd-item-sub { font-size: 12.5px; color: var(--ink-3); }
.rd-score { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rd-score b { font-size: 16px; color: var(--ink); }

.rd-detail { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 16px; border: 1px solid var(--line-2); background: var(--surface-2); }
.rd-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rd-detail-head h4 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.rd-detail-head p { margin: 3px 0 0; font-size: 13px; color: var(--ink-2); }
.rd-total { flex: none; display: flex; flex-direction: column; align-items: center; padding: 6px 14px; border-radius: 12px; color: var(--on-primary); }
.rd-total.ok { background: var(--green-ink); }
.rd-total.no { background: var(--err); }
.rd-total b { font-size: 24px; line-height: 1.15; font-variant-numeric: tabular-nums; }
.rd-total small { font-size: 11.5px; opacity: .9; white-space: nowrap; }
.rd-qs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.rd-q { padding: 10px 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.rd-q-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; font-size: 14px; font-weight: 700; color: var(--ink); }
.rd-q-head b { font-size: 17px; font-variant-numeric: tabular-nums; }
.rd-q-head small { font-size: 12px; color: var(--ink-3); font-weight: 500; }
.rd-q ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.rd-q li { display: grid; grid-template-columns: 52px 1fr 24px; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); }
.rd-q li b { text-align: end; color: var(--ink); font-variant-numeric: tabular-nums; }
.rd-bar { height: 7px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.rd-bar i { display: block; height: 100%; border-radius: 99px; background: var(--blue); }
.rd-q-note { margin: 0; font-size: 12.5px; color: var(--ink-3); }
.rd-branches { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--ink-2); }
.rd-branches b { color: var(--ink); font-variant-numeric: tabular-nums; }
.rd-notes { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--surface); font-size: 13.5px; line-height: 1.8; color: var(--ink); white-space: pre-wrap; }
@media (max-width: 560px) {
  .rd-qs { grid-template-columns: 1fr; }
  .rd-item { flex-wrap: wrap; }
}
</style>
