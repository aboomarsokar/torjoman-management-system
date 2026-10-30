<script setup lang="ts">
/**
 * قائمةُ أيام الإجازة: القادمةُ أولاً (واليومُ منها) ثم الماضية، كلُّ يومٍ باسمه وتاريخه `DD-MM-YYYY` وسببه،
 * وزرُّ «حذف» لكلّ يوم (يرفع `remove` فتؤكّده الصفحة). الترتيبُ من المستدعي، والفصلُ بين القادمة والماضية بالتاريخ.
 */
import type { Holiday } from '~/utils/holidays'
import { weekdayName } from '~/utils/recordingStatus'
import { formatDay } from '~/utils/reportWindow'

const props = defineProps<{
  /** مرتّبةً: القادمةُ ثم الماضية. */
  items: Holiday[]
  /** اليومُ بغزة `YYYY-MM-DD`. */
  today: string
  /** يعطّل الحذف أثناء طلبٍ جارٍ. */
  busy: boolean
}>()
defineEmits<{ remove: [day: string] }>()

const groups = computed(() => [
  { key: 'up', title: 'القادمة', rows: props.items.filter(h => h.day >= props.today) },
  { key: 'past', title: 'الماضية', rows: props.items.filter(h => h.day < props.today) }
].filter(g => g.rows.length))
</script>

<template>
  <div class="hl">
    <section
      v-for="group in groups"
      :key="group.key"
    >
      <h3 class="gt">
        {{ group.title }} <span>({{ group.rows.length }})</span>
      </h3>
      <ul class="rows">
        <li
          v-for="h in group.rows"
          :key="h.day"
          class="row"
        >
          <div class="when">
            <b>{{ formatDay(h.day) }}</b>
            <span>{{ weekdayName(h.day) }}</span>
          </div>
          <div class="why">
            {{ h.reason }}
          </div>
          <UButton
            label="حذف"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            size="lg"
            :disabled="busy"
            :aria-label="`حذف إجازة ${formatDay(h.day)}`"
            :ui="{ base: 'rounded-[13px] min-h-11 min-w-11 justify-center' }"
            @click="$emit('remove', h.day)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.hl { display: flex; flex-direction: column; gap: 20px; }
.gt { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--ink); }
.gt span { color: var(--ink-3); font-weight: 600; font-variant-numeric: tabular-nums; }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 16px; min-height: 64px; }
.when { display: flex; flex-direction: column; min-width: 110px; }
.when b { font-size: 15.5px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.when span { font-size: 13px; color: var(--ink-3); }
.why { flex: 1; min-width: 140px; font-size: 15px; color: var(--ink-2); overflow-wrap: anywhere; }
</style>
