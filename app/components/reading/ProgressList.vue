<script setup lang="ts">
/**
 * «إنجاز الطلاب» في البرامج المصاحبة — للمعلم والمشرف ومن فوقهما، اطّلاعاً: لكلّ طالبٍ في الحلقة المختارة
 * مقرّرُه الحالي، والمجتازُ من المقرّرات، وآخرُ علامة، وحالُه. الاسمُ يفتح رحلتَه في ملفّه.
 * البياناتُ من `useReadingProgress`. بعرض الصفحة جدولٌ بأعمدة (2026-11-11)، ويطوي صفوفاً تحت 760px.
 */
import type { ProgressState } from '~/utils/reading'
import { formatDay } from '~/utils/reportWindow'
import { isolateLtr } from '~/utils/transport'

const { halaqat, halaqaId, rows, pending } = useReadingProgress()

const halaqaPick = computed<string>({
  get: () => halaqaId.value ?? '',
  set: (v) => { halaqaId.value = v || null }
})
const halaqaItems = computed(() => (halaqat.value ?? []).map(h => ({ label: h.name, value: h.id })))

const STATE: Record<ProgressState, { label: string, cls: string }> = {
  behind: { label: 'متأخّر', cls: 'err' },
  waiting: { label: 'ينتظر الإعادة', cls: 'warn' },
  new: { label: 'جديد', cls: 'soft' },
  onTrack: { label: 'في المسار', cls: 'info' },
  ahead: { label: 'متقدّم', cls: 'ok' },
  done: { label: 'أتمّ المقرّرات', cls: 'ok' }
}
const STATE_ORDER: ProgressState[] = ['behind', 'waiting', 'new', 'onTrack', 'ahead', 'done']
/** عددُ الطلاب في كلّ حالةٍ حاضرة — شاراتُ الملخّص فوق الجدول. */
const summary = computed(() => STATE_ORDER
  .map(s => ({ state: s, n: rows.value.filter(r => r.state === s).length }))
  .filter(x => x.n > 0))
/** نسبةُ المجتاز لعرض الشريط. */
const passedPct = (passed: number, total: number) => total ? Math.round(passed / total * 100) : 0
</script>

<template>
  <section
    class="pl"
    aria-labelledby="pl-title"
  >
    <div class="pl-head">
      <!-- العنوانُ للقارئ الآليّ وحده: التبويبُ فوقه يحمله ظاهراً (2026-10-22) -->
      <h2
        id="pl-title"
        class="sr-only"
      >
        إنجاز الطلاب
      </h2>
      <UiSelect
        v-if="(halaqat ?? []).length > 1"
        v-model="halaqaPick"
        :items="halaqaItems"
        size="lg"
        class="pl-pick"
        aria-label="الحلقة"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
      />
      <ul
        v-if="rows.length && !pending"
        class="pl-sum"
        aria-label="ملخّص الحالات"
      >
        <li class="sum-total">
          <b>{{ rows.length }}</b> طالب
        </li>
        <li
          v-for="s in summary"
          :key="s.state"
          class="tag"
          :class="STATE[s.state].cls"
        >
          <b>{{ s.n }}</b> {{ STATE[s.state].label }}
        </li>
      </ul>
    </div>

    <p
      v-if="!(halaqat ?? []).length"
      class="none"
    >
      لا حلقات في نطاقك.
    </p>
    <div
      v-else-if="pending"
      class="none"
    >
      <UiSkeletonLines :fields="3" />
    </div>
    <p
      v-else-if="!rows.length"
      class="none"
    >
      لا طلاب نشطون في هذه الحلقة.
    </p>
    <div
      v-else
      class="tbl"
      role="table"
      aria-label="إنجاز الطلاب"
    >
      <div
        class="tr th"
        role="row"
      >
        <span role="columnheader">الطالب</span>
        <span role="columnheader">المقرّر الحالي</span>
        <span role="columnheader">المجتاز</span>
        <span role="columnheader">آخر علامة</span>
        <span role="columnheader">الحالة</span>
      </div>
      <div
        v-for="r in rows"
        :key="r.id"
        class="tr"
        role="row"
      >
        <span
          class="c-name"
          role="cell"
        >
          <NuxtLink
            :to="`/students/${r.id}?tab=journey`"
            class="name"
          >{{ r.name }}</NuxtLink>
        </span>
        <span
          class="c-unit"
          role="cell"
        >
          {{ r.current ? r.current.title : 'أتمّ المقرّرات كلّها' }}
          <small v-if="r.retryOn">يعيد من {{ isolateLtr(formatDay(r.retryOn)) }}</small>
        </span>
        <span
          class="c-pass"
          role="cell"
          :title="`اجتاز ${r.passed} من ${r.total}`"
        >
          <span class="num">{{ r.passed }}<small>/{{ r.total }}</small></span>
          <span
            class="bar"
            aria-hidden="true"
          ><i :style="{ inlineSize: `${passedPct(r.passed, r.total)}%` }" /></span>
        </span>
        <span
          class="c-last num"
          role="cell"
        >
          <template v-if="r.last !== null">{{ r.last }}<small>٪</small></template>
          <span
            v-else
            class="dash"
          >—</span>
        </span>
        <span
          class="c-state"
          role="cell"
        >
          <span
            class="tag"
            :class="STATE[r.state].cls"
          >{{ STATE[r.state].label }}</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pl { container-type: inline-size; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 20px 24px 8px; margin-bottom: 18px; }
.pl-head { display: flex; align-items: center; gap: 12px 20px; flex-wrap: wrap; margin-bottom: 14px; }
.pl-pick { width: 280px; max-width: 100%; }
.none { margin: 0 0 14px; color: var(--ink-3); font-size: 14px; }
.pl-sum { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sum-total { font-size: 14px; color: var(--ink-2); margin-inline-end: 4px; }
.pl-sum b { font-weight: 700; font-variant-numeric: tabular-nums; }
.sum-total b { color: var(--ink); }

.tr { display: grid; grid-template-columns: minmax(200px, 1.5fr) minmax(150px, 1fr) minmax(170px, 1.1fr) 100px 140px; align-items: center; gap: 16px; padding: 12px 10px; border-top: 1px solid var(--line); }
.tr:not(.th):hover { background: var(--surface-2); }
.th { border-top: none; padding-block: 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
.name { font-weight: 600; color: var(--ink); font-size: 15px; text-decoration: none; }
.name:hover { color: var(--blue-ink); text-decoration: underline; text-underline-offset: 3px; }
.name:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }
.c-unit { font-size: 14px; color: var(--ink-2); display: flex; flex-direction: column; }
.c-unit small { font-size: 12.5px; color: var(--ink-3); }
.c-pass { display: flex; align-items: center; gap: 12px; }
.bar { flex: 1; max-inline-size: 140px; block-size: 6px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.bar i { display: block; block-size: 100%; border-radius: inherit; background: var(--green); }
.num { font-size: 16px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; min-inline-size: 3.2em; }
.num small { font-size: 12px; font-weight: 500; color: var(--ink-3); }
.dash { color: var(--ink-3); font-weight: 400; }
.tag { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 2px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag.ok { background: var(--green-soft); color: var(--green-ink); }
.tag.info { background: var(--blue-soft); color: var(--blue-ink); }
.tag.err { background: var(--err-soft); color: var(--err); }
.tag.warn { background: var(--surface-3); color: var(--err); }
.tag.soft { background: var(--surface-3); color: var(--ink-2); }

@container (max-width: 760px) {
  .th { display: none; }
  .tr { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding-inline: 0; }
  .tr:not(.th):hover { background: none; }
  .c-name { grid-column: 1; }
  .c-state { grid-column: 2; grid-row: 1; }
  .c-unit { grid-column: 1 / -1; }
  .c-pass { grid-column: 1; }
  .c-last { grid-column: 2; grid-row: 3; text-align: end; }
  .pl-pick { width: 100%; }
}
@media (max-width: 560px) { .pl { padding: 16px 16px 4px; } }
</style>
