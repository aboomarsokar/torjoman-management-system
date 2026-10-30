<script setup lang="ts">
/**
 * استمارةُ تحكيم المرشّحين للطباعة (طلب المستخدم 2026-10-30) — بشكل الاستمارة الورقية المعتمدة: أعضاءُ اللجنة، وبنودُ التقييم
 * العشرة بأوزانها، و14 صفّاً في الصفحة. تُعبّأ بمرشّحي يوم مقابلةٍ يُختار، أو تُطبع فارغة. أفقيّة A4.
 */
import { CANDIDATE_CRITERIA } from '~/constants/candidates'
import type { Candidate } from '~/composables/useCandidates'

definePageMeta({ layout: false })
useSeoMeta({ title: 'استمارة تحكيم المرشّحين — ترجمان' })

const ROWS_PER_PAGE = 14
const COMMITTEE_SLOTS = 5
const api = useCandidates()
onMounted(() => void api.load())

const gazaDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Gaza' })
const days = computed(() => [...new Set(api.candidates.value.filter(c => c.interview_at).map(c => gazaDay(c.interview_at!)))].sort())
const day = ref('')
watch(days, (d) => {
  if (!day.value && d.length) day.value = d[d.length - 1]!
}, { immediate: true })
const dayItems = computed(() => [{ label: 'استمارة فارغة', value: '' }, ...days.value.map(d => ({ label: d.split('-').reverse().join('-'), value: d }))])

const people = computed<Candidate[]>(() => day.value
  ? api.candidates.value.filter(c => c.interview_at && gazaDay(c.interview_at) === day.value)
      .sort((a, b) => a.interview_at!.localeCompare(b.interview_at!))
  : [])
const pages = computed(() => {
  const n = Math.max(1, Math.ceil(people.value.length / ROWS_PER_PAGE))
  return Array.from({ length: n }, (_, p) => Array.from({ length: ROWS_PER_PAGE }, (_, i) => people.value[p * ROWS_PER_PAGE + i] ?? null))
})
const weekday = (iso: string) => new Date(iso).toLocaleDateString('ar-EG', { timeZone: 'Asia/Gaza', weekday: 'long' })
const date = (iso: string) => gazaDay(iso).split('-').reverse().join('-')
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit' })
const committee = computed(() => {
  const ids = [...new Set(people.value.flatMap(c => c.committee))]
  return Array.from({ length: COMMITTEE_SLOTS }, (_, i) => ids[i] ?? null)
})
const staffNames = ref<Record<string, string>>({})
onMounted(async () => {
  await api.loadStaff()
  staffNames.value = Object.fromEntries(api.staff.value.map(s => [s.id, s.name]))
})
const print = () => window.print()
</script>

<template>
  <div class="sh-wrap">
    <div class="sh-controls">
      <NuxtLink
        to="/candidates"
        class="sh-back"
      >
        <UIcon
          name="i-lucide-arrow-right"
          class="size-4"
        />مقابلات المرشّحين
      </NuxtLink>
      <UiSelect
        v-model="day"
        :items="dayItems"
        aria-label="يوم المقابلة"
        class="sh-day"
      />
      <UButton
        label="اطبع"
        icon="i-lucide-printer"
        color="primary"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="print"
      />
    </div>

    <section
      v-for="(rows, p) in pages"
      :key="p"
      class="sheet"
    >
      <header class="sh-head">
        <div>
          <h1>استمارة تحكيم المرشّحين</h1>
          <p>يُقيَّم كلُّ بندٍ من 5 · تحويلُ العلامات حسب الأوزان يتمّ لاحقاً</p>
          <span class="sh-chip">المرشّحون</span>
        </div>
        <div class="sh-side">
          <div class="sh-box sh-committee">
            <small>أعضاء اللجنة</small>
            <div>
              <span
                v-for="(id, i) in committee"
                :key="i"
              ><i>{{ i + 1 }}</i>{{ id ? staffNames[id] ?? '' : '' }}</span>
            </div>
          </div>
          <div class="sh-box">
            <small>الصفحة</small><b>{{ p + 1 }} من {{ pages.length }}</b>
          </div>
          <img
            src="/brand/turjuman-full.svg"
            alt="ترجمان"
            class="sh-logo"
          >
        </div>
      </header>

      <table class="sh-table">
        <thead>
          <tr>
            <th class="c-n">
              م
            </th><th class="c-name">
              الاسم
            </th><th>رقم الجوال</th><th>الجنس</th><th>يوم المقابلة</th><th>التاريخ</th><th>موعد المقابلة</th>
            <th
              v-for="c in CANDIDATE_CRITERIA"
              :key="c.key"
              class="c-crit"
            >
              {{ c.label }}
            </th>
            <th class="c-notes">
              ملاحظات
            </th>
          </tr>
          <tr class="sh-weights">
            <td colspan="7">
              <b>ضع لكلّ بندٍ علامةً من 5</b> — الأرقام التالية أوزان التحويل ←
            </td>
            <td
              v-for="c in CANDIDATE_CRITERIA"
              :key="c.key"
            >
              {{ c.weight }}
            </td>
            <td />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(c, i) in rows"
            :key="i"
            :class="c ? `g-${c.gender}` : ''"
          >
            <td class="c-n">
              {{ p * ROWS_PER_PAGE + i + 1 }}
            </td>
            <td class="c-name">
              {{ c?.full_name ?? '' }}
            </td>
            <td dir="ltr">
              {{ c?.phone ?? '' }}
            </td>
            <td>{{ c ? (c.gender === 'female' ? 'أنثى' : 'ذكر') : '' }}</td>
            <td>{{ c?.interview_at ? weekday(c.interview_at) : '' }}</td>
            <td dir="ltr">
              {{ c?.interview_at ? date(c.interview_at) : '' }}
            </td>
            <td dir="ltr">
              {{ c?.interview_at ? time(c.interview_at) : '' }}
            </td>
            <td
              v-for="k in CANDIDATE_CRITERIA"
              :key="k.key"
            />
            <td />
          </tr>
        </tbody>
      </table>
      <footer class="sh-foot">
        <span class="sh-legend"><i class="g-female" /> إناث <i class="g-male" /> ذكور</span>
        <span>استمارة تحكيم المرشّحين · منصة ترجمان القرآنية</span>
        <span>مجموع الأوزان = 100 درجة</span>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.sh-wrap { min-height: 100vh; background: var(--bg); padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
.sh-controls { width: min(100%, 297mm); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sh-back { display: inline-flex; align-items: center; gap: 6px; color: var(--blue-ink); font-weight: 600; margin-inline-end: auto; }
.sh-day { width: 200px; }
.sheet {
  width: 297mm; min-height: 210mm; background: var(--sheet-bg); color: var(--sheet-ink); padding: 10mm 12mm; box-shadow: var(--shadow-lg);
  border-radius: 12px; display: flex; flex-direction: column; gap: 6mm; direction: rtl;
}
.sh-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; padding-bottom: 4mm; border-bottom: 2px solid var(--sheet-navy); }
.sh-head h1 { margin: 0; font-size: 22px; color: var(--sheet-navy); }
.sh-head p { margin: 2px 0 6px; font-size: 12px; color: var(--sheet-muted); }
.sh-chip { display: inline-block; padding: 2px 12px; border: 1px solid var(--sheet-line); border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--sheet-navy); }
.sh-side { display: flex; align-items: center; gap: 4mm; }
.sh-box { border: 1px solid var(--sheet-line); border-radius: 8px; padding: 4px 10px; display: flex; flex-direction: column; font-size: 12px; }
.sh-box small { font-size: 10px; color: var(--sheet-soft); }
.sh-committee div { display: flex; gap: 10px; }
.sh-committee span { min-width: 30mm; border-bottom: 1px dashed var(--sheet-grid); font-size: 11px; display: flex; gap: 6px; padding-top: 6px; }
.sh-committee i { font-style: normal; color: var(--sheet-soft); }
.sh-logo { height: 13mm; width: auto; }
.sh-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5px; }
.sh-table th { background: var(--sheet-navy); color: var(--sheet-bg); font-weight: 600; padding: 5px 3px; border: 1px solid var(--sheet-head-line); line-height: 1.35; }
.sh-table td { border: 1px solid var(--sheet-grid); height: 8.6mm; text-align: center; padding: 0 3px; }
.sh-table .c-n { width: 7mm; }
.sh-table .c-name { width: 44mm; text-align: start; }
.sh-table .c-crit { width: 15mm; }
.sh-table .c-notes { width: 26mm; }
.sh-weights td { background: var(--sheet-weight); font-weight: 700; color: var(--sheet-navy); height: auto; padding: 4px 3px; }
.sh-weights td:first-child { text-align: start; font-weight: 400; color: var(--sheet-muted); }
.sh-weights b { color: var(--sheet-navy); }
tr.g-female td { background: var(--sheet-female); }
tr.g-male td { background: var(--sheet-male); }
.sh-foot { display: flex; justify-content: space-between; align-items: center; gap: 6mm; font-size: 11px; color: var(--sheet-soft); border-top: 1px solid var(--sheet-line); padding-top: 3mm; margin-top: auto; }
.sh-legend { display: inline-flex; align-items: center; gap: 6px; }
.sh-legend i { width: 10px; height: 10px; border-radius: 3px; border: 1px solid var(--sheet-grid); display: inline-block; }
.sh-legend i.g-female { background: var(--sheet-female); }
.sh-legend i.g-male { background: var(--sheet-male); }
@media print {
  @page { size: A4 landscape; margin: 0; }
  .sh-wrap { padding: 0; background: var(--sheet-bg); gap: 0; }
  .sh-controls { display: none; }
  .sheet { box-shadow: none; border-radius: 0; break-after: page; }
  .sheet:last-child { break-after: auto; }
}
</style>
