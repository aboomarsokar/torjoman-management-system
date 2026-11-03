<script setup lang="ts">
/**
 * الجدولُ العامّ للتقرير الشهريّ: سطرٌ لكلّ حلقة (الحضور · أنجز/قريب/مقصّر/كثير الغياب · إنجازُ المعلم · الاختبارات ·
 * القراءة · الزيارات · حالُ الرصد)، ومجموعٌ في آخره؛ والضغطُ على السطر يفتح تفصيلَ الحلقة (`pick`). وفوقه بحثٌ بالمعلم أو
 * الحلقة وفلترا حالة التقرير والجنس (2026-11-03) — المجموعُ لما ظهر بعد التصفية.
 */
import { OVERVIEW_ALL, filterOverview, type OverviewRow } from '~/utils/monthlyOverview'
import { VISITS_PER_MONTH } from '~/utils/monthVisits'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

interface Props {
  rows: OverviewRow[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ pick: [id: string] }>()

const query = ref('')
const statusFilter = ref<string>(OVERVIEW_ALL)
const gender = ref<string>(OVERVIEW_ALL)
const shown = computed(() => filterOverview(props.rows, { query: query.value, status: statusFilter.value, gender: gender.value }))
const statusItems = computed(() => [
  { label: `كل الحالات (${props.rows.length})`, value: OVERVIEW_ALL },
  ...(['none', 'draft', 'submitted', 'approved'] as const).map(k => ({
    label: `${REPORT_STATUS_LABELS[k]} (${props.rows.filter(r => (r.report_status ?? 'none') === k).length})`,
    value: k
  }))
])
// فلترُ الجنس لمن يرى القسمين وحده
const bothGenders = computed(() => new Set(props.rows.map(r => r.gender)).size > 1)
const genderItems = computed(() => [
  { label: 'البنين والبنات', value: OVERVIEW_ALL },
  { label: `البنين (${props.rows.filter(r => r.gender === 'male').length})`, value: 'male' },
  { label: `البنات (${props.rows.filter(r => r.gender === 'female').length})`, value: 'female' }
])

const totals = computed(() => shown.value.reduce((t, r) => ({
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
</script>

<template>
  <section class="mo card">
    <h2>كلّ الحلقات</h2>
    <p class="mo-hint">
      اضغط سطرَ الحلقة لتفصيلها.
    </p>
    <div class="mo-tools">
      <UiSearchField
        v-model="query"
        placeholder="ابحث باسم المعلم أو الحلقة"
        :shown="shown.length"
        :total="rows.length"
        class="mo-search"
      />
      <UiSelect
        v-model="statusFilter"
        :items="statusItems"
        size="lg"
        class="mo-sel"
        aria-label="حالة التقرير"
      />
      <UiSelect
        v-if="bothGenders"
        v-model="gender"
        :items="genderItems"
        size="lg"
        class="mo-sel"
        aria-label="القسم"
      />
    </div>
    <UiEmptyState
      v-if="!shown.length"
      icon="i-lucide-search-x"
      title="لا حلقة تطابق البحث والفلاتر"
    />
    <div
      v-else
      class="mo-wrap"
    >
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الحلقة</th>
            <th>الطلاب</th>
            <th>الحضور</th>
            <th>أنجز · قريب · مقصّر</th>
            <th>كثير الغياب</th>
            <th>إنجاز المعلم</th>
            <th>الاختبارات</th>
            <th>القراءة</th>
            <th>الزيارات</th>
            <th>حالة التقرير</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in shown"
            :key="r.halaqa_id"
            tabindex="0"
            role="button"
            :aria-label="`تفصيل ${r.halaqa_name}`"
            @click="emit('pick', r.halaqa_id)"
            @keydown.enter="emit('pick', r.halaqa_id)"
          >
            <td class="num">
              {{ i + 1 }}
            </td>
            <td class="name">
              {{ r.halaqa_name }}<span class="sub">{{ r.teacher_name ?? '—' }}</span>
            </td>
            <td>{{ r.students }}</td>
            <td :class="pctTone(r.attendancePct)">
              {{ r.attendancePct === null ? '—' : `${r.attendancePct}%` }}
            </td>
            <td>
              <span class="ok">{{ r.done }}</span> · <span class="warn">{{ r.near }}</span> · <span class="bad">{{ r.short }}</span>
            </td>
            <td>{{ r.absentee || '—' }}</td>
            <td :class="pctTone(r.teacherPct)">
              <b>{{ r.teacherPct === null ? '—' : `${r.teacherPct}%` }}</b>
            </td>
            <td>{{ r.exams.total ? `${r.exams.passed} من ${r.exams.total}` : '—' }}</td>
            <td>{{ r.reading.total ? `${r.reading.passed} من ${r.reading.total}` : '—' }}</td>
            <td :class="visitTone(r)">
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
            <td>المجموع ({{ shown.length }})</td>
            <td>{{ totals.students }}</td>
            <td />
            <td>{{ totals.done }} · {{ totals.near }} · {{ totals.short }}</td>
            <td>{{ totals.absentee }}</td>
            <td />
            <td>{{ totals.examsPassed }} من {{ totals.exams }}</td>
            <td>{{ totals.readingPassed }} من {{ totals.reading }}</td>
            <td>{{ totals.visits }}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    <dl class="mo-legend">
      <div><dt>الحضور</dt><dd>نسبةُ الأيام التي حضرها الطلاب من أيام الحلقة في الشهر.</dd></div>
      <div><dt>أنجز · قريب · مقصّر</dt><dd>بما حفظوه من مطلوبهم: أنجز 100% فأكثر، وقريب من 75%، ومقصّر دون 75%.</dd></div>
      <div><dt>كثير الغياب</dt><dd>حضر دون 50% من أيامه بعد استثناء الغياب بعذر، أو دون 25% منها كلِّها — لا يُعتدّ بإنجازه.</dd></div>
      <div><dt>إنجاز المعلم</dt><dd>أعلى 12 طالباً: المنجز 1 والقريب ½، والمجموعُ ÷ 12.</dd></div>
      <div><dt>الاختبارات · القراءة</dt><dd>الناجحون من المتقدّمين هذا الشهر (اختبارات الأجزاء، واختبار القراءة في البرامج المصاحبة).</dd></div>
      <div><dt>الزيارات</dt><dd>المنفّذةُ من زيارتين مطلوبتين في الشهر، ومعدّلُ علاماتها من 42، أيًّا كان الزائر.</dd></div>
      <div><dt>حالة التقرير</dt><dd>تقريرُ الإنجاز القرآني: <b>مسودة</b> لم يُرسله المعلم بعد · <b>مُرسَل</b> بانتظار اعتماد المشرف · <b>معتمد</b> نهائيٌّ مقفل.</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; }
.mo h2 { margin: 0; font-size: 17px; color: var(--ink); }
.mo-hint { margin: 4px 0 12px; font-size: 13.5px; color: var(--ink-3); }
.mo-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-bottom: 14px; }
.mo-search { flex: 1 1 320px; min-width: 0; }
.mo-sel { flex: 0 0 210px; }
/* ارتفاعٌ واحد مع البحث (48px) */
.mo-sel :deep(button) { min-block-size: 48px; }
.mo-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 900px; }
th { text-align: start; font-weight: 600; color: var(--ink-3); padding: 8px 10px; border-bottom: 1px solid var(--line); line-height: 1.4; vertical-align: bottom; }
td { padding: 10px; border-bottom: 1px solid var(--line); color: var(--ink-2); white-space: nowrap; }
tbody tr { cursor: pointer; }
tbody tr:hover, tbody tr:focus-visible { background: var(--surface-2); outline: none; }
tfoot td { font-weight: 600; color: var(--ink); border-bottom: 0; }
.num { color: var(--ink-3); font-variant-numeric: tabular-nums; }
.name { color: var(--ink); font-weight: 600; }
.sub { display: block; font-size: 12.5px; font-weight: 400; color: var(--ink-3); }
.mo-legend { display: grid; gap: 6px; margin: 16px 0 0; padding-top: 12px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-3); }
.mo-legend div { display: flex; gap: 6px; flex-wrap: wrap; }
.mo-legend dt { font-weight: 600; color: var(--ink-2); }
.mo-legend dt::after { content: ':'; }
.mo-legend dd { margin: 0; }
.ok { color: var(--chip-active-ink); }
.warn { color: var(--chip-warn-ink); }
.bad { color: var(--chip-late-ink); }
</style>
