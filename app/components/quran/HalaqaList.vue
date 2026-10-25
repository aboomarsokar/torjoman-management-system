<script setup lang="ts">
/**
 * قائمةُ حلقات النطاق بحالة رصد الشهر المعروض (لم يبدأ · مسوّدة · مُرسَل · معتمَد) — تُعرض لغير المعلم
 * ما دام لم يختر حلقة، والضغطُ على حلقةٍ يفتح كشفَها. المُرسَلُ أوّلاً: هو ما ينتظر قرار المعتمِد.
 * فوقها إحصاءُ الحالات (طلب المستخدم 2026-10-21: كم حلقةً سلّمت، وكم مسوّدة، وكم لم تبدأ)، وكلُّ خانةٍ فلترٌ
 * يقصر القائمةَ على حالتها، وضغطُها ثانيةً يعيد الكلّ.
 */
import type { ReportStatus } from '~/utils/quran/screen'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

type State = ReportStatus | 'none'

const props = defineProps<{ items: { id: string, name: string, status: ReportStatus | null }[] }>()
const emit = defineEmits<{ pick: [id: string] }>()

const ORDER: Record<State, number> = { submitted: 0, draft: 1, none: 2, approved: 3 }
/** خاناتُ الإحصاء بترتيب ما ينتظر قراراً أوّلاً. */
const TILES: { state: State, label: string }[] = [
  { state: 'submitted', label: 'سلّمت — بانتظار الاعتماد' },
  { state: 'draft', label: 'مسوّدة' },
  { state: 'none', label: 'لم تبدأ' },
  { state: 'approved', label: 'معتمَدة' }
]

const filter = ref<State | null>(null)
const stateOf = (h: { status: ReportStatus | null }): State => h.status ?? 'none'
const counts = computed(() => {
  const c: Record<State, number> = { submitted: 0, draft: 0, none: 0, approved: 0 }
  for (const h of props.items) c[stateOf(h)]++
  return c
})
const sorted = computed(() => props.items
  .filter(h => !filter.value || stateOf(h) === filter.value)
  .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || a.name.localeCompare(b.name, 'ar')))

/** تغيّرُ الشهر قد يُفرغ الحالةَ المختارة: الفلترُ يبقى، والقائمةُ الفارغةُ تقول ذلك. */
function toggle(state: State) {
  filter.value = filter.value === state ? null : state
}
</script>

<template>
  <div class="hlw">
    <div
      class="hl-stats"
      role="group"
      aria-label="حالات رصد الشهر — اضغط للتصفية"
    >
      <button
        v-for="t in TILES"
        :key="t.state"
        type="button"
        class="hl-stat"
        :class="[`s-${t.state}`, { on: filter === t.state }]"
        :aria-pressed="filter === t.state"
        @click="toggle(t.state)"
      >
        <span class="hl-stat-n">{{ counts[t.state] }}</span>
        <span class="hl-stat-l">{{ t.label }}</span>
      </button>
    </div>

    <div
      v-if="filter"
      class="hl-filter"
    >
      <span>يُعرض: {{ TILES.find(t => t.state === filter)?.label }} ({{ sorted.length }} من {{ items.length }})</span>
      <UButton
        label="عرض الكلّ"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="filter = null"
      />
    </div>

    <ul
      v-if="sorted.length"
      class="hl"
    >
      <li
        v-for="(h, i) in sorted"
        :key="h.id"
      >
        <button
          type="button"
          class="hl-row"
          @click="emit('pick', h.id)"
        >
          <!-- ترقيمُ الصفوف (طلب المستخدم 2026-10-25) بدائرة متابعة الرصد الكحلية -->
          <span class="hl-seq">{{ i + 1 }}</span>
          <span class="hl-name">{{ h.name }}</span>
          <UBadge
            :color="REPORT_STATUS_COLORS[stateOf(h)]"
            variant="soft"
            size="lg"
            :label="REPORT_STATUS_LABELS[stateOf(h)]"
          />
          <UIcon
            name="i-lucide-chevron-left"
            class="size-5 hl-go"
          />
        </button>
      </li>
    </ul>
    <p
      v-else
      class="hl-empty"
    >
      لا حلقات بهذه الحالة في هذا الشهر.
    </p>
  </div>
</template>

<style scoped>
.hlw { margin: 0 0 16px; }

.hl-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.hl-stat {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 76px; padding: 12px 16px;
  border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface); box-shadow: var(--shadow);
  cursor: pointer; text-align: start; font: inherit; transition: border-color .15s, background-color .15s;
}
.hl-stat:hover { border-color: var(--blue); }
.hl-stat:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.hl-stat-n { font-size: 26px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.hl-stat-l { font-size: 13px; font-weight: 600; color: var(--ink-2); line-height: 1.5; }
/* لونُ الرقم من حالته (كشارات القائمة)، والخانةُ المختارة تمتلئ بخلفيّتها */
.s-submitted .hl-stat-n { color: var(--blue-ink); }
.s-draft .hl-stat-n { color: var(--chip-warn-ink); }
.s-none .hl-stat-n { color: var(--ink-2); }
.s-approved .hl-stat-n { color: var(--green-ink); }
.s-submitted.on { background: var(--blue-soft); border-color: var(--blue); }
.s-draft.on { background: var(--chip-warn-bg); border-color: var(--chip-warn-ink); }
.s-none.on { background: var(--surface-3); border-color: var(--ink-3); }
.s-approved.on { background: var(--green-soft); border-color: var(--green-ink); }

.hl-filter { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; font-size: 13.5px; color: var(--ink-2); }

.hl { list-style: none; margin: 0; padding: 6px 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.hl li + li { border-top: 1px solid var(--line); }
.hl-row { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px 20px; background: none; border: 0; cursor: pointer; text-align: start; color: var(--ink); font: inherit; }
.hl-row:hover { background: var(--surface-2); }
.hl-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.hl-name { flex: 1; font-size: 15.5px; font-weight: 600; }
.hl-seq { min-width: 28px; height: 28px; padding: 0 7px; flex: none; border-radius: 999px; background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.hl-go { color: var(--ink-3); }
.hl-empty { margin: 0; padding: 22px; text-align: center; font-size: 14px; color: var(--ink-3); background: var(--surface); border: 1px dashed var(--line-2); border-radius: var(--r-card); }

@media (max-width: 640px) {
  .hl-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
