<script setup lang="ts">
/**
 * سطرُ زيارات الشهر لحلقةٍ في «متابعة الرصد» (طلب المستخدم 2026-11-02): «زيارات الشهر 1 من 2» ملوّنةً حين تنقص،
 * وعلامةُ كلّ زيارةٍ من 42 بتاريخها وزائرها، والمعدّل، وما جُدول ولم يُنفَّذ — أيًّا كان الزائر.
 */
import type { HalaqaVisits } from '~/utils/monthVisits'
import { VISITS_PER_MONTH } from '~/utils/monthVisits'
import { VISIT_MAX } from '~/utils/visitForm'

interface Props {
  /** زياراتُ الحلقة في الشهر؛ undefined = لا زيارة. */
  visits: HalaqaVisits | undefined
}
const props = defineProps<Props>()

const count = computed(() => props.visits?.done.length ?? 0)
const tone = computed(() => count.value >= VISITS_PER_MONTH ? 'ok' : count.value ? 'warn' : 'bad')
const day = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
</script>

<template>
  <div
    class="vl"
    :class="tone"
  >
    <span class="vl-head">
      <UIcon
        name="i-lucide-clipboard-check"
        class="size-4"
      />
      زيارات الشهر <b>{{ count }}</b> من <b>{{ VISITS_PER_MONTH }}</b>
      <template v-if="visits?.avg !== null && visits?.avg !== undefined">
        · المعدّل <b>{{ visits.avg }}</b>/{{ VISIT_MAX }}
      </template>
      <template v-if="visits?.pending">
        · مجدولة {{ visits.pending }}
      </template>
    </span>
    <ul
      v-if="visits?.done.length"
      class="vl-list"
    >
      <li
        v-for="(v, i) in visits.done"
        :key="i"
      >
        <bdi dir="ltr">{{ day(v.day) }}</bdi> · <b>{{ v.score }}</b>/{{ VISIT_MAX }}<template v-if="v.visitor">
          · {{ v.visitor }}
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.vl { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13.5px; color: var(--ink-2); }
.vl-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.vl.ok .vl-head b:first-of-type { color: var(--chip-active-ink); }
.vl.warn .vl-head b:first-of-type { color: var(--chip-warn-ink); }
.vl.bad .vl-head b:first-of-type { color: var(--chip-late-ink); }
.vl-list { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 0; list-style: none; color: var(--ink-3); }
.vl-list b { color: var(--ink); }
</style>
