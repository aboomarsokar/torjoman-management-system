<script setup lang="ts">
/**
 * اختباراتُ طلاب الحلقات (طلب المستخدم 2026-10-22): يختار الناظرُ حلقةً من نطاقه (المختبِرُ حلقاتِه المسندة)،
 * فيظهر طلابُها النشطون بعدد اختباراتهم والمجتاز منها وآخرِ علامة؛ والضغطُ على الطالب يفتح اختباراتِه كلَّها
 * بتفصيل درجاتها (`ExamsResultDetailModal`). النطاقُ تحكمه RLS.
 */
import type { Database } from '~/types/database.types'
import { EXAM_MAX_TOTAL } from '~/constants/exams'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'اختبارات الطلاب — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const { role, profile } = useProfile()
const route = useRoute()
const router = useRouter()

type Halaqa = { id: string, name: string, teacher: { full_name: string } | null }
const { data: halqat, pending: hPending } = useLazyAsyncData<Halaqa[]>('exam-students-halqat', async () => {
  if (!role.value) return []
  let q = supabase.from('halaqat').select('id, name, teacher:teacher_id(full_name)').eq('status', 'active').order('name')
  if (role.value === 'examiner') q = q.eq('examiner_id', profile.value?.id ?? '')
  const { data, error } = await q.returns<Halaqa[]>()
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

const halaqaId = ref<string>(typeof route.query.h === 'string' ? route.query.h : '')
watch(halqat, (list) => {
  // القائمةُ فارغةٌ قبل وصولها: لا يُمسح اختيارُ ?h= القادمُ من لوحة المختبِر
  if (list.length && !list.some(h => h.id === halaqaId.value)) halaqaId.value = list[0]?.id ?? ''
}, { immediate: true })
watch(halaqaId, (h) => {
  if (h && route.query.h !== h) router.replace({ query: { ...route.query, h } })
})
const halaqaItems = computed(() => (halqat.value ?? []).map(h => ({ label: h.name, value: h.id })))
const current = computed(() => (halqat.value ?? []).find(h => h.id === halaqaId.value) ?? null)

type Row = { id: string, full_name: string, exams: number, passed: number, last: { score: number | null, passed: boolean | null, date: string } | null }
type Result = { student_id: string, passed: boolean | null, total_score: number | null, exam_date: string }
const { data: raw, pending: sPending } = useLazyAsyncData('exam-students-rows', async () => {
  if (!halaqaId.value) return { studs: [] as { id: string, full_name: string }[], results: [] as Result[] }
  const { data: studs, error } = await supabase.from('students').select('id, full_name')
    .eq('halaqa_id', halaqaId.value).eq('status', 'active').order('full_name')
  if (error) handle(error)
  const ids = (studs ?? []).map(s => s.id)
  const { data: results, error: rErr } = ids.length
    ? await supabase.from('exam_results').select('student_id, passed, total_score, exam_date').in('student_id', ids).order('exam_date', { ascending: false })
    : { data: [] as Result[], error: null }
  if (rErr) handle(rErr)
  return { studs: studs ?? [], results: results ?? [] }
}, { server: false, default: () => ({ studs: [], results: [] }), watch: [halaqaId] })

// فلترُ الشهر (طلب المستخدم 2026-10-22): أشهرُ الاختبارات المرصودة في الحلقة، أحدثُها أولاً، بالأرقام
const ALL = 'all' // Reka Select لا يقبل قيمةً فارغة
const month = ref(ALL)
const monthItems = computed(() => [
  { label: 'كلّ الأشهر', value: ALL },
  ...[...new Set(raw.value.results.map(r => r.exam_date.slice(0, 7)))].map((m) => {
    const [y, mo] = m.split('-')
    return { label: `${Number(mo)}/${y}`, value: m }
  })
])
watch(halaqaId, () => {
  month.value = ALL
})

const rows = computed<Row[]>(() => {
  const results = month.value !== ALL ? raw.value.results.filter(r => r.exam_date.startsWith(month.value)) : raw.value.results
  return raw.value.studs.map((s) => {
    const mine = results.filter(r => r.student_id === s.id)
    const l = mine[0]
    return {
      id: s.id,
      full_name: s.full_name,
      exams: mine.length,
      passed: mine.filter(r => r.passed === true).length,
      last: l ? { score: l.total_score, passed: l.passed, date: l.exam_date } : null
    }
  })
})

const stats = computed(() => {
  const list = rows.value ?? []
  const tested = list.filter(r => r.exams)
  return [
    { key: 'students', icon: 'i-lucide-graduation-cap', value: list.length, label: 'طالباً' },
    { key: 'tested', icon: 'i-lucide-clipboard-check', tone: 'green' as const, value: tested.length, label: 'اختُبر مرّةً على الأقلّ' },
    { key: 'exams', icon: 'i-lucide-clipboard-list', value: list.reduce((s, r) => s + r.exams, 0), label: 'اختباراً مرصوداً' },
    { key: 'passed', icon: 'i-lucide-award', tone: 'green' as const, value: list.reduce((s, r) => s + r.passed, 0), label: 'مجتازاً' }
  ]
})

const open = ref(false)
const picked = ref<{ id: string, name: string } | null>(null)
function openStudent(r: Row) {
  picked.value = { id: r.id, name: r.full_name }
  open.value = true
}
const day = (iso: string) => iso.split('-').reverse().join('-')
</script>

<template>
  <div class="es">
    <UiPageHeader
      title="اختبارات الطلاب"
      subtitle="اختر حلقةً، ثم اضغط على الطالب لترى اختباراته كلَّها بتفاصيل درجاتها."
    />

    <ClientOnly>
      <div class="card pick">
        <span class="pick-label">الحلقة</span>
        <UiSelect
          v-model="halaqaId"
          :items="halaqaItems"
          size="xl"
          class="pick-sel"
          aria-label="الحلقة"
          :disabled="!halaqaItems.length"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <span class="pick-label">الشهر</span>
        <UiSelect
          v-model="month"
          :items="monthItems"
          size="xl"
          class="pick-month"
          aria-label="الشهر"
          :disabled="monthItems.length < 2"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
        <span
          v-if="current?.teacher"
          class="pick-teacher"
        >المعلّم: {{ current.teacher.full_name }}</span>
      </div>

      <UiEmptyState
        v-if="!hPending && !halaqaItems.length"
        icon="i-lucide-book-open"
        title="لا حلقات مسندةٌ إليك"
      />
      <template v-else-if="halaqaId">
        <UiStatStrip
          v-if="!sPending && rows.length"
          :items="stats"
          label="أرقام اختبارات الحلقة"
        />
        <div
          v-if="sPending"
          class="list"
        >
          <UiSkeletonRow
            v-for="i in 4"
            :key="i"
          />
        </div>
        <UiEmptyState
          v-else-if="!rows.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون في هذه الحلقة"
        />
        <ul
          v-else
          class="list"
        >
          <li
            v-for="r in rows"
            :key="r.id"
          >
            <button
              type="button"
              class="row"
              :disabled="!r.exams"
              @click="openStudent(r)"
            >
              <span class="row-main">
                <span class="row-title">{{ r.full_name }}</span>
                <span class="row-sub">
                  <template v-if="r.exams">{{ r.exams }} اختبار · اجتاز {{ r.passed }}<template v-if="r.last"> · آخرُها <bdi dir="ltr">{{ day(r.last.date) }}</bdi></template></template>
                  <template v-else>{{ month !== ALL ? 'لم يُختبر في هذا الشهر' : 'لم يُختبر بعد' }}</template>
                </span>
              </span>
              <span
                v-if="r.last"
                class="row-score"
                :class="r.last.passed ? 'ok' : 'no'"
              ><b>{{ r.last.score ?? '—' }}</b>/{{ EXAM_MAX_TOTAL }}</span>
              <UIcon
                v-if="r.exams"
                name="i-lucide-chevron-left"
                class="size-5 row-go"
              />
            </button>
          </li>
        </ul>
      </template>
    </ClientOnly>

    <ExamsResultDetailModal
      v-model:open="open"
      :student-id="picked?.id ?? null"
      :student-name="picked?.name ?? ''"
      :result-id="null"
    />
  </div>
</template>

<style scoped>
.es { display: flex; flex-direction: column; gap: 16px; }
.es :deep(.head) { margin-bottom: 0; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.pick { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; padding: 14px 18px; }
.pick-label { font-size: 14px; font-weight: 600; color: var(--ink-2); }
.pick-sel { width: 280px; max-width: 100%; }
.pick-month { width: 160px; }
.pick-teacher { font-size: 13.5px; color: var(--ink-3); }
.list { list-style: none; margin: 0; padding: 6px 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.list li + li { border-top: 1px solid var(--line); }
.row { width: 100%; min-height: 60px; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: none; border: 0; text-align: start; font: inherit; color: var(--ink); cursor: pointer; }
.row:hover:not(:disabled) { background: var(--surface-2); }
.row:disabled { cursor: default; }
.row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-title { font-size: 15.5px; font-weight: 600; }
.row-sub { font-size: 13px; color: var(--ink-3); }
.row-score { padding: 3px 10px; border-radius: 10px; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.row-score b { font-size: 16px; }
.row-score.ok { background: var(--green-soft); color: var(--green-ink); }
.row-score.no { background: var(--err-soft); color: var(--err); }
.row-go { color: var(--ink-3); }
@media (max-width: 560px) { .pick-sel, .pick-month { width: 100%; } }
</style>
