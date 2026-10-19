<script setup lang="ts">
/**
 * لوحة التحكم (§4.3) داخل الهيكل العام.
 * لوحة المدير الإداري: بطاقات إحصائية (أعداد حقيقية) + بطاقات إعدادات مربوطة بـ app_settings
 * (ومشرف المشروع يراها بلا تعديل). لوحة المدير الفني: المشرفون الميدانيون والتقارير المُرسلة للاطّلاع (يعتمدها المشرفون الميدانيون، لا هو).
 * المعلّم «حلقتي»، والمشرف الميداني حلقاته وزياراته.
 */
import type { Database } from '~/types/database.types'
import type { ExamCycle } from '~/utils/exams/cycles'
import { buildJourney, upcomingLabel, type CycleResultInput } from '~/utils/journey'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'لوحة التحكم — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { role, fullName, profile, pending: profilePending } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const { isAdmin, isReadOnly, isTeacher, isFieldSupervisor: isSupervisor, isTechnical } = usePermissions()
/** لوحة النظرة العامة والإعدادات: المدير الإداري، ومشرف المشروع عرضاً. */
const showOverview = computed(() => isAdmin.value || isReadOnly.value)

// المختبِر لا لوحة له — عمله كلّه في الاختبارات؛ والطالب صفحته /me (الدخول يوجّه إلى /dashboard)؛
// والمديرة الإدارية لا لوحة لها في قائمتها — تبدأ من حلقات قسمها
watch(role, (r) => {
  if (r === 'examiner') navigateTo('/exams', { replace: true })
  if (r === 'student') navigateTo('/me', { replace: true })
  if (r === 'women_admin') navigateTo('/halqat', { replace: true })
}, { immediate: true })

// ── أعداد البطاقات (للمدير الإداري ومشرف المشروع) ──
const counts = reactive({ students: 0, teachers: 0, supervisors: 0, examiners: 0, halqat: 0 })

async function countOf(table: 'students' | 'halaqat') {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count ?? 0
}
async function countRole(r: Database['public']['Enums']['user_role']) {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', r)
  return count ?? 0
}

// ── إعدادات المدير (app_settings) ──
// النقاط وأيام الدوام الافتراضية أُلغيت (2026-10-19): تبقى أعمدتها في القاعدة ولا تُعرض ولا تُضبط
const settings = reactive({ pass_mark: 80, target_memorization_pages: 30 })
const drafts = reactive({ pass_mark: '80', target_memorization_pages: '30' })

async function loadSettings() {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (data) {
    settings.pass_mark = data.pass_mark
    settings.target_memorization_pages = data.target_memorization_pages
    drafts.pass_mark = String(settings.pass_mark)
    drafts.target_memorization_pages = String(settings.target_memorization_pages)
  }
}

type SettingKey = keyof typeof settings
const saving = ref<SettingKey | null>(null)

async function saveSetting(key: SettingKey, unit: string) {
  const val = Number.parseInt(drafts[key], 10)
  if (!Number.isFinite(val) || val <= 0) {
    toast.add({ title: 'أدخل قيمة صحيحة موجبة.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = key
  try {
    const patch = { [key]: val } as Database['public']['Tables']['app_settings']['Update']
    const { error } = await supabase.from('app_settings').update(patch).eq('id', 1)
    if (error) throw error
    settings[key] = val
    toast.add({ title: `تم الاعتماد (${val} ${unit}).`, color: 'success', icon: 'i-lucide-circle-check' })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = null
  }
}

async function loadManagerData() {
  const [st, te, su, ex, ha] = await Promise.all([
    countOf('students'), countRole('teacher'), countRole('field_supervisor'), countRole('examiner'), countOf('halaqat')
  ])
  counts.students = st
  counts.teachers = te
  counts.supervisors = su
  counts.examiners = ex
  counts.halqat = ha
  await loadSettings()
}

// يُحمَّل عند معرفة الدور (الملف قد يصل بعد أول تصيير على العميل)
watch(showOverview, (v) => {
  if (v) loadManagerData()
}, { immediate: true })

// ── لوحة المعلّم «حلقتي» ──
type TeacherRow = { id: string, full_name: string, quran_parts: number | null, next: string, done: boolean }
type TeacherExamResult = { student_id: string, passed: boolean | null, total_score: number | null, exam_list_item: { exam_cycle_id: number | null } | null }
const myHalqa = ref<{ id: string, name: string, daily_time: string | null } | null>(null)
const teacherRows = ref<TeacherRow[]>([])
const teacherLoaded = ref(false)

async function loadTeacherData() {
  try {
    const { data: h } = await supabase.from('halaqat').select('id, name, daily_time').eq('teacher_id', profile.value?.id ?? '').limit(1).maybeSingle()
    myHalqa.value = h
    if (!h) {
      teacherRows.value = []
      teacherLoaded.value = true
      return
    }
    const [{ data: studs }, { data: cycleRows }, { data: examResults }] = await Promise.all([
      supabase.from('students').select('id, full_name, quran_parts').eq('halaqa_id', h.id).eq('status', 'active').order('full_name'),
      supabase.from('exam_cycles').select('id, stage_number, cycle_number, parts_from, parts_to, surahs_label, sort_order').order('sort_order'),
      supabase.from('exam_results').select('student_id, passed, total_score, exam_list_item:exam_list_item_id(exam_cycle_id), student:student_id!inner(halaqa_id)').eq('student.halaqa_id', h.id).returns<TeacherExamResult[]>()
    ])
    const cycles: ExamCycle[] = (cycleRows ?? []).map(c => ({ ...c, sort_order: c.sort_order ?? 0 }))
    // نتائج اختبارات طلاب الحلقة مجمّعة حسب الطالب — لتعكس «المحطة القادمة» المُجتاز فعلياً
    const resultsByStudent = new Map<string, CycleResultInput[]>()
    for (const r of examResults ?? []) {
      const arr = resultsByStudent.get(r.student_id) ?? []
      arr.push({ exam_cycle_id: r.exam_list_item?.exam_cycle_id ?? null, passed: r.passed, total_score: r.total_score })
      resultsByStudent.set(r.student_id, arr)
    }
    teacherRows.value = (studs ?? []).map((s) => {
      const j = buildJourney(s.quran_parts, cycles, resultsByStudent.get(s.id) ?? [])
      return {
        id: s.id,
        full_name: s.full_name,
        quran_parts: s.quran_parts,
        next: upcomingLabel(j),
        done: !j.upcomingStation && j.totalStations > 0
      }
    })
    teacherLoaded.value = true
  } catch (err) {
    handle(err)
  }
}

watch(isTeacher, (v) => {
  if (v) loadTeacherData()
}, { immediate: true })

const fmtTime = (t: string | null) => t ? t.slice(0, 5) : '—'

// ── لوحة المشرف ──
type SHalqa = { id: string, name: string, teacher: string, students: number }
type SVisit = { id: string, halqa: string, scheduled_at: string }
const supHalqat = ref<SHalqa[]>([])
const supVisits = ref<SVisit[]>([])
const supPendingExams = ref(0)

async function loadSupervisorData() {
  try {
    const me = profile.value?.id ?? ''
    const { data: halqat } = await supabase
      .from('halaqat')
      .select('id, name, teacher:teacher_id(full_name)')
      .eq('supervisor_id', me)
      .order('name')
      .returns<{ id: string, name: string, teacher: { full_name: string } | null }[]>()
    const ids = (halqat ?? []).map(h => h.id)

    const countMap: Record<string, number> = {}
    if (ids.length) {
      const { data: studs } = await supabase.from('students').select('halaqa_id').in('halaqa_id', ids).eq('status', 'active')
      for (const s of studs ?? []) {
        if (s.halaqa_id) countMap[s.halaqa_id] = (countMap[s.halaqa_id] ?? 0) + 1
      }
    }
    supHalqat.value = (halqat ?? []).map(h => ({ id: h.id, name: h.name, teacher: h.teacher?.full_name ?? '—', students: countMap[h.id] ?? 0 }))

    const today = new Date().toISOString().slice(0, 10)
    const { data: visits } = await supabase
      .from('supervision_visits')
      .select('id, scheduled_at, halaqa:halaqa_id(name)')
      .eq('supervisor_id', me).eq('status', 'scheduled').gte('scheduled_at', today)
      .order('scheduled_at', { ascending: true }).limit(8)
      .returns<{ id: string, scheduled_at: string, halaqa: { name: string } | null }[]>()
    supVisits.value = (visits ?? []).map(v => ({ id: v.id, halqa: v.halaqa?.name ?? '—', scheduled_at: v.scheduled_at }))

    const { data: items } = await supabase.from('exam_list_items').select('id, exam_results(id)').returns<{ id: string, exam_results: { id: string }[] }[]>()
    supPendingExams.value = (items ?? []).filter(i => !i.exam_results?.length).length
  } catch (err) {
    handle(err)
  }
}

watch(isSupervisor, (v) => {
  if (v) loadSupervisorData()
}, { immediate: true })

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('ar', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toTimeString().slice(0, 5)}`
}

// ── لوحة المدير الفني (كانت لوحة الجودة) — نطاقه القسمان، فكلّ المشرفين الميدانيين ──
type QSup = { id: string, name: string, halqat: number }
type QReport = { id: string, halqa: string, label: string }
const qSupervisors = ref<QSup[]>([])
const qHalqatCount = ref(0)
const qVisitsCount = ref(0)
const qReports = ref<QReport[]>([])

async function loadTechnicalData() {
  try {
    const { data: sups } = await supabase
      .from('profiles').select('id, full_name')
      .eq('role', 'field_supervisor').eq('status', 'active').order('full_name')

    const { data: halqat } = await supabase.from('halaqat').select('id, supervisor_id')
    const halqaCount: Record<string, number> = {}
    for (const h of halqat ?? []) {
      if (h.supervisor_id) halqaCount[h.supervisor_id] = (halqaCount[h.supervisor_id] ?? 0) + 1
    }
    qSupervisors.value = (sups ?? []).map(s => ({ id: s.id, name: s.full_name, halqat: halqaCount[s.id] ?? 0 }))
    qHalqatCount.value = (halqat ?? []).length

    const today = new Date().toISOString().slice(0, 10)
    const { data: visits } = await supabase.from('supervision_visits').select('id').eq('status', 'scheduled').gte('scheduled_at', today)
    qVisitsCount.value = (visits ?? []).length

    const { data: reps } = await supabase
      .from('monthly_reports')
      .select('id, report_month, report_year, halaqa:halaqa_id(name)')
      .eq('status', 'submitted')
      .order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(8)
      .returns<{ id: string, report_month: number, report_year: number, halaqa: { name: string } | null }[]>()
    qReports.value = (reps ?? []).map(r => ({ id: r.id, halqa: r.halaqa?.name ?? '—', label: periodLabel(r.report_year, r.report_month) }))
  } catch (err) {
    handle(err)
  }
}

watch(isTechnical, (v) => {
  if (v) loadTechnicalData()
}, { immediate: true })

type Tone = 'blue' | 'green' | 'neutral' | 'err'
const statCards = computed(() => [
  { icon: 'i-lucide-graduation-cap', tone: 'blue' as Tone, value: counts.students, label: 'إجمالي الطلاب' },
  { icon: 'i-lucide-users', tone: 'green' as Tone, value: counts.teachers, label: 'المعلمون' },
  { icon: 'i-lucide-shield-check', tone: 'blue' as Tone, value: counts.supervisors, label: 'المشرفون الميدانيون' },
  { icon: 'i-lucide-award', tone: 'green' as Tone, value: counts.examiners, label: 'المختبِرون' },
  { icon: 'i-lucide-book-open', tone: 'neutral' as Tone, value: counts.halqat, label: 'الحلقات النشطة' }
])

const settingCards = [
  { key: 'target_memorization_pages' as const, icon: 'i-lucide-book-open', tone: 'blue', title: 'المطلوب الشهريّ (صفحات)', unit: 'صفحة', desc: 'ما يُطالَب به كلُّ طالبٍ حفظاً في الشهر، ويُقسَّط بحضوره؛ عليه يُحكم بـ«أنجز» أو «مقصّر».' },
  { key: 'pass_mark' as const, icon: 'i-lucide-check-check', tone: 'green', title: 'علامة الاجتياز في الاختبار', unit: '%', desc: 'الحدّ الأدنى من 100 لاجتياز اختبار الطالب — يسري على الاختبارات اللاحقة.' }
]
</script>

<template>
  <div class="dash">
    <div class="welcome">
      <h2>أهلاً، {{ fullName }} 👋</h2>
      <p>إليك نظرة عامة على المشروع.</p>
    </div>

    <ClientOnly>
      <template v-if="profilePending">
        <div class="stats">
          <UiSkeletonCard
            v-for="i in 4"
            :key="i"
            :icon="false"
            :lines="1"
          />
        </div>
      </template>
      <template v-else-if="showOverview">
        <!-- بطاقات إحصائية -->
        <div class="stats">
          <UiStatCard
            v-for="c in statCards"
            :key="c.label"
            :icon="c.icon"
            :tone="c.tone"
            :value="c.value"
            :label="c.label"
            stacked
          />
        </div>

        <!-- بطاقات الإعدادات -->
        <div class="settings">
          <div
            v-for="s in settingCards"
            :key="s.key"
            class="card setting"
          >
            <div class="setting-head">
              <div
                class="ico"
                :class="`ico-${s.tone}`"
              >
                <UIcon
                  :name="s.icon"
                  class="size-6"
                />
              </div>
              <div class="setting-text">
                <h3>{{ s.title }}</h3>
                <p>{{ s.desc }} <span class="cur">المعتمد: {{ settings[s.key] }} {{ s.unit }}</span></p>
              </div>
            </div>
            <div
              v-if="isAdmin"
              class="setting-edit"
            >
              <UInput
                v-model="drafts[s.key]"
                inputmode="numeric"
                size="lg"
                :ui="{ base: 'rounded-[13px] text-center font-bold w-24' }"
              />
              <span class="unit">{{ s.unit }}</span>
              <UButton
                label="اعتماد"
                color="primary"
                size="lg"
                icon="i-lucide-check"
                :loading="saving === s.key"
                :ui="{ base: 'rounded-[13px] font-semibold' }"
                @click="saveSetting(s.key, s.unit)"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="isTeacher">
        <ClientOnly>
          <template v-if="teacherLoaded && !myHalqa">
            <div class="card placeholder">
              <p>لا توجد حلقة معيّنة لك بعد. تواصل مع الإدارة لإسناد حلقتك.</p>
            </div>
          </template>
          <template v-else-if="myHalqa">
            <!-- ترويسة الحلقة + إجراءات سريعة -->
            <div class="card thead">
              <div class="thead-info">
                <div class="ico ico-blue">
                  <UIcon
                    name="i-lucide-book-open"
                    class="size-6"
                  />
                </div>
                <div>
                  <h3>{{ myHalqa.name }}</h3>
                  <p>{{ teacherRows.length }} طالب · الوقت اليومي {{ fmtTime(myHalqa.daily_time) }}</p>
                </div>
              </div>
              <div class="thead-actions">
                <UButton
                  to="/exams"
                  label="ترشيح للاختبار"
                  color="primary"
                  size="lg"
                  icon="i-lucide-clipboard-check"
                  :ui="{ base: 'rounded-[13px] font-semibold' }"
                />
                <UButton
                  to="/reports"
                  label="تقرير الشهر"
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-file-text"
                  :ui="{ base: 'rounded-[13px] font-semibold' }"
                />
              </div>
            </div>

            <!-- طلاب الحلقة -->
            <UiEmptyState
              v-if="!teacherRows.length"
              icon="i-lucide-users"
              title="لا طلاب نشطون في حلقتك"
            />
            <div
              v-else
              class="card table-wrap"
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
                    <th>الأجزاء المثبتة</th>
                    <th class="ta-start">
                      المحطة المستحقّة القادمة
                    </th>
                    <th class="ta-end">
                      —
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in teacherRows"
                    :key="r.id"
                  >
                    <td class="ta-start muted">
                      {{ i + 1 }}
                    </td>
                    <td class="ta-start strong">
                      {{ r.full_name }}
                    </td>
                    <td>{{ r.quran_parts != null ? `${r.quran_parts} / 30` : '—' }}</td>
                    <td
                      class="ta-start"
                      :class="{ done: r.done }"
                    >
                      {{ r.next }}
                    </td>
                    <td>
                      <div class="ta-end">
                        <UButton
                          :to="`/students/${r.id}`"
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
            <!-- الجوال: بطاقات بدل الجدول المتمرّر (الضغط على البطاقة يفتح ملف الطالب) -->
            <ul
              v-if="teacherRows.length"
              class="t-cards"
            >
              <li
                v-for="r in teacherRows"
                :key="r.id"
              >
                <UiCardRow
                  :title="r.full_name"
                  :to="`/students/${r.id}`"
                  :fields="[
                    { label: 'الأجزاء المثبتة', value: r.quran_parts != null ? `${r.quran_parts} / 30` : null },
                    { label: 'المحطة القادمة', value: r.next }
                  ]"
                />
              </li>
            </ul>
          </template>
        </ClientOnly>
      </template>

      <template v-else-if="isSupervisor">
        <ClientOnly>
          <!-- بطاقات إحصائية -->
          <div class="stats stats-3">
            <UiStatCard
              icon="i-lucide-book-open"
              tone="blue"
              :value="supHalqat.length"
              label="حلقاتي"
              stacked
            />
            <UiStatCard
              icon="i-lucide-calendar-clock"
              tone="green"
              :value="supVisits.length"
              label="زيارات قادمة"
              stacked
            />
            <UiStatCard
              icon="i-lucide-clipboard-check"
              tone="neutral"
              :value="supPendingExams"
              label="اختبارات تنتظر الرصد"
              stacked
            />
          </div>

          <div class="sup-grid">
            <!-- حلقاتي -->
            <div class="card sec">
              <div class="sec-head">
                <h3>حلقاتي</h3>
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
                v-if="!supHalqat.length"
                icon="i-lucide-book-open"
                title="لا حلقات مُسندة إليك"
              />
              <ul
                v-else
                class="rows"
              >
                <li
                  v-for="h in supHalqat"
                  :key="h.id"
                  class="row"
                >
                  <div class="row-main">
                    <span class="row-title">{{ h.name }}</span>
                    <span class="row-sub">المعلّم: {{ h.teacher }}</span>
                  </div>
                  <UBadge
                    :label="`${h.students} طالب`"
                    color="neutral"
                    variant="soft"
                  />
                </li>
              </ul>
            </div>

            <!-- زياراتي القادمة -->
            <div class="card sec">
              <div class="sec-head">
                <h3>زياراتي القادمة</h3>
                <UButton
                  to="/visits"
                  label="الكل"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-left"
                />
              </div>
              <UiEmptyState
                v-if="!supVisits.length"
                icon="i-lucide-calendar-check"
                title="لا زيارات مجدولة قادمة"
              />
              <ul
                v-else
                class="rows"
              >
                <li
                  v-for="v in supVisits"
                  :key="v.id"
                  class="row"
                >
                  <div class="row-main">
                    <span class="row-title">{{ v.halqa }}</span>
                    <span class="row-sub">{{ fmtDateTime(v.scheduled_at) }}</span>
                  </div>
                  <UBadge
                    label="مجدولة"
                    color="warning"
                    variant="soft"
                  />
                </li>
              </ul>
            </div>
          </div>

          <!-- تنبيه الرصد -->
          <div
            v-if="supPendingExams"
            class="card cta"
          >
            <div class="cta-text">
              <UIcon
                name="i-lucide-clipboard-check"
                class="size-5"
              />
              لديك <strong>{{ supPendingExams }}</strong> بند اختبار بانتظار الرصد.
            </div>
            <UButton
              to="/exams"
              label="رصد الاختبارات"
              color="primary"
              size="lg"
              icon="i-lucide-pencil"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </ClientOnly>
      </template>

      <template v-else-if="isTechnical">
        <ClientOnly>
          <div class="stats stats-4">
            <UiStatCard
              icon="i-lucide-shield-check"
              tone="blue"
              :value="qSupervisors.length"
              label="المشرفون الميدانيون"
              stacked
            />
            <UiStatCard
              icon="i-lucide-book-open"
              tone="green"
              :value="qHalqatCount"
              label="الحلقات في نطاقي"
              stacked
            />
            <UiStatCard
              icon="i-lucide-calendar-clock"
              tone="neutral"
              :value="qVisitsCount"
              label="زيارات قادمة"
              stacked
            />
            <UiStatCard
              icon="i-lucide-file-text"
              tone="blue"
              :value="qReports.length"
              label="تقارير مُرسلة (للاطّلاع)"
              stacked
            />
          </div>

          <div class="sup-grid">
            <!-- المشرفون الميدانيون -->
            <div class="card sec">
              <div class="sec-head">
                <h3>المشرفون الميدانيون</h3>
                <UButton
                  to="/supervisors"
                  label="المشرفون"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-left"
                />
              </div>
              <UiEmptyState
                v-if="!qSupervisors.length"
                icon="i-lucide-shield"
                title="لا مشرفين في نطاقك"
              />
              <ul
                v-else
                class="rows"
              >
                <li
                  v-for="s in qSupervisors"
                  :key="s.id"
                  class="row"
                >
                  <span class="row-title">{{ s.name }}</span>
                  <UBadge
                    :label="`${s.halqat} حلقة`"
                    color="neutral"
                    variant="soft"
                  />
                </li>
              </ul>
            </div>

            <!-- تقارير مُرسلة للاطّلاع -->
            <div class="card sec">
              <div class="sec-head">
                <h3>تقارير مُرسلة — يعتمدها المشرفون الميدانيون</h3>
                <UButton
                  to="/reports"
                  label="التقارير"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-left"
                />
              </div>
              <UiEmptyState
                v-if="!qReports.length"
                icon="i-lucide-file-check"
                title="لا تقارير مُرسلة"
              />
              <ul
                v-else
                class="rows"
              >
                <li
                  v-for="r in qReports"
                  :key="r.id"
                  class="row"
                >
                  <div class="row-main">
                    <span class="row-title">{{ r.halqa }}</span>
                    <span class="row-sub">{{ r.label }}</span>
                  </div>
                  <UBadge
                    label="مُرسل"
                    color="warning"
                    variant="soft"
                  />
                </li>
              </ul>
            </div>
          </div>
        </ClientOnly>
      </template>

      <template v-else>
        <div class="card placeholder">
          <p>لوحة دورك ({{ role }}) قيد البناء — تُضاف في الخطوات التالية.</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.welcome { margin-bottom: 28px; }
.welcome h2 { margin: 0; font-size: 28px; font-weight: 700; color: var(--ink); }
.welcome p { margin: 8px 0 0; font-size: 16px; color: var(--ink-2); font-weight: 300; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.ico { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex: none; }
.ico-blue { background: var(--blue-soft); color: var(--blue-ink); }
.ico-green { background: var(--green-soft); color: var(--green-ink); }
.ico-neutral { background: var(--surface-3); color: var(--ink); }

/* الإحصائيات */
.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; margin-bottom: 24px; }

/* الإعدادات */
.settings { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.setting { padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.setting-head { display: flex; align-items: center; gap: 14px; min-width: 0; }
.setting-text { min-width: 0; }
.setting-text h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.setting-text p { margin: 5px 0 0; font-size: 14px; color: var(--ink-2); font-weight: 300; line-height: 1.6; }
.cur { font-weight: 600; color: var(--ink); }
.setting-edit { display: flex; align-items: center; gap: 10px; flex: none; }
.unit { font-size: 15px; font-weight: 600; color: var(--ink-3); }

.placeholder { padding: 40px; text-align: center; color: var(--ink-2); }

/* لوحة المعلّم */
.thead { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.thead-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
.thead-info h3 { margin: 0; font-size: 19px; font-weight: 700; color: var(--ink); }
.thead-info p { margin: 5px 0 0; font-size: 14px; color: var(--ink-2); }
.thead-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* لوحة المعلم دون 720px (الجوال): طلاب الحلقة بطاقاتٌ بدل الجدول المتمرّر */
.dash { container: dash / inline-size; }
.t-cards { display: none; list-style: none; margin: 0; padding: 0; }
@container dash (max-width: 719px) {
  .dash .table-wrap { display: none; }
  .t-cards { display: grid; gap: 10px; }
}
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 14.5px; min-width: 560px; }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 13px 14px; font-weight: 600; color: var(--ink-3); font-size: 13px; white-space: nowrap; text-align: center; }
.table-wrap td { padding: 12px 14px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.ta-end { display: flex; justify-content: flex-end; }
.strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--ink-2); }
.done { color: var(--green-ink); font-weight: 600; }

/* لوحة المشرف */
.stats-3 { grid-template-columns: repeat(3, 1fr); }
.stats-4 { grid-template-columns: repeat(4, 1fr); }
.sup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
.sec { padding: 20px 22px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sec-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.row-title { font-weight: 600; color: var(--ink); }
.row-sub { font-size: 13px; color: var(--ink-3); }
.cta { padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.cta-text { display: flex; align-items: center; gap: 9px; font-size: 15px; color: var(--ink-2); }
.cta-text strong { color: var(--ink); }

@media (max-width: 1024px) { .stats { grid-template-columns: repeat(2, 1fr); } .settings { grid-template-columns: 1fr; } .sup-grid { grid-template-columns: 1fr; } .stats-3 { grid-template-columns: 1fr; } .stats-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) { .stats { grid-template-columns: 1fr; } }
</style>
