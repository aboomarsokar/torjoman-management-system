<script setup lang="ts">
/**
 * «الإنجاز القرآني للحلقات» (حفظُ خطة الشهر — لا البرامج المصاحبة؛ سُمّي هكذا بعد لبسٍ 2026-10-22) في لوحة المدير الفنيّ (طلب المستخدم 2026-10-22): للوهلة الأولى نسبةُ المنجزين كلِّهم وعددُ الحلقات
 * المتأخّرة، ثم سطرٌ لكلّ حلقةٍ بشريطٍ ونسبة «أنجز X من Y» والأضعفُ أولاً؛ والضغطُ يفتح التفصيلَ والتواصلَ مع المعلم.
 * الشهرُ الافتراضيُّ السابقُ لشهر اليوم، ويُختار من آخر ستة أشهر (بالأرقام).
 */
import type { AchievementRow } from '~/utils/halaqatAchievement'
import { ACHIEVEMENT_LOW_PCT, achievementPct, defaultAchievementMonth, measuredOf } from '~/utils/halaqatAchievement'
import { shiftMonth } from '~/utils/reportWindow'

const MONTHS_BACK = 6
// المديرةُ الإدارية قسمُها إناث: التسمياتُ بالمؤنّث (قرار المستخدم 2026-10-22)
const { isWomenAdmin: fem } = usePermissions()

const initial = defaultAchievementMonth()
const year = ref(initial.year)
const month = ref(initial.month)
const monthItems = Array.from({ length: MONTHS_BACK }, (_, i) => {
  const m = shiftMonth(initial.year, initial.month, -i)
  return { label: `${m.month}/${m.year}`, value: `${m.year}-${m.month}` }
})
const monthKey = computed({
  get: () => `${year.value}-${month.value}`,
  set: (v: string) => {
    const [y, m] = v.split('-').map(Number)
    year.value = y!
    month.value = m!
  }
})

const { rows, totals, pending } = useHalaqatAchievement(year, month)

const open = ref(false)
const picked = ref<AchievementRow | null>(null)
function openRow(r: AchievementRow) {
  picked.value = r
  open.value = true
}
const toneOf = (p: number | null) => p === null ? 'neutral' : p < ACHIEVEMENT_LOW_PCT ? 'err' : p < 80 ? 'warn' : 'ok'
</script>

<template>
  <section class="card ha">
    <div class="ha-head">
      <h3>الإنجاز القرآني للحلقات</h3>
      <UiSelect
        v-model="monthKey"
        :items="monthItems"
        size="lg"
        class="ha-month"
        aria-label="الشهر"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
      />
    </div>

    <UiSkeletonLines
      v-if="pending && !rows.length"
      :fields="3"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-book-open"
      title="لا حلقاتٍ نشطة في نطاقك"
    />
    <template v-else>
      <div class="ha-sum">
        <div class="ha-big">
          <b :class="`t-${toneOf(totals.pct)}`">{{ totals.pct === null ? '—' : `${totals.pct}٪` }}</b>
          <span>{{ fem ? 'أنجزت' : 'أنجز' }} {{ totals.done }} من {{ totals.measured }} {{ fem ? 'طالبةً' : 'طالباً' }} خطةَ الحفظ هذا الشهر</span>
        </div>
        <div
          class="ha-low"
          :class="{ on: totals.low }"
        >
          <b>{{ totals.low }}</b>
          <span>{{ totals.low === 1 ? 'حلقةٌ' : 'حلقات' }} دون {{ ACHIEVEMENT_LOW_PCT }}٪ من {{ totals.halqat }}</span>
        </div>
      </div>

      <ul class="ha-rows">
        <li
          v-for="r in rows"
          :key="r.halaqa_id"
        >
          <button
            type="button"
            class="ha-row"
            @click="openRow(r)"
          >
            <span class="ha-main">
              <span class="ha-name">{{ r.halaqa_name }}</span>
              <span class="ha-sub">{{ fem ? 'المعلّمة' : 'المعلّم' }}: {{ r.teacher_name ?? '—' }}<template v-if="r.short"> · {{ fem ? 'مقصّرات' : 'مقصّرون' }} {{ r.short }}</template><template v-if="r.unrecorded"> · لم يُرصد {{ r.unrecorded }}</template></span>
              <span
                class="ha-bar"
                :class="`b-${toneOf(achievementPct(r))}`"
              ><i :style="{ width: `${achievementPct(r) ?? 0}%` }" /></span>
            </span>
            <span class="ha-num">
              <b>{{ achievementPct(r) === null ? '—' : `${achievementPct(r)}٪` }}</b>
              <span>{{ r.done }} من {{ measuredOf(r) }}</span>
            </span>
            <UIcon
              name="i-lucide-chevron-left"
              class="size-5 ha-go"
            />
          </button>
        </li>
      </ul>
    </template>

    <DashboardAchievementHalaqaModal
      v-model:open="open"
      :row="picked"
      :year="year"
      :month="month"
    />
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
.ha { padding: 20px 22px; margin-bottom: 18px; }
.ha-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.ha-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.ha-month { width: 130px; }
.ha-sum { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px; }
.ha-big, .ha-low { padding: 14px 16px; border-radius: 14px; background: var(--surface-2); display: flex; flex-direction: column; gap: 4px; }
.ha-big b { font-size: 30px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; }
.ha-low b { font-size: 24px; line-height: 1; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.ha-low.on b { color: var(--err); }
.ha-big span, .ha-low span { font-size: 13px; color: var(--ink-2); }
.t-err { color: var(--err); }
.t-warn { color: var(--chip-warn-ink); }
.t-ok { color: var(--green-ink); }
.t-neutral { color: var(--ink-2); }
.ha-rows { list-style: none; margin: 0; padding: 0; }
.ha-rows li + li { border-top: 1px solid var(--line); }
.ha-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 4px; min-height: 60px; background: none; border: 0; font: inherit; color: inherit; text-align: start; cursor: pointer; border-radius: 12px; }
.ha-row:hover { background: var(--surface-2); }
.ha-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.ha-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ha-name { font-size: 15.5px; font-weight: 600; color: var(--ink); }
.ha-sub { font-size: 12.5px; color: var(--ink-3); }
.ha-bar { display: block; height: 7px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.ha-bar i { display: block; height: 100%; border-radius: inherit; }
.b-err i { background: var(--err); }
.b-warn i { background: var(--chip-warn-ink); }
.b-ok i { background: var(--green); }
.b-neutral i { background: var(--ink-3); }
.ha-num { display: flex; flex-direction: column; align-items: flex-end; min-width: 64px; }
.ha-num b { font-size: 17px; color: var(--ink); font-variant-numeric: tabular-nums; }
.ha-num span { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
.ha-go { color: var(--ink-3); flex: none; }
@media (max-width: 560px) {
  .ha { padding: 16px; }
  .ha-sum { grid-template-columns: 1fr; }
}
</style>
