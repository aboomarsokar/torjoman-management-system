<script setup lang="ts">
/**
 * سجلُّ تقييم الجودة الشهريّ للمعلمين (قرارات المستخدم 2026-10-21): الشهرُ في الرابط (`?y=&m=`، افتراضاً الشهرُ السابق
 * لأنّ رصدَ الشهر يُتاح بعد انقضائه ومهلةِ تقاريره)، وسطرٌ لكلّ حلقةٍ نشطة ذاتِ مشرفٍ في النطاق: معلّمُها وحالُ سجلّه
 * وتقييمُه النهائيّ؛ والضغطُ يفتح الورقة (`QualityRecordModal`). المديرُ الإداري يرصد البنودَ العامة ويُقفل (والمشرفُ زيارتيه في نموذج الزيارة — قرار 2026-10-22)، والإدارةُ تفتح،
 * والمديرُ الفنيّ يكتب ملاحظات الإدارة، والمعلمُ يرى سجلّه ويُقرّ. النطاقُ تحكمه RLS.
 */
import type { Database } from '~/types/database.types'
import type { QualityHalaqa, QualityRow } from '~/utils/qualityRecord'
import { FINAL_MAX, QUALITY_STATE_META, fmtScore, qualityState } from '~/utils/qualityRecord'
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import { fetchQualityHalqat, fetchQualityRecords, SCREEN_KEYS } from '~/utils/teacherScreens'
import { clampToProjectStart, isBeforeProjectStart } from '~/utils/projectStart'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'تقييم المعلمين — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const route = useRoute()
const router = useRouter()
const { role, isTeacher } = usePermissions()

const [ty, tm] = gazaToday().split('-').map(Number) as [number, number]
const max = { year: ty, month: tm }
const prev = clampToProjectStart(shiftMonth(ty, tm, -1))
function fromQuery() {
  const y = Number(route.query.y)
  const m = Number(route.query.m)
  const ok = Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12 && !isBeforeProjectStart({ year: y, month: m }) && y * 12 + m <= ty * 12 + tm
  return ok ? { year: y, month: m } : prev
}
const initial = fromQuery()
const year = ref(initial.year)
const month = ref(initial.month)
watch([year, month], ([y, m]) => {
  if (Number(route.query.y) !== y || Number(route.query.m) !== m) router.replace({ query: { ...route.query, y: String(y), m: String(m) } })
})

// والمعلّمُ تُحفظ له نسخةٌ لكلّ شهرٍ فتحه تُعرض بلا إنترنت (البند 14، 2026-10-27)
const { wrap } = useOfflineCopy()
const recordsKey = () => SCREEN_KEYS.qualityRecords(year.value, month.value)
const { data: halqat, pending: hPending } = useLazyAsyncData<QualityHalaqa[]>(SCREEN_KEYS.qualityHalqat, wrap(SCREEN_KEYS.qualityHalqat, async () => {
  if (!role.value) return []
  try {
    return await fetchQualityHalqat(supabase)
  } catch (err) {
    handle(err)
    return []
  }
}), { server: false, default: () => [], watch: [role] })

const { data: records, pending: rPending, refresh } = useLazyAsyncData<QualityRow[]>('quality-records', wrap(recordsKey, async () => {
  if (!role.value) return []
  try {
    return await fetchQualityRecords(supabase, year.value, month.value)
  } catch (err) {
    handle(err)
    return []
  }
}), { server: false, default: () => [], watch: [role, year, month] })

/** سجلُّ الشهر لحلقة (النوعُ صريحٌ: استنتاجُ Json العميق يُتعب المترجم). */
function recordOf(halaqaId: string): QualityRow | null {
  return (records.value ?? []).find(r => r.halaqa_id === halaqaId) ?? null
}
const rows = computed(() => (halqat.value ?? []).map((h) => {
  const rec = recordOf(h.id)
  return { h, rec, state: qualityState(rec) }
}))
const counts = computed(() => {
  const c = { none: 0, open: 0, locked: 0, acknowledged: 0 }
  for (const r of rows.value) c[r.state]++
  return c
})

const opened = ref(false)
const current = ref<{ h: QualityHalaqa, rec: QualityRow | null } | null>(null)
function openRow(r: { h: QualityHalaqa, rec: QualityRow | null }) {
  current.value = r
  opened.value = true
}
// بعد حفظٍ أو فتحٍ أو اطّلاع: يُعاد الجلب ويُحدَّث سجلُّ النافذة المفتوحة
async function onChanged() {
  await refresh()
  const cur = current.value
  if (cur) current.value = { h: cur.h, rec: recordOf(cur.h.id) }
}
</script>

<template>
  <div class="quality">
    <UiPageHeader
      :title="isTeacher ? 'تقييمي الشهري' : 'تقييم المعلمين'"
      :subtitle="isTeacher ? 'سجلّ تقييمك الشهريّ — اطّلع على تفاصيله وأقِرّ.' : 'تقييمُ المعلم الشهريّ: الزيارات والبنود الشهرية (الجودة من 50) وإنجاز الحلقة (من 50).'"
    />
    <OfflineSavedNote :keys="[SCREEN_KEYS.qualityHalqat, recordsKey()]" />

    <div class="card month">
      <span class="month-label">الشهر</span>
      <QuranMonthPicker
        v-model:year="year"
        v-model:month="month"
        :max="max"
      />
    </div>

    <ClientOnly>
      <UiStatStrip
        v-if="!isTeacher && rows.length"
        :items="[
          { key: 'none', icon: 'i-lucide-circle-dashed', tone: 'neutral', value: counts.none, label: 'لم يُرصد' },
          { key: 'locked', icon: 'i-lucide-lock', value: counts.locked, label: 'بانتظار اطّلاع المعلم' },
          { key: 'ack', icon: 'i-lucide-check-check', tone: 'green', value: counts.acknowledged, label: 'اطّلع المعلم' },
          { key: 'open', icon: 'i-lucide-lock-open', tone: counts.open ? 'err' : 'neutral', value: counts.open, label: 'مفتوحٌ للتعديل' }
        ]"
        label="أرقام تقييم المعلمين"
      />

      <div
        v-if="hPending || rPending"
        class="list"
      >
        <UiSkeletonRow
          v-for="i in 3"
          :key="i"
        />
      </div>
      <UiEmptyState
        v-else-if="!rows.length"
        icon="i-lucide-clipboard-list"
        title="لا حلقات في نطاقك"
        description="سجلُّ الجودة لكلّ حلقةٍ نشطة لها مشرفٌ ميدانيّ."
      />
      <ul
        v-else
        class="list"
      >
        <li
          v-for="r in rows"
          :key="r.h.id"
        >
          <button
            type="button"
            class="row"
            @click="openRow(r)"
          >
            <span class="row-main">
              <span class="row-title">{{ r.h.teacher?.full_name ?? 'بلا معلّم' }}</span>
              <span class="row-sub">{{ r.h.name }}<template v-if="!isTeacher"> · المشرف {{ r.h.supervisor?.full_name ?? '—' }}</template></span>
            </span>
            <span
              v-if="r.rec"
              class="row-score"
            ><b>{{ fmtScore(r.rec.final === null ? null : Number(r.rec.final)) }}</b><small>/ {{ FINAL_MAX }}</small></span>
            <UBadge
              :label="QUALITY_STATE_META[r.state].label"
              :color="QUALITY_STATE_META[r.state].color"
              variant="soft"
            />
            <UIcon
              name="i-lucide-chevron-left"
              class="size-5 row-go"
            />
          </button>
        </li>
      </ul>
    </ClientOnly>

    <QualityRecordModal
      v-model:open="opened"
      :halaqa="current?.h ?? null"
      :record="current?.rec ?? null"
      :year="year"
      :month="month"
      @changed="onChanged"
    />
  </div>
</template>

<style scoped>
.quality { display: flex; flex-direction: column; gap: 16px; }
.quality :deep(.head) { margin-bottom: 0; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.month { display: flex; align-items: center; gap: 14px; padding: 14px 18px; }
.month-label { flex: none; font-size: 14px; font-weight: 600; color: var(--ink-2); }
.list { list-style: none; margin: 0; padding: 6px 0; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.list li + li { border-top: 1px solid var(--line); }
.row { width: 100%; min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: none; border: 0; cursor: pointer; text-align: start; font: inherit; color: var(--ink); }
.row:hover { background: var(--surface-2); }
.row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row-title { font-size: 15.5px; font-weight: 600; }
.row-sub { font-size: 13px; color: var(--ink-3); }
.row-score { display: flex; align-items: baseline; gap: 3px; font-variant-numeric: tabular-nums; }
.row-score b { font-size: 18px; color: var(--ink); }
.row-score small { font-size: 12px; color: var(--ink-3); }
.row-go { color: var(--ink-3); }
@media (max-width: 560px) {
  .month { flex-direction: column; align-items: stretch; gap: 8px; }
  .row { flex-wrap: wrap; }
}
</style>
