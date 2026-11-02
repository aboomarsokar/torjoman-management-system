<script setup lang="ts">
/**
 * جسمُ ورقة التقرير الشهريّ العامّ المطبوعة: جدولُ الحلقات بلا شاراتٍ ملوّنة (نصٌّ بألوان الورق) وشرحُ الأعمدة.
 */
import type { OverviewRow } from '~/utils/monthlyOverview'
import { VISITS_PER_MONTH } from '~/utils/monthVisits'
import { REPORT_STATUS_LABELS } from '~/utils/quran/screen'

defineProps<{ rows: OverviewRow[] }>()
const status = (r: OverviewRow) => REPORT_STATUS_LABELS[(r.report_status ?? 'none') as keyof typeof REPORT_STATUS_LABELS]
const tone = (p: number | null) => p === null ? '' : p >= 75 ? 'ok' : p >= 50 ? 'warn' : 'bad'
</script>

<template>
  <table class="pr-table">
    <thead>
      <tr>
        <th>#</th><th>الحلقة · المعلم</th><th>الطلاب</th><th>الحضور</th><th>أنجز · قريب · مقصّر</th>
        <th>كثير الغياب</th><th>إنجاز المعلم</th><th>الاختبارات</th><th>القراءة</th><th>الزيارات</th><th>حالة التقرير</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(r, i) in rows"
        :key="r.halaqa_id"
      >
        <td>{{ i + 1 }}</td>
        <td class="pr-name">
          {{ r.halaqa_name }}<small>{{ r.teacher_name ?? '—' }}</small>
        </td>
        <td>{{ r.students }}</td>
        <td :class="tone(r.attendancePct)">
          {{ r.attendancePct === null ? '—' : `${r.attendancePct}%` }}
        </td>
        <td>{{ r.done }} · {{ r.near }} · {{ r.short }}</td>
        <td>{{ r.absentee || '—' }}</td>
        <td :class="tone(r.teacherPct)">
          <b>{{ r.teacherPct === null ? '—' : `${r.teacherPct}%` }}</b>
        </td>
        <td>{{ r.exams.total ? `${r.exams.passed} من ${r.exams.total}` : '—' }}</td>
        <td>{{ r.reading.total ? `${r.reading.passed} من ${r.reading.total}` : '—' }}</td>
        <td>{{ r.visits?.done.length ?? 0 }} من {{ VISITS_PER_MONTH }}<small v-if="r.visits?.avg">معدّل {{ r.visits.avg }}</small></td>
        <td>{{ status(r) }}</td>
      </tr>
    </tbody>
  </table>
  <p class="pr-legend">
    <b>الحضور</b> نسبةُ أيام الطلاب الحاضرين · <b>أنجز</b> 100% من المطلوب فأكثر، <b>قريب</b> من 75%، <b>مقصّر</b> دونها ·
    <b>كثير الغياب</b> لا يُعتدّ بإنجازه · <b>إنجاز المعلم</b> أعلى 12 طالباً (المنجز 1 والقريب ½) ÷ 12 ·
    <b>الزيارات</b> المنفّذةُ من زيارتين ومعدّلُها من 42 · <b>حالة التقرير</b> مسودة لم يُرسل · مُرسَل بانتظار الاعتماد · معتمد نهائيّ.
  </p>
</template>
