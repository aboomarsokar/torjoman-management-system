<script setup lang="ts">
/**
 * «إنجاز الطلاب» في البرامج المصاحبة — للمعلم والمشرف ومن فوقهما، اطّلاعاً: لكلّ طالبٍ في الحلقة المختارة
 * مقرّرُه الحالي، والمجتازُ من المقرّرات، وآخرُ علامة، وحالُه. الاسمُ يفتح رحلتَه في ملفّه.
 * البياناتُ من `useReadingProgress`.
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
const counts = computed(() => ({
  behind: rows.value.filter(r => r.state === 'behind').length,
  waiting: rows.value.filter(r => r.state === 'waiting').length
}))
</script>

<template>
  <section
    class="pl"
    aria-labelledby="pl-title"
  >
    <div class="pl-head">
      <h2 id="pl-title">
        إنجاز الطلاب
      </h2>
      <UiSelect
        v-if="(halaqat ?? []).length > 1"
        v-model="halaqaPick"
        :items="halaqaItems"
        size="lg"
        class="pl-pick"
        aria-label="الحلقة"
      />
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
    <template v-else>
      <p class="pl-sum">
        {{ rows.length }} طالب<template v-if="counts.behind">
          · <strong class="t-err">{{ counts.behind }} متأخّر</strong>
        </template><template v-if="counts.waiting">
          · {{ counts.waiting }} ينتظر الإعادة
        </template>
      </p>
      <ul class="rows">
        <li
          v-for="r in rows"
          :key="r.id"
          class="row"
        >
          <div class="who">
            <NuxtLink
              :to="`/students/${r.id}?tab=journey`"
              class="name"
            >
              {{ r.name }}
            </NuxtLink>
            <span class="unit">{{ r.current ? r.current.title : 'أتمّ المقرّرات كلّها' }}<template v-if="r.retryOn"> · يعيد من {{ isolateLtr(formatDay(r.retryOn)) }}</template></span>
          </div>
          <div class="nums">
            <span
              class="num"
              :title="`اجتاز ${r.passed} من ${r.total}`"
            >{{ r.passed }}<small>/{{ r.total }}</small></span>
            <span
              v-if="r.last !== null"
              class="num"
              title="آخر علامة"
            >{{ r.last }}<small>٪</small></span>
          </div>
          <span
            class="tag"
            :class="STATE[r.state].cls"
          >{{ STATE[r.state].label }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.pl { container-type: inline-size; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 20px 22px; margin-bottom: 18px; }
.pl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.pl-pick { width: 220px; }
.none { margin: 0; color: var(--ink-3); font-size: 14px; }
.pl-sum { margin: 0 0 8px; font-size: 14px; color: var(--ink-2); }
.t-err { color: var(--err); }
.rows { list-style: none; margin: 0; padding: 0; }
.row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-weight: 700; color: var(--ink); font-size: 15px; text-decoration: none; }
.name:hover { color: var(--blue-ink); text-decoration: underline; text-underline-offset: 3px; }
.unit { font-size: 13px; color: var(--ink-2); }
.nums { display: flex; gap: 14px; flex: none; }
.num { font-size: 17px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.num small { font-size: 12px; font-weight: 600; color: var(--ink-3); }
.tag { flex: none; display: inline-flex; align-items: center; min-height: 26px; padding: 2px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.tag.ok { background: var(--green-soft); color: var(--green-ink); }
.tag.info { background: var(--blue-soft); color: var(--blue-ink); }
.tag.err { background: var(--err-soft); color: var(--err); }
.tag.warn { background: var(--surface-3); color: var(--err); }
.tag.soft { background: var(--surface-3); color: var(--ink-2); }

@container (max-width: 480px) {
  .pl-pick { width: 100%; }
  .row { flex-wrap: wrap; row-gap: 6px; }
  .who { flex-basis: 100%; }
  .tag { margin-inline-start: auto; }
}
@media (max-width: 560px) { .pl { padding: 16px; } }
</style>
