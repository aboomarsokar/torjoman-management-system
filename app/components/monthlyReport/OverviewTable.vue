<script setup lang="ts">
/**
 * جدولُ الحلقات في التقرير الشهريّ العامّ: سطرٌ لكلّ حلقة ومجموعٌ في آخره، والأعمدةُ الرقمية تُرتَّب بالضغط على عنوانها
 * (ضغطةٌ ثانية تعكس الاتجاه، و`aria-sort` يعلنه). إنجازُ المعلم — المقياسُ الحاكم — في شارةٍ ملوّنة بعتبته، والباقي نصٌّ
 * ملوّنٌ هادئ. الضغطُ على السطر (أو Enter) يفتح تفصيلَ الحلقة (`pick`).
 */
import { sortOverview, type OverviewRow, type OverviewSortKey } from '~/utils/monthlyOverview'
import { VISITS_PER_MONTH } from '~/utils/monthVisits'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

interface Props {
  rows: OverviewRow[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ pick: [id: string] }>()

const sortKey = ref<OverviewSortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
/** الضغطُ على العنوان: الأعمدةُ الرقمية تبدأ بالأعلى، والاسمُ أبجديّاً؛ والضغطُ ثانيةً يعكس. */
function sortBy(key: OverviewSortKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}
const ariaSort = (key: OverviewSortKey) => sortKey.value === key ? (sortDir.value === 'asc' ? 'ascending' : 'descending') : 'none'
const sorted = computed(() => sortOverview(props.rows, sortKey.value, sortDir.value))

const totals = computed(() => props.rows.reduce((t, r) => ({
  students: t.students + r.students,
  done: t.done + r.done,
  near: t.near + r.near,
  short: t.short + r.short,
  absentee: t.absentee + r.absentee,
  exams: t.exams + r.exams.total,
  examsPassed: t.examsPassed + r.exams.passed,
  reading: t.reading + r.reading.total,
  readingPassed: t.readingPassed + r.reading.passed,
  visits: t.visits + (r.visits?.done.length ?? 0)
}), { students: 0, done: 0, near: 0, short: 0, absentee: 0, exams: 0, examsPassed: 0, reading: 0, readingPassed: 0, visits: 0 }))

const status = (r: OverviewRow) => (r.report_status ?? 'none') as keyof typeof REPORT_STATUS_LABELS
const visitTone = (r: OverviewRow) => (r.visits?.done.length ?? 0) >= VISITS_PER_MONTH ? 'ok' : r.visits?.done.length ? 'warn' : 'bad'
const pctTone = (p: number | null) => p === null ? '' : p >= 75 ? 'ok' : p >= 50 ? 'warn' : 'bad'

const SORTABLE: { key: OverviewSortKey, label: string }[] = [
  { key: 'students', label: 'الطلاب' },
  { key: 'attendance', label: 'الحضور' }
]
</script>

<template>
  <div class="ot">
    <table>
      <thead>
        <tr>
          <th class="c-num">
            #
          </th>
          <th :aria-sort="ariaSort('name')">
            <button
              type="button"
              class="sort"
              :class="{ on: sortKey === 'name' }"
              @click="sortBy('name')"
            >
              الحلقة<UIcon
                :name="sortKey === 'name' && sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                class="sort-ico"
              />
            </button>
          </th>
          <th
            v-for="c in SORTABLE"
            :key="c.key"
            :aria-sort="ariaSort(c.key)"
          >
            <button
              type="button"
              class="sort"
              :class="{ on: sortKey === c.key }"
              @click="sortBy(c.key)"
            >
              {{ c.label }}<UIcon
                :name="sortKey === c.key && sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                class="sort-ico"
              />
            </button>
          </th>
          <th>أنجز · قريب · مقصّر</th>
          <th>كثير الغياب</th>
          <th :aria-sort="ariaSort('teacher')">
            <button
              type="button"
              class="sort"
              :class="{ on: sortKey === 'teacher' }"
              @click="sortBy('teacher')"
            >
              إنجاز المعلم<UIcon
                :name="sortKey === 'teacher' && sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                class="sort-ico"
              />
            </button>
          </th>
          <th>الاختبارات</th>
          <th>القراءة</th>
          <th :aria-sort="ariaSort('visits')">
            <button
              type="button"
              class="sort"
              :class="{ on: sortKey === 'visits' }"
              @click="sortBy('visits')"
            >
              الزيارات<UIcon
                :name="sortKey === 'visits' && sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                class="sort-ico"
              />
            </button>
          </th>
          <th>حالة التقرير</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in sorted"
          :key="r.halaqa_id"
          tabindex="0"
          :aria-label="`تفصيل ${r.halaqa_name}`"
          @click="emit('pick', r.halaqa_id)"
          @keydown.enter="emit('pick', r.halaqa_id)"
        >
          <td class="c-num">
            {{ i + 1 }}
          </td>
          <td class="name">
            {{ r.halaqa_name }}<span class="sub">{{ r.teacher_name ?? '—' }}</span>
          </td>
          <td class="n">
            {{ r.students }}
          </td>
          <td
            class="n"
            :class="pctTone(r.attendancePct)"
          >
            {{ r.attendancePct === null ? '—' : `${r.attendancePct}%` }}
          </td>
          <td class="n">
            <span class="ok">{{ r.done }}</span><span class="sep">·</span><span class="warn">{{ r.near }}</span><span class="sep">·</span><span class="bad">{{ r.short }}</span>
          </td>
          <td class="n">
            {{ r.absentee || '—' }}
          </td>
          <td>
            <span
              v-if="r.teacherPct !== null"
              class="pill"
              :class="pctTone(r.teacherPct)"
            >{{ r.teacherPct }}%</span>
            <span
              v-else
              class="muted"
            >—</span>
          </td>
          <td class="n">
            {{ r.exams.total ? `${r.exams.passed} من ${r.exams.total}` : '—' }}
          </td>
          <td class="n">
            {{ r.reading.total ? `${r.reading.passed} من ${r.reading.total}` : '—' }}
          </td>
          <td
            class="n"
            :class="visitTone(r)"
          >
            {{ r.visits?.done.length ?? 0 }} من {{ VISITS_PER_MONTH }}<span
              v-if="r.visits?.avg"
              class="sub"
            >معدّل {{ r.visits.avg }}</span>
          </td>
          <td>
            <UBadge
              :label="REPORT_STATUS_LABELS[status(r)]"
              :color="REPORT_STATUS_COLORS[status(r)]"
              variant="soft"
            />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td />
          <td>المجموع ({{ rows.length }})</td>
          <td class="n">
            {{ totals.students }}
          </td>
          <td />
          <td class="n">
            {{ totals.done }}<span class="sep">·</span>{{ totals.near }}<span class="sep">·</span>{{ totals.short }}
          </td>
          <td class="n">
            {{ totals.absentee }}
          </td>
          <td />
          <td class="n">
            {{ totals.examsPassed }} من {{ totals.exams }}
          </td>
          <td class="n">
            {{ totals.readingPassed }} من {{ totals.reading }}
          </td>
          <td class="n">
            {{ totals.visits }}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.ot { overflow-x: auto; margin-inline: -20px; padding-inline: 20px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 940px; }
th { text-align: start; font-weight: 600; font-size: 13px; color: var(--ink-3); padding: 10px; border-bottom: 1px solid var(--line); line-height: 1.4; vertical-align: bottom; white-space: nowrap; }
td { padding: 12px 10px; border-bottom: 1px solid var(--line); color: var(--ink-2); white-space: nowrap; vertical-align: middle; }
tbody tr { cursor: pointer; transition: background .15s; }
tbody tr:hover { background: var(--surface-2); }
tbody tr:focus-visible { background: var(--surface-2); outline: 2px solid var(--blue); outline-offset: -2px; }
tfoot td { font-weight: 600; color: var(--ink); border-bottom: 0; padding-block: 14px; }
.c-num { inline-size: 36px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.n { font-variant-numeric: tabular-nums; }
.name { color: var(--ink); font-weight: 600; }
.sub { display: block; font-size: 12.5px; font-weight: 400; color: var(--ink-3); }
.sep { margin-inline: 4px; color: var(--ink-3); }
.muted { color: var(--ink-3); }
.sort { display: inline-flex; align-items: center; gap: 4px; min-block-size: 32px; padding: 0; background: none; border: 0; font: inherit; color: inherit; cursor: pointer; }
.sort:hover, .sort.on { color: var(--ink); }
.sort:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }
.sort-ico { inline-size: 14px; block-size: 14px; opacity: 0; transition: opacity .15s; }
.sort:hover .sort-ico, .sort.on .sort-ico { opacity: 1; }
.pill { display: inline-flex; align-items: center; min-inline-size: 52px; justify-content: center; padding: 3px 10px; border-radius: 999px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pill.ok { background: var(--chip-active-bg); }
.pill.warn { background: var(--chip-warn-bg); }
.pill.bad { background: var(--chip-late-bg); }
.ok { color: var(--chip-active-ink); }
.warn { color: var(--chip-warn-ink); }
.bad { color: var(--chip-late-ink); }
</style>
