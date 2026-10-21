<script setup lang="ts">
/**
 * ورقةُ سجلّ تقييم الجودة الشهريّ للمعلم بشكل الورقة المعتمدة (قرارات المستخدم 2026-10-21): الزياراتُ الإشرافية
 * بمعاييرها الستّة (الأولى والثانية)، والبنودُ الشهرية (التقارير في وقتها والاجتماعات)، والخلاصةُ (الجودة من 50)،
 * وإنجازُ الحلقة من 50، والتقييمُ النهائيّ من 100. للعرض وحده — الأرقامُ من القاعدة، و`meetings` قيمةُ الحقل الحيّة.
 */
import type { QualityNumbers } from '~/utils/qualityRecord'
import {
  ACHIEVEMENT_MAX, FINAL_MAX, MEETINGS_MAX, QUALITY_MAX, REPORTS_QURAN_MAX, REPORTS_STATEMENT_MAX, fmtScore, qualityWith
} from '~/utils/qualityRecord'
import { CRITERION_MAX, VISIT_MAX } from '~/utils/visitForm'

const props = defineProps<{
  numbers: QualityNumbers
  /** أسماءُ المعايير الستّة بترتيبها. */
  criteria: string[]
  /** درجةُ الاجتماعات المعروضة (المحفوظة أو ما يكتبه المشرف الآن). */
  meetings: number
}>()

const v1 = computed(() => props.numbers.visits[0] ?? null)
const v2 = computed(() => props.numbers.visits[1] ?? null)
const extra = computed(() => Math.max(0, props.numbers.visits.length - 2))
const reports = computed(() => props.numbers.reports_quran + props.numbers.reports_statement)
const quality = computed(() => qualityWith(props.numbers, props.meetings))
const final = computed(() => (quality.value !== null && props.numbers.achievement !== null ? Math.round((quality.value + props.numbers.achievement) * 100) / 100 : null))
const day = (iso: string) => iso ? iso.split('-').reverse().join('-') : '—'
const achDen = computed(() => props.numbers.achievement_done + props.numbers.achievement_short + props.numbers.achievement_unrecorded)
</script>

<template>
  <div class="qs">
    <!-- ١ الزيارات الإشرافية -->
    <section class="qs-sec">
      <header class="qs-band">
        <span class="qs-no">1</span>
        <h4>الزيارات الإشرافية</h4>
        <span class="qs-band-sub">كلّ معيار {{ CRITERION_MAX }} درجات · زيارتان في الشهر</span>
      </header>
      <div class="qs-scroll">
        <table class="qs-table">
          <thead>
            <tr>
              <th class="start">
                المعيار
              </th>
              <th>الدرجة</th>
              <th>الزيارة الأولى<small>{{ v1 ? day(v1.date) : '—' }}</small></th>
              <th>الزيارة الثانية<small>{{ v2 ? day(v2.date) : '—' }}</small></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in criteria"
              :key="i"
            >
              <td class="start">
                {{ c }}
              </td>
              <td class="max">
                {{ CRITERION_MAX }}
              </td>
              <td>{{ v1 ? v1.criteria[i] ?? '—' : '—' }}</td>
              <td>{{ v2 ? v2.criteria[i] ?? '—' : '—' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="start">
                مجموع الزيارة
              </td>
              <td class="max">
                {{ VISIT_MAX }}
              </td>
              <td><b>{{ v1 ? v1.score : '—' }}</b></td>
              <td><b>{{ v2 ? v2.score : '—' }}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        v-if="numbers.incomplete"
        class="qs-warn"
      >
        ناقص — لم تُنفَّذ زيارةٌ بالنموذج في هذا الشهر، فلا يُحسب تقييم الجودة.
      </p>
      <p
        v-else-if="extra || numbers.visits_count === 1"
        class="qs-note"
      >
        {{ numbers.visits_count === 1 ? 'زيارةٌ واحدة في الشهر' : `${numbers.visits_count} زيارات في الشهر` }}
        — يُحسب متوسّطها ({{ fmtScore(numbers.visits_avg) }}) مضاعفاً: <b>{{ fmtScore(numbers.visits_part) }}</b> من {{ VISIT_MAX * 2 }}.
      </p>
    </section>

    <!-- ٢ البنود الشهرية -->
    <section class="qs-sec">
      <header class="qs-band">
        <span class="qs-no">2</span>
        <h4>بنود عامة في الشهر</h4>
        <span class="qs-band-sub">تُرصد مرّةً واحدة شهريّاً</span>
      </header>
      <table class="qs-table">
        <thead>
          <tr>
            <th class="start">
              البند
            </th>
            <th>الدرجة</th>
            <th>المحصّلة</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="start">
              تسليم التقارير في وقتها
              <small class="qs-hint">الإنجاز القرآني {{ numbers.reports_quran }}/{{ REPORTS_QURAN_MAX }} · كشف الحوافز {{ numbers.reports_statement }}/{{ REPORTS_STATEMENT_MAX }} · المهلة حتى {{ day(numbers.reports_deadline) }}</small>
            </td>
            <td class="max">
              {{ REPORTS_QURAN_MAX + REPORTS_STATEMENT_MAX }}
            </td>
            <td><b>{{ reports }}</b></td>
          </tr>
          <tr>
            <td class="start">
              حضور الاجتماعات الدورية
            </td>
            <td class="max">
              {{ MEETINGS_MAX }}
            </td>
            <td><b>{{ meetings }}</b></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="start">
              مجموع البنود الشهرية
            </td>
            <td class="max">
              {{ REPORTS_QURAN_MAX + REPORTS_STATEMENT_MAX + MEETINGS_MAX }}
            </td>
            <td><b>{{ reports + meetings }}</b></td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- الخلاصة -->
    <div class="qs-sum">
      <div><span>الزيارات · {{ VISIT_MAX * 2 }}</span><b>{{ fmtScore(numbers.visits_part) }}</b></div>
      <div><span>البنود الشهرية · 16</span><b>{{ reports + meetings }}</b></div>
      <div><span>المجموع ÷ 2</span><b>{{ numbers.visits_part === null ? '—' : fmtScore(numbers.visits_part + reports + meetings) }}</b></div>
      <div class="hl">
        <span>تقييم الجودة من {{ QUALITY_MAX }}</span><b>{{ fmtScore(quality) }}</b>
      </div>
    </div>

    <!-- ٣ إنجاز الحلقة · والتقييم النهائي -->
    <div class="qs-final">
      <div class="qs-ach">
        <div>
          <h4><span class="qs-no green">3</span> إنجاز الحلقة</h4>
          <p>محورٌ مستقلّ · {{ ACHIEVEMENT_MAX }}% من تقييم المعلم</p>
          <p class="qs-hint">
            أنجز {{ numbers.achievement_done }} من {{ achDen }}
            <template v-if="numbers.achievement_short">
              · مقصّر {{ numbers.achievement_short }}
            </template>
            <template v-if="numbers.achievement_unrecorded">
              · لم يُرصد {{ numbers.achievement_unrecorded }}
            </template>
            <template v-if="numbers.achievement_unmeasured">
              · لا يُقاس {{ numbers.achievement_unmeasured }}
            </template>
          </p>
        </div>
        <span class="qs-big green"><b>{{ fmtScore(numbers.achievement) }}</b><small>من {{ ACHIEVEMENT_MAX }}</small></span>
      </div>
      <div class="qs-tot">
        <div>
          <h4>التقييم النهائي</h4>
          <p>تقييم الجودة {{ QUALITY_MAX }} + إنجاز الحلقة {{ ACHIEVEMENT_MAX }}</p>
        </div>
        <span class="qs-big"><b>{{ fmtScore(final) }}</b><small>من {{ FINAL_MAX }}</small></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qs { display: flex; flex-direction: column; gap: 14px; }
.qs-sec { border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden; background: var(--surface); }
.qs-band { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 10px 14px; background: var(--navy); color: var(--on-primary); }
.qs-band h4 { margin: 0; font-size: 15.5px; font-weight: 700; }
.qs-band-sub { margin-inline-start: auto; font-size: 12.5px; opacity: .85; }
.qs-no { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; background: var(--on-primary); color: var(--navy); font-size: 13px; font-weight: 700; }
.qs-no.green { background: var(--green-ink); color: var(--on-primary); }
.qs-scroll { overflow-x: auto; }
.qs-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.qs-table th, .qs-table td { padding: 9px 12px; border-top: 1px solid var(--line); text-align: center; font-variant-numeric: tabular-nums; }
.qs-table thead th { background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 700; border-top: 0; }
.qs-table th small { display: block; font-size: 11.5px; font-weight: 500; color: var(--ink-3); }
.qs-table .start { text-align: start; color: var(--ink); }
.qs-table .max { color: var(--ink-3); font-weight: 600; width: 64px; }
.qs-table td b { font-size: 15px; color: var(--ink); }
.qs-table tfoot td { background: var(--surface-2); font-weight: 700; }
.qs-hint { display: block; margin-top: 2px; font-size: 12px; color: var(--ink-3); font-weight: 500; }
.qs-note { margin: 0; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); }
.qs-warn { margin: 0; padding: 10px 14px; border-top: 1px solid var(--line); background: var(--err-soft); color: var(--err); font-size: 13px; font-weight: 600; }

.qs-sum { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden; }
.qs-sum > div { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; background: var(--surface); }
.qs-sum > div + div { border-inline-start: 1px solid var(--line); }
.qs-sum span { font-size: 12px; color: var(--ink-3); font-weight: 600; }
.qs-sum b { font-size: 19px; color: var(--ink); font-variant-numeric: tabular-nums; }
.qs-sum .hl { background: var(--navy); }
.qs-sum .hl span { color: var(--on-primary); opacity: .85; }
.qs-sum .hl b { color: var(--on-primary); }

.qs-final { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.qs-ach, .qs-tot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1.5px solid var(--line-2); background: var(--surface); }
.qs-ach { border-color: var(--green-ink); }
.qs-ach h4, .qs-tot h4 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; color: var(--ink); }
.qs-ach p, .qs-tot p { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-2); }
.qs-big { flex: none; display: flex; flex-direction: column; align-items: center; min-width: 74px; padding: 6px 10px; border-radius: 12px; background: var(--navy); color: var(--on-primary); }
.qs-big.green { background: var(--green-ink); }
.qs-big b { font-size: 24px; line-height: 1.15; font-variant-numeric: tabular-nums; }
.qs-big small { font-size: 11.5px; opacity: .85; }

@media (max-width: 640px) {
  .qs-sum { grid-template-columns: 1fr 1fr; }
  .qs-sum > div:nth-child(3) { border-inline-start: 0; border-top: 1px solid var(--line); }
  .qs-sum > div:nth-child(4) { border-top: 1px solid var(--line); }
  .qs-final { grid-template-columns: 1fr; }
}
</style>
