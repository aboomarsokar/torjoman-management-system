<script setup lang="ts">
/**
 * جسمُ ورقة تقرير الحلقة الشهريّ المطبوعة: الخلاصةُ في سطرٍ من الخانات، والإشراف (الزيارات · الجودة · كلمة المشرف ·
 * الأكثرُ غياباً)، وجدولُ الطلاب — نصوصٌ بألوان الورق بلا مكوّنات الشاشة.
 */
import type { StudentMonthRow } from '~/utils/quran/month'
import type { Outcome } from '~/utils/quran/plan'
import type { MonthlyExtras } from '~/utils/monthlyReport'
import { ACHIEVEMENT_TOP_N, achievementPct } from '~/utils/halaqatAchievement'
import { VISITS_PER_MONTH } from '~/utils/monthVisits'
import { VISIT_MAX } from '~/utils/visitForm'
import { planBadge } from '~/utils/quran/screen'

interface Props {
  rows: StudentMonthRow[]
  outcomes: Record<Outcome, number>
  attendancePct: number | null
  extras: MonthlyExtras | null
  approvalNote: string | null
  frequent: { id: string, name: string, unexcused: number, held: number }[]
}
const props = defineProps<Props>()

const teacherPct = computed(() => achievementPct(props.outcomes))
const examBy = computed(() => new Map((props.extras?.exams ?? []).map(e => [e.studentId, e])))
const readingBy = computed(() => new Map((props.extras?.reading ?? []).map(r => [r.studentId, r])))
const examsPassed = computed(() => (props.extras?.exams ?? []).filter(e => e.passed).length)
const readingPassed = computed(() => (props.extras?.reading ?? []).filter(r => r.passed).length)
const tone = (o: Outcome) => o === 'done' ? 'ok' : o === 'near' ? 'warn' : o === 'short' ? 'bad' : ''
const day = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
</script>

<template>
  <dl class="pr-cells">
    <div><dt>الحضور</dt><dd>{{ attendancePct === null ? '—' : `${attendancePct}%` }}</dd></div>
    <div><dt>أنجز · قريب · مقصّر</dt><dd>{{ outcomes.done }} · {{ outcomes.near }} · {{ outcomes.short }}</dd></div>
    <div><dt>كثير الغياب</dt><dd>{{ outcomes.absentee }}</dd></div>
    <div><dt>إنجاز المعلم (أعلى {{ ACHIEVEMENT_TOP_N }})</dt><dd>{{ teacherPct === null ? '—' : `${teacherPct}%` }}</dd></div>
    <div><dt>الاختبارات</dt><dd>{{ examsPassed }} من {{ extras?.exams.length ?? 0 }}</dd></div>
    <div><dt>القراءة</dt><dd>{{ readingPassed }} من {{ extras?.reading.length ?? 0 }}</dd></div>
  </dl>

  <section class="pr-sup">
    <h2>الإشراف والمتابعة</h2>
    <p>
      الزيارات: <b>{{ extras?.visits?.done.length ?? 0 }} من {{ VISITS_PER_MONTH }}</b>
      <template v-if="extras?.visits?.avg">
        · المعدّل {{ extras.visits.avg }}/{{ VISIT_MAX }}
      </template>
      <template
        v-for="(v, i) in extras?.visits?.done ?? []"
        :key="i"
      >
        · {{ day(v.day) }} ({{ v.score }}<template v-if="v.visitor">
          — {{ v.visitor }}
        </template>)
      </template>
    </p>
    <p v-if="extras?.quality?.final !== null && extras?.quality?.final !== undefined">
      سجلّ الجودة: النهائي <b>{{ extras.quality.final }}</b> · الجودة {{ extras.quality.quality ?? '—' }} · الإنجاز {{ extras.quality.achievement ?? '—' }}
    </p>
    <p
      v-if="approvalNote"
      class="pr-note"
    >
      <b>كلمة المشرف:</b> {{ approvalNote }}
    </p>
    <p v-if="frequent.length">
      <b>الأكثر غياباً بلا عذر:</b> {{ frequent.map(f => `${f.name} (${f.unexcused} من ${f.held})`).join('، ') }}
    </p>
  </section>

  <table class="pr-table">
    <thead>
      <tr><th>#</th><th>الطالب</th><th>الحضور</th><th>المحفوظ</th><th>المطلوب والحكم</th><th>اختبار الشهر</th><th>القراءة</th></tr>
    </thead>
    <tbody>
      <tr
        v-for="(r, i) in rows"
        :key="r.studentId"
      >
        <td>{{ i + 1 }}</td>
        <td class="pr-name">
          {{ r.name }}
        </td>
        <td>{{ r.daysHeld ? `${r.daysAttended} من ${r.daysHeld}` : '—' }}<small v-if="r.daysExcused">بعذر {{ r.daysExcused }}</small></td>
        <td>{{ r.record ? r.record.pagesMemorized : '—' }}</td>
        <td :class="tone(r.outcome)">
          {{ planBadge(r) }}
        </td>
        <td>{{ examBy.get(r.studentId) ? `${examBy.get(r.studentId)!.label} · ${examBy.get(r.studentId)!.passed ? 'ناجح' : examBy.get(r.studentId)!.passed === false ? 'يعيد' : '—'}` : '—' }}</td>
        <td>{{ readingBy.get(r.studentId) ? (readingBy.get(r.studentId)!.passed ? 'اجتاز' : 'لم يجتز') : '—' }}</td>
      </tr>
    </tbody>
  </table>
</template>
