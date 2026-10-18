<script setup lang="ts">
/**
 * تفاصيل الحلقة (§4.14) — عرض عميق لحلقة واحدة:
 * ترويسة (المعلّم/المشرف/الوقت) + طلابها بتقدّمهم + آخر تقرير شهري + آخر الزيارات.
 * متاح للمدير والمشرف/الجودة ضمن نطاقهم (RLS).
 */
import type { Database } from '~/types/database.types'
import { buildJourney, type PlanInput, type ResultInput } from '~/utils/journey'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const supabase = useSupabaseClient<Database>()

const GENDER_LABEL: Record<string, string> = { male: 'بنين', female: 'بنات' }
const CLASS_LABEL: Record<string, string> = { excellent: 'متميّزة', good: 'جيّدة', normal: 'عادية', weak: 'ضعيفة' }

type Halqa = {
  id: string
  name: string
  daily_time: string | null
  gender: string | null
  classification: string | null
  status: string
  teacher: { full_name: string } | null
  supervisor: { full_name: string } | null
}
type StudentRow = { id: string, full_name: string, quran_parts: number | null, next: string, done: boolean }
type ReportRow = { id: string, report_month: number, report_year: number, status: string } | null
type VisitRow = { id: string, scheduled_at: string, executed_at: string | null, status: string }
type ExamResultRow = { student_id: string, passed: boolean | null, total_score: number | null, exam_list_item: { exam_plan_id: number | null } | null }

const { data, pending } = useLazyAsyncData(() => `halqa-detail-${id.value}`, async () => {
  const { data: halqa } = await supabase
    .from('halaqat')
    .select('id, name, daily_time, gender, classification, status, teacher:teacher_id(full_name), supervisor:supervisor_id(full_name)')
    .eq('id', id.value)
    .maybeSingle<Halqa>()
  if (!halqa) return null

  const [{ data: studs }, { data: plan }, { data: examResults }, { data: rep }, { data: visits }] = await Promise.all([
    supabase.from('students').select('id, full_name, quran_parts').eq('halaqa_id', id.value).eq('status', 'active').order('full_name'),
    supabase.from('exam_plan').select('id, parts_from, parts_to, stage_type').order('parts_to'),
    supabase.from('exam_results').select('student_id, passed, total_score, exam_list_item:exam_list_item_id(exam_plan_id), student:student_id!inner(halaqa_id)').eq('student.halaqa_id', id.value).returns<ExamResultRow[]>(),
    supabase.from('monthly_reports').select('id, report_month, report_year, status').eq('halaqa_id', id.value).order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('supervision_visits').select('id, scheduled_at, executed_at, status').eq('halaqa_id', id.value).order('scheduled_at', { ascending: false }).limit(5).returns<VisitRow[]>()
  ])

  const planArr = (plan ?? []) as PlanInput[]
  // نتائج اختبارات طلاب الحلقة مجمّعة حسب الطالب — لتُغذّي رحلة كل طالب (المحطة القادمة تعكس المُجتاز)
  const resultsByStudent = new Map<string, ResultInput[]>()
  for (const r of examResults ?? []) {
    const arr = resultsByStudent.get(r.student_id) ?? []
    arr.push({ exam_plan_id: r.exam_list_item?.exam_plan_id ?? null, passed: r.passed, total_score: r.total_score })
    resultsByStudent.set(r.student_id, arr)
  }
  const students: StudentRow[] = (studs ?? []).map((s) => {
    const j = buildJourney(s.quran_parts, planArr, resultsByStudent.get(s.id) ?? [])
    return {
      id: s.id,
      full_name: s.full_name,
      quran_parts: s.quran_parts,
      next: j.upcomingStation ? `الأجزاء ${j.upcomingStation.from}–${j.upcomingStation.to}` : (j.totalStations ? 'أكمل الخطة 🎉' : '—'),
      done: !j.upcomingStation && j.totalStations > 0
    }
  })

  return { halqa, students, report: rep as ReportRow, visits: visits ?? [] }
}, { server: false, default: () => null })

useSeoMeta({ title: () => data.value?.halqa ? `${data.value.halqa.name} — ترجمان` : 'تفاصيل الحلقة — ترجمان' })

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="hd">
    <UButton
      to="/halqat"
      label="الحلقات"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-right"
      class="back"
    />

    <ClientOnly>
      <template v-if="pending">
        <UiSkeletonBand />
        <div class="cols">
          <UiSkeletonTable
            class="main-col"
            :columns="[{ key: 's', label: 'الطالب' }, { key: 'p', label: 'الأجزاء' }, { key: 'n', label: 'المحطة القادمة' }, { key: 'a', label: '—', align: 'end' }]"
            :rows="5"
          />
          <div class="side-col">
            <UiSkeletonRow
              :desc="false"
              :action="false"
            />
            <UiSkeletonRow
              :desc="false"
              :action="false"
            />
          </div>
        </div>
      </template>
      <UiEmptyState
        v-else-if="!data?.halqa"
        icon="i-lucide-book-x"
        title="الحلقة غير موجودة"
        description="قد تكون محذوفة أو خارج نطاقك."
      />

      <template v-else>
        <!-- ترويسة الحلقة -->
        <div class="band">
          <div class="band-id">
            <div class="hicon">
              <UIcon
                name="i-lucide-book-open"
                class="size-7"
              />
            </div>
            <div>
              <h1>{{ data.halqa.name }}</h1>
              <div class="band-sub">
                <span><UIcon
                  name="i-lucide-user"
                  class="size-4"
                />{{ data.halqa.teacher?.full_name || 'بلا معلّم' }}</span>
                <span><UIcon
                  name="i-lucide-shield"
                  class="size-4"
                />{{ data.halqa.supervisor?.full_name || 'بلا مشرف' }}</span>
                <span v-if="data.halqa.daily_time"><UIcon
                  name="i-lucide-clock"
                  class="size-4"
                />{{ data.halqa.daily_time.slice(0, 5) }}</span>
              </div>
            </div>
          </div>
          <div class="band-badges">
            <UBadge
              v-if="data.halqa.gender"
              :label="GENDER_LABEL[data.halqa.gender]"
              :color="data.halqa.gender === 'male' ? 'info' : 'secondary'"
              variant="soft"
            />
            <UBadge
              v-if="data.halqa.classification"
              :label="CLASS_LABEL[data.halqa.classification]"
              color="neutral"
              variant="soft"
            />
            <UBadge
              :label="data.halqa.status === 'active' ? 'نشطة' : 'متوقفة'"
              :color="data.halqa.status === 'active' ? 'success' : 'neutral'"
              variant="soft"
            />
          </div>
        </div>

        <div class="cols">
          <!-- الطلاب -->
          <div class="card sec main-col">
            <div class="sec-head">
              <h3>طلاب الحلقة <span class="count">{{ data.students.length }}</span></h3>
            </div>
            <UiEmptyState
              v-if="!data.students.length"
              icon="i-lucide-users"
              title="لا طلاب نشطون"
            />
            <div
              v-else
              class="table-wrap"
            >
              <table>
                <thead>
                  <tr>
                    <th class="ta-start">
                      #
                    </th>
                    <th class="ta-start">
                      الطالب
                    </th>
                    <th>الأجزاء</th>
                    <th class="ta-start">
                      المحطة القادمة
                    </th>
                    <th class="ta-end">
                      —
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(s, i) in data.students"
                    :key="s.id"
                  >
                    <td class="ta-start muted">
                      {{ i + 1 }}
                    </td>
                    <td class="ta-start strong">
                      {{ s.full_name }}
                    </td>
                    <td>{{ s.quran_parts != null ? `${s.quran_parts} / 30` : '—' }}</td>
                    <td
                      class="ta-start"
                      :class="{ done: s.done }"
                    >
                      {{ s.next }}
                    </td>
                    <td>
                      <div class="ta-end">
                        <UButton
                          :to="`/students/${s.id}`"
                          label="الملف"
                          color="neutral"
                          variant="outline"
                          size="sm"
                          icon="i-lucide-user"
                          :ui="{ base: 'rounded-[10px]' }"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- الجانب -->
          <div class="side-col">
            <!-- آخر تقرير -->
            <div class="card sec">
              <div class="sec-head">
                <h3>آخر تقرير شهري</h3>
                <UButton
                  to="/reports"
                  label="التقارير"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-left"
                />
              </div>
              <div
                v-if="data.report"
                class="report-row"
              >
                <span class="report-month">{{ monthName(data.report.report_month) }} {{ data.report.report_year }}</span>
                <UBadge
                  :label="REPORT_STATUS[data.report.status]?.label"
                  :color="REPORT_STATUS[data.report.status]?.color"
                  variant="soft"
                />
              </div>
              <UiEmptyState
                v-else
                icon="i-lucide-file-text"
                title="لا تقارير بعد"
              />
            </div>

            <!-- آخر الزيارات -->
            <div class="card sec">
              <div class="sec-head">
                <h3>آخر الزيارات</h3>
                <UButton
                  to="/visits"
                  label="الزيارات"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-left"
                />
              </div>
              <UiEmptyState
                v-if="!data.visits.length"
                icon="i-lucide-clipboard-check"
                title="لا زيارات بعد"
              />
              <ul
                v-else
                class="rows"
              >
                <li
                  v-for="v in data.visits"
                  :key="v.id"
                  class="row"
                >
                  <span class="row-sub">{{ fmtDate(v.executed_at || v.scheduled_at) }}</span>
                  <UBadge
                    :label="VISIT_STATUS[v.status]?.label"
                    :color="VISIT_STATUS[v.status]?.color"
                    variant="soft"
                    size="sm"
                  />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }

.band { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.band-id { display: flex; align-items: center; gap: 16px; min-width: 0; }
.hicon { width: 60px; height: 60px; border-radius: 18px; background: var(--blue-soft); color: var(--blue-ink); display: flex; align-items: center; justify-content: center; flex: none; }
.band h1 { margin: 0; font-size: 24px; font-weight: 700; color: var(--ink); }
.band-sub { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
.band-sub span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-2); }
.band-badges { display: flex; gap: 8px; flex-wrap: wrap; }

.cols { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; align-items: start; }
.side-col { display: flex; flex-direction: column; gap: 18px; }
.sec { padding: 20px 22px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sec-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 9px; }
.count { background: var(--surface-3); color: var(--ink-2); font-size: 13px; font-weight: 700; border-radius: 999px; padding: 2px 10px; }

.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 14.5px; min-width: 480px; }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 12px 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; text-align: center; }
.table-wrap td { padding: 11px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.ta-end { display: flex; justify-content: flex-end; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.done { color: var(--green-ink); font-weight: 600; }

.report-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.report-month { font-weight: 600; color: var(--ink); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.row-sub { font-size: 14px; color: var(--ink-2); }

@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
