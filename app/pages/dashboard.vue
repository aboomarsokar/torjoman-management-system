<script setup lang="ts">
/**
 * لوحة التحكم (§4.3) داخل الهيكل العام.
 * لوحة المدير الإداري: بطاقات إحصائية (أعداد حقيقية) + بطاقات إعدادات مربوطة بـ app_settings
 * (ومشرف المشروع يراها بلا تعديل). لوحة المدير الفني: المشرفون الميدانيون والتقارير المُرسلة للاطّلاع (يعتمدها المشرفون الميدانيون، لا هو).
 * المعلّم «حلقتي»، والمشرف الميداني حلقاته وزياراته. والمديرة الإدارية لوحةَ الفنيّ نفسَها لقسم البنات وبالمؤنّث (2026-10-22).
 */
import { PROFILE_CACHE_KEY, readCache } from '~/utils/offlineCache'
import type { Database } from '~/types/database.types'
import { formatVisitMoment } from '~/utils/visitStatus'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'لوحة التحكم — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { role, fullName, profile, pending: profilePending } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const { isAdmin, isReadOnly, isTeacher, isExaminer, isFieldSupervisor: isSupervisor, isTechnical, isWomenAdmin } = usePermissions()
/** لوحةُ القسم: المدير الفنيّ (البنين) والمديرةُ الإدارية (البنات) — النطاقُ من RLS، والتسمياتُ بمؤنّثها لها. */
const isSectionHead = computed(() => isTechnical.value || isWomenAdmin.value)
const T = computed(() => isWomenAdmin.value
  ? { sups: 'المشرفات الميدانيات', supsBtn: 'المشرفات', noSups: 'لا مشرفاتٍ في قسمك', reports: 'تقارير مُرسلة — تعتمدها المشرفات الميدانيات' }
  : { sups: 'المشرفون الميدانيون', supsBtn: 'المشرفون', noSups: 'لا مشرفين في نطاقك', reports: 'تقارير مُرسلة — يعتمدها المشرفون الميدانيون' })
/** لوحة النظرة العامة والإعدادات: المدير الإداري، ومشرف المشروع عرضاً. */
const showOverview = computed(() => isAdmin.value || isReadOnly.value)

// للمختبِر لوحتُه منذ 2026-10-22 (`DashboardExaminerHome`)؛ والطالب صفحته /me (الدخول يوجّه إلى /dashboard)؛
// والمديرةُ الإدارية لها لوحةُ قسمها منذ 2026-10-22 (كانت تُحوَّل إلى الحلقات)
// والمعلّمُ لوحتُه `/t/home` التي تعمل بلا إنترنت (2026-10-27)
watch(role, (r) => {
  if (r === 'student') navigateTo('/me', { replace: true })
  if (r === 'teacher') navigateTo('/t/home', { replace: true })
}, { immediate: true })

// المشرفُ الميداني والمختبِر: نسخُ شاشتَيهما وعلامةُ الجهاز تُحفظ من لوحتهما كلَّ ساعة (الدفعة الثالثة، 2026-10-29).
// الدورُ يُقرأ من الملفّ المحفوظ؛ وعلى جهازٍ جديدٍ يصل أوّلَ دخولٍ بعد التركيب، فيُنادى حين يظهر (والمكرَّرُ يمنعه الحارس)
const { warm: warmField } = useWarmFieldCopies()
onMounted(() => void warmField())
watch(role, () => void warmField())

// ── أعداد البطاقات (للمدير الإداري ومشرف المشروع) — قسمُ البنين وقسمُ البنات منفصلَين (طلب المستخدم 2026-10-22) ──
// النشطون وحدهم: كان «إجمالي الطلاب» يعدّ المنقطعين والمتخرّجين، و«الحلقات النشطة» يعدّ الموقوفة
type Sex = Database['public']['Enums']['gender_type']
type SectionCounts = { students: number, teachers: number, supervisors: number, examiners: number, halqat: number }
const emptyCounts = (): SectionCounts => ({ students: 0, teachers: 0, supervisors: 0, examiners: 0, halqat: 0 })
const counts = reactive<Record<Sex, SectionCounts>>({ male: emptyCounts(), female: emptyCounts() })

async function countActive(table: 'students' | 'halaqat', g: Sex) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('gender', g).eq('status', 'active')
  return count ?? 0
}
async function countRole(r: Database['public']['Enums']['user_role'], g: Sex) {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', r).eq('gender', g).eq('status', 'active')
  return count ?? 0
}
async function loadSection(g: Sex): Promise<SectionCounts> {
  const [students, teachers, supervisors, examiners, halqat] = await Promise.all([
    countActive('students', g), countRole('teacher', g), countRole('field_supervisor', g), countRole('examiner', g), countActive('halaqat', g)
  ])
  return { students, teachers, supervisors, examiners, halqat }
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
  const [m, f] = await Promise.all([loadSection('male'), loadSection('female')])
  counts.male = m
  counts.female = f
  await loadSettings()
}

// يُحمَّل عند معرفة الدور (الملف قد يصل بعد أول تصيير على العميل)
watch(showOverview, (v) => {
  if (v) loadManagerData()
}, { immediate: true })

// ── لوحة المعلّم: DashboardTeacherHome (تجلب بياناتها بنفسها — useTeacherDashboard) ──

// ── لوحة المشرف ──
type SHalqa = { id: string, name: string, teacher: string, students: number }
type SVisit = { id: string, halqa: string, scheduled_at: string }
const supHalqat = ref<SHalqa[]>([])
const supVisits = ref<SVisit[]>([])

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
  } catch (err) {
    handle(err)
  }
}

watch(isSupervisor, (v) => {
  if (v) loadSupervisorData()
}, { immediate: true })

// موعدُ الزيارة كشاشة الزيارات: `DD-MM-YYYY · HH:mm` بتوقيت غزة — الشهرُ بالرقم لا بالاسم (قرار المستخدم)
const fmtDateTime = (iso: string) => formatVisitMoment(iso)

// ── لوحة المدير الفني (كانت لوحة الجودة) — نطاقه القسمان، فكلّ المشرفين الميدانيين ──
type QSup = { id: string, name: string, halqat: number }
type QReport = { id: string, halqa: string, label: string }
const qSupervisors = ref<QSup[]>([])
const qHalqatCount = ref(0)
const qVisitsCount = ref(0)
const qReports = ref<QReport[]>([])
// العددُ الكلّيّ للمُرسَلة — القائمةُ تكتفي بأحدث 8
const qReportsCount = ref(0)

async function loadTechnicalData() {
  try {
    // المديرةُ ترى ملفّاتِ العاملين كلِّهم (لا تحجبها RLS)، فمشرفاتُ قسمها بالجنس صراحةً؛ والفنيُّ تحجب عنه RLS العاملات
    let supsQ = supabase.from('profiles').select('id, full_name').eq('role', 'field_supervisor').eq('status', 'active')
    if (isWomenAdmin.value) supsQ = supsQ.eq('gender', 'female')
    const { data: sups } = await supsQ.order('full_name')

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

    const { data: reps, count: repsCount } = await supabase
      .from('monthly_reports')
      .select('id, report_month, report_year, halaqa:halaqa_id(name)', { count: 'exact' })
      .eq('status', 'submitted')
      .order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(8)
      .returns<{ id: string, report_month: number, report_year: number, halaqa: { name: string } | null }[]>()
    qReports.value = (reps ?? []).map(r => ({ id: r.id, halqa: r.halaqa?.name ?? '—', label: periodLabel(r.report_year, r.report_month) }))
    qReportsCount.value = repsCount ?? qReports.value.length
  } catch (err) {
    handle(err)
  }
}

watch(isSectionHead, (v) => {
  if (v) loadTechnicalData()
}, { immediate: true })

// بطاقةٌ لكلّ فئةٍ بقسميها متجاورَين (`DashboardGenderSplit`)
const splitItems = computed(() => {
  const m = counts.male
  const f = counts.female
  return [
    { key: 'students', icon: 'i-lucide-graduation-cap', label: 'الطلاب والطالبات', male: m.students, female: f.students, maleLabel: 'طلاب', femaleLabel: 'طالبات' },
    { key: 'teachers', icon: 'i-lucide-users', label: 'المعلّمون والمعلّمات', male: m.teachers, female: f.teachers, maleLabel: 'معلّمون', femaleLabel: 'معلّمات' },
    { key: 'sups', icon: 'i-lucide-shield-check', label: 'المشرفون والمشرفات', male: m.supervisors, female: f.supervisors, maleLabel: 'مشرفون', femaleLabel: 'مشرفات' },
    { key: 'examiners', icon: 'i-lucide-award', label: 'المختبِرون والمختبِرات', male: m.examiners, female: f.examiners, maleLabel: 'مختبِرون', femaleLabel: 'مختبِرات' },
    { key: 'halqat', icon: 'i-lucide-book-open', label: 'الحلقات النشطة', male: m.halqat, female: f.halqat, maleLabel: 'بنين', femaleLabel: 'بنات' }
  ]
})

const settingCards = [
  { key: 'target_memorization_pages' as const, icon: 'i-lucide-book-open', tone: 'blue', title: 'المطلوب الشهريّ (صفحات)', unit: 'صفحة', desc: 'ما يُطالَب به كلُّ طالبٍ حفظاً في الشهر، ويُقسَّط بحضوره؛ عليه يُحكم بـ«أنجز» أو «مقصّر».' },
  { key: 'pass_mark' as const, icon: 'i-lucide-check-check', tone: 'green', title: 'علامة الاجتياز في الاختبار', unit: '%', desc: 'الحدّ الأدنى من 100 لاجتياز اختبار الطالب — يسري على الاختبارات اللاحقة.' }
]

/** الدورُ من الملفّ المحفوظ على الجهاز — يختار هيكلَ التحميل قبل وصول الملفّ. */
const cachedRole = import.meta.client ? readCache<{ role?: string }>(PROFILE_CACHE_KEY)?.role ?? null : null
</script>

<template>
  <div class="dash">
    <div class="welcome">
      <h2>أهلاً، {{ fullName }} 👋</h2>
      <!-- المعلّمُ بلا سطرٍ فرعيّ: لوحتُه أزرارٌ ومطلوبٌ لا أرقام (طلب المستخدم 2026-10-26) -->
      <p v-if="!isTeacher">
        {{ isExaminer ? 'ما ينتظر رصدَك، وأرقام اختباراتك هذا الشهر.' : 'إليك نظرة عامة على المشروع.' }}
      </p>
    </div>

    <ClientOnly>
      <!-- المعلّمُ (من ملفّه المحفوظ على الجهاز) يرى هيكلَ لوحته لا مربّعاتِ الإحصاء -->
      <DashboardTeacherSkeleton v-if="profilePending && cachedRole === 'teacher'" />
      <template v-else-if="profilePending">
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
        <!-- بطاقات إحصائية: كلُّ فئةٍ بقسميها البنين والبنات متجاورَين (طلب المستخدم 2026-10-22) -->
        <DashboardGenderSplit :items="splitItems" />

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
        <DashboardTeacherHome />
      </template>

      <template v-else-if="isExaminer">
        <DashboardExaminerHome />
      </template>

      <template v-else-if="isSupervisor">
        <ClientOnly>
          <!-- بطاقات إحصائية -->
          <!-- رصدُ الاختبارات للمختبِر لا للمشرف، فلا بطاقةَ له هنا (طلب المستخدم 2026-10-21) -->
          <div class="stats stats-2">
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
          </div>

          <div class="sup-grid">
            <!-- حلقاتي -->
            <div class="card sec">
              <div class="sec-head">
                <h3>حلقاتي</h3>
                <!-- إلى الحلقات بعددها (طلب المستخدم 2026-10-21) — كان إلى الزيارات -->
                <UButton
                  to="/halqat"
                  :label="`الحلقات (${supHalqat.length})`"
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
                    <span class="row-sub"><bdi dir="ltr">{{ fmtDateTime(v.scheduled_at) }}</bdi></span>
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
        </ClientOnly>
      </template>

      <template v-else-if="isSectionHead">
        <ClientOnly>
          <div class="stats stats-4">
            <UiStatCard
              icon="i-lucide-shield-check"
              tone="blue"
              :value="qSupervisors.length"
              :label="T.sups"
              stacked
            />
            <UiStatCard
              icon="i-lucide-book-open"
              tone="green"
              :value="qHalqatCount"
              label="الحلقات"
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
              :value="qReportsCount"
              label="تقارير مُرسلة (للاطّلاع)"
              stacked
            />
          </div>

          <!-- الإنجازُ القرآنيّ للحلقات للوهلة الأولى، وتفصيلُ كلٍّ للتواصل مع معلّمها (طلب المستخدم 2026-10-22) -->
          <DashboardHalaqatAchievement />
          <!-- متابعةُ الرصد صارت صفحةً مستقلّة /follow-up (طلب المستخدم 2026-10-22) -->

          <div class="sup-grid">
            <!-- المشرفون الميدانيون -->
            <div class="card sec">
              <div class="sec-head">
                <!-- العددُ بارزاً والرابطُ زرٌّ ظاهر (طلب المستخدم 2026-10-22) -->
                <h3>{{ T.sups }} <span class="count">{{ qSupervisors.length }}</span></h3>
                <UButton
                  to="/supervisors"
                  :label="T.supsBtn"
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-left"
                  :ui="{ base: 'rounded-[12px] font-semibold min-h-11' }"
                />
              </div>
              <UiEmptyState
                v-if="!qSupervisors.length"
                icon="i-lucide-shield"
                :title="T.noSups"
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
                <h3>{{ T.reports }} <span class="count">{{ qReportsCount }}</span></h3>
                <UButton
                  to="/reports"
                  label="التقارير"
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-chevron-left"
                  :ui="{ base: 'rounded-[12px] font-semibold min-h-11' }"
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

/* لوحة المشرف */
.stats-2 { grid-template-columns: repeat(2, 1fr); }
.stats-4 { grid-template-columns: repeat(4, 1fr); }
.sup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
.sec { padding: 20px 22px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.sec-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.row-title { font-weight: 600; color: var(--ink); }
.row-sub { font-size: 13px; color: var(--ink-3); }

@media (max-width: 1024px) { .stats { grid-template-columns: repeat(2, 1fr); } .settings { grid-template-columns: 1fr; } .sup-grid { grid-template-columns: 1fr; } .stats-4 { grid-template-columns: repeat(2, 1fr); } }
/* بطاقتان في السطر على الجوال (طلب المستخدم 2026-10-22) */
@media (max-width: 620px) { .stats, .stats-4 { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
</style>
