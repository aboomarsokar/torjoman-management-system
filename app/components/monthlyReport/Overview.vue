<script setup lang="ts">
/**
 * التقريرُ الشهريّ العامّ لكلّ الحلقات (طلب المستخدم 2026-11-02/03): خلاصةُ ما ظهر في شريط أرقام (الحلقات والطلاب ·
 * متوسّطُ الحضور · متوسّطُ إنجاز المعلم · التقاريرُ المعتمدة والمرسلة والمعلّقة)، ثم صفُّ أدواتٍ واحد — بحثٌ باسم المعلم أو
 * الحلقة وفلترا حالة التقرير والقسم — ثم الجدول (`MonthlyReportOverviewTable`، يرتّب ويفتح التفصيل)، ومعاني الأعمدة مطويّة.
 */
import { OVERVIEW_ALL, filterOverview, overviewSummary, type OverviewRow } from '~/utils/monthlyOverview'
import type { StatItem } from '~/components/ui/StatStrip.vue'
import { REPORT_STATUS_LABELS } from '~/utils/quran/screen'

interface Props {
  rows: OverviewRow[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ pick: [id: string] }>()

const query = ref('')
const statusFilter = ref<string>(OVERVIEW_ALL)
const gender = ref<string>(OVERVIEW_ALL)
const shown = computed(() => filterOverview(props.rows, { query: query.value, status: statusFilter.value, gender: gender.value }))
const filtered = computed(() => !!query.value.trim() || statusFilter.value !== OVERVIEW_ALL || gender.value !== OVERVIEW_ALL)
function clearFilters() {
  query.value = ''
  statusFilter.value = OVERVIEW_ALL
  gender.value = OVERVIEW_ALL
}

const statusItems = computed(() => [
  { label: `كل الحالات (${props.rows.length})`, value: OVERVIEW_ALL },
  ...(['none', 'draft', 'submitted', 'approved'] as const).map(k => ({
    label: `${REPORT_STATUS_LABELS[k]} (${props.rows.filter(r => (r.report_status ?? 'none') === k).length})`,
    value: k
  }))
])
// فلترُ القسم لمن يرى القسمين وحده
const bothGenders = computed(() => new Set(props.rows.map(r => r.gender)).size > 1)
const genderItems = computed(() => [
  { label: 'البنين والبنات', value: OVERVIEW_ALL },
  { label: `البنين (${props.rows.filter(r => r.gender === 'male').length})`, value: 'male' },
  { label: `البنات (${props.rows.filter(r => r.gender === 'female').length})`, value: 'female' }
])

const stats = computed<StatItem[]>(() => {
  const s = overviewSummary(shown.value)
  return [
    { key: 'halqat', icon: 'i-lucide-book-open', value: s.halqat, label: 'الحلقات', sub: `${s.students} طالباً` },
    { key: 'att', icon: 'i-lucide-calendar-check', tone: 'blue', value: s.attendance === null ? '—' : `${s.attendance}%`, label: 'متوسّط الحضور' },
    { key: 'teacher', icon: 'i-lucide-gauge', tone: s.teacher !== null && s.teacher < 50 ? 'err' : 'green', value: s.teacher === null ? '—' : `${s.teacher}%`, label: 'متوسّط إنجاز المعلم' },
    { key: 'reports', icon: 'i-lucide-badge-check', tone: 'neutral', value: s.approved, label: 'تقارير معتمدة', sub: `مُرسَل ${s.submitted} · معلّق ${s.pending}` }
  ]
})
</script>

<template>
  <section
    class="mo"
    aria-labelledby="mo-title"
  >
    <UiStatStrip
      :items="stats"
      label="خلاصة الحلقات الظاهرة"
    />

    <div class="mo-card">
      <header class="mo-head">
        <h2 id="mo-title">
          كلّ الحلقات
        </h2>
        <p>اضغط سطرَ الحلقة لتفصيلها، وعنوانَ العمود لترتيبه.</p>
      </header>

      <div class="mo-tools">
        <div class="mo-search">
          <UiSearchField
            v-model="query"
            placeholder="ابحث باسم المعلم أو الحلقة"
            :shown="shown.length"
            :total="rows.length"
          />
        </div>
        <div class="mo-sel">
          <UiSelect
            v-model="statusFilter"
            :items="statusItems"
            size="xl"
            class="w-full"
            aria-label="حالة التقرير"
          />
        </div>
        <div
          v-if="bothGenders"
          class="mo-sel"
        >
          <UiSelect
            v-model="gender"
            :items="genderItems"
            size="xl"
            class="w-full"
            aria-label="القسم"
          />
        </div>
      </div>

      <div
        v-if="!shown.length"
        class="mo-empty"
      >
        <UiEmptyState
          icon="i-lucide-search-x"
          title="لا حلقة تطابق البحث والفلاتر"
        />
        <UButton
          v-if="filtered"
          label="امسح البحث والفلاتر"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="soft"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="clearFilters"
        />
      </div>
      <MonthlyReportOverviewTable
        v-else
        :rows="shown"
        @pick="emit('pick', $event)"
      />

      <details class="mo-legend">
        <summary>معاني الأعمدة</summary>
        <dl>
          <div><dt>الحضور</dt><dd>نسبةُ الأيام التي حضرها الطلاب من أيام الحلقة في الشهر.</dd></div>
          <div><dt>أنجز · قريب · مقصّر</dt><dd>بما حفظوه من مطلوبهم: أنجز 100% فأكثر، وقريب من 75%، ومقصّر دون 75%.</dd></div>
          <div><dt>كثير الغياب</dt><dd>حضر دون 50% من أيامه بعد استثناء الغياب بعذر، أو دون 25% منها كلِّها — لا يُعتدّ بإنجازه.</dd></div>
          <div><dt>إنجاز المعلم</dt><dd>أعلى 12 طالباً: المنجز 1 والقريب ½، والمجموعُ ÷ 12 — أخضر من 75%، وأصفر من 50%، وأحمر دونها.</dd></div>
          <div><dt>الاختبارات · القراءة</dt><dd>الناجحون من المتقدّمين هذا الشهر (اختبارات الأجزاء، واختبار القراءة في البرامج المصاحبة).</dd></div>
          <div><dt>الزيارات</dt><dd>المنفّذةُ من زيارتين مطلوبتين في الشهر، ومعدّلُ علاماتها من 42، أيًّا كان الزائر.</dd></div>
          <div><dt>حالة التقرير</dt><dd>تقريرُ الإنجاز القرآني: <b>مسودة</b> لم يُرسله المعلم بعد · <b>مُرسَل</b> بانتظار اعتماد المشرف · <b>معتمد</b> نهائيٌّ مقفل.</dd></div>
        </dl>
      </details>
    </div>
  </section>
</template>

<style scoped>
.mo { display: flex; flex-direction: column; }
.mo-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; }
.mo-head { margin-bottom: 16px; }
.mo-head h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--ink); }
.mo-head p { margin: 4px 0 0; font-size: 13.5px; color: var(--ink-3); }
/* صفُّ أدواتٍ واحد بارتفاعٍ واحد (48px): البحثُ يتمدّد والقائمتان بعرضٍ ثابت */
.mo-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-bottom: 16px; }
.mo-search { flex: 1 1 320px; min-inline-size: 0; }
.mo-sel { flex: 0 0 220px; }
.mo-sel :deep(button) { min-block-size: 48px; }
.mo-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-block: 8px 16px; }
.mo-legend { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-3); }
.mo-legend summary { display: inline-flex; align-items: center; min-block-size: 44px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.mo-legend summary:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 6px; }
.mo-legend dl { display: grid; gap: 6px; margin: 4px 0 0; }
.mo-legend dl div { display: flex; gap: 6px; flex-wrap: wrap; }
.mo-legend dt { font-weight: 600; color: var(--ink-2); }
.mo-legend dt::after { content: ':'; }
.mo-legend dd { margin: 0; }

@media (max-width: 640px) {
  .mo-sel { flex: 1 1 100%; }
}
</style>
