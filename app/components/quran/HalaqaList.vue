<script setup lang="ts">
/**
 * قائمةُ حلقات النطاق بحالة رصد الشهر المعروض (لم يبدأ · مسوّدة · مُرسَل · معتمَد) — تُعرض لغير المعلم
 * ما دام لم يختر حلقة، والضغطُ على حلقةٍ يفتح كشفَها. المُرسَلُ أوّلاً: هو ما ينتظر قرار المعتمِد.
 */
import type { ReportStatus } from '~/utils/quran/screen'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

const props = defineProps<{ items: { id: string, name: string, status: ReportStatus | null }[] }>()
const emit = defineEmits<{ pick: [id: string] }>()

const ORDER: Record<ReportStatus | 'none', number> = { submitted: 0, draft: 1, none: 2, approved: 3 }
const sorted = computed(() => [...props.items].sort((a, b) =>
  ORDER[a.status ?? 'none'] - ORDER[b.status ?? 'none'] || a.name.localeCompare(b.name, 'ar')))
</script>

<template>
  <ul class="hl">
    <li
      v-for="h in sorted"
      :key="h.id"
    >
      <button
        type="button"
        class="hl-row"
        @click="emit('pick', h.id)"
      >
        <span class="hl-name">{{ h.name }}</span>
        <UBadge
          :color="REPORT_STATUS_COLORS[h.status ?? 'none']"
          variant="soft"
          size="lg"
          :label="REPORT_STATUS_LABELS[h.status ?? 'none']"
        />
        <UIcon
          name="i-lucide-chevron-left"
          class="size-5 hl-go"
        />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.hl { list-style: none; margin: 0 0 16px; padding: 6px 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
.hl li + li { border-top: 1px solid var(--line); }
.hl-row { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px 20px; background: none; border: 0; cursor: pointer; text-align: start; color: var(--ink); font: inherit; }
.hl-row:hover { background: var(--surface-2); }
.hl-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.hl-name { flex: 1; font-size: 15.5px; font-weight: 600; }
.hl-go { color: var(--ink-3); }
</style>
