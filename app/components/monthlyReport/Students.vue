<script setup lang="ts">
/**
 * جدولُ طلاب الحلقة في التقرير الشهريّ: الحضور (وبعذر)، والمحفوظ، والمطلوب وحكمُه، واختبارُ الشهر، واختبارُ القراءة —
 * سطرٌ لكلّ طالب. لا منطقَ هنا غيرُ العرض.
 */
import type { StudentMonthRow } from '~/utils/quran/month'
import type { ExamItem, ReadingItem } from '~/utils/monthlyReport'
import { OUTCOME_COLORS, planBadge } from '~/utils/quran/screen'

interface Props {
  rows: StudentMonthRow[]
  exams: ExamItem[]
  reading: ReadingItem[]
}
const props = defineProps<Props>()

const examBy = computed(() => new Map(props.exams.map(e => [e.studentId, e])))
const readingBy = computed(() => new Map(props.reading.map(r => [r.studentId, r])))
const passWord = (p: boolean | null) => p === true ? 'ناجح' : p === false ? 'يعيد' : 'بلا حكم'
</script>

<template>
  <section class="mst card">
    <h2>الطلاب</h2>
    <div class="mst-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الطالب</th>
            <th>الحضور</th>
            <th>المحفوظ</th>
            <th>المطلوب والحكم</th>
            <th>اختبار الشهر</th>
            <th>القراءة</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in rows"
            :key="r.studentId"
          >
            <td class="num">
              {{ i + 1 }}
            </td>
            <td class="name">
              {{ r.name }}
            </td>
            <td>
              {{ r.daysHeld ? `${r.daysAttended} من ${r.daysHeld}` : '—' }}<span
                v-if="r.daysExcused"
                class="muted"
              > · بعذر {{ r.daysExcused }}</span>
            </td>
            <td>{{ r.record ? `${r.record.pagesMemorized} صفحة` : '—' }}</td>
            <td>
              <UBadge
                :color="OUTCOME_COLORS[r.outcome]"
                variant="soft"
                :label="planBadge(r)"
              />
            </td>
            <td>
              <template v-if="examBy.get(r.studentId)">
                {{ examBy.get(r.studentId)!.label }} · {{ passWord(examBy.get(r.studentId)!.passed) }}
              </template>
              <span
                v-else
                class="muted"
              >—</span>
            </td>
            <td>
              <template v-if="readingBy.get(r.studentId)">
                {{ readingBy.get(r.studentId)!.unit }} · {{ readingBy.get(r.studentId)!.passed ? 'اجتاز' : 'لم يجتز' }}
              </template>
              <span
                v-else
                class="muted"
              >—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.mst h2 { margin: 0 0 12px; font-size: 17px; color: var(--ink); }
.mst-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 760px; }
th { text-align: start; font-weight: 600; color: var(--ink-3); padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
td { padding: 9px 10px; border-bottom: 1px solid var(--line); color: var(--ink-2); vertical-align: middle; }
.num { color: var(--ink-3); font-variant-numeric: tabular-nums; }
.name { color: var(--ink); font-weight: 600; white-space: nowrap; }
.muted { color: var(--ink-3); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; }
</style>
