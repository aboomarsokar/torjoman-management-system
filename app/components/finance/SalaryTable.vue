<script setup lang="ts">
/**
 * جدولُ كشف الرواتب: لكلّ عاملٍ مكافأتُه (حقلٌ فارغُه الافتراضيّة)، وتقييمُه (للمعلم من سجلٍّ مقفل، وغيرُه «ثابتة»)،
 * والمحسوب، والتعديلُ اليدويّ وسببُه (يظهر حقلُ السبب متى كان تعديل)، والصافي، والإجماليّ. العرضُ وحده — الحسابُ في الأب.
 */
import type { PayrollRow } from '~/composables/usePayroll'
import { roleLabel } from '~/constants/roles'

interface Props {
  amounts: { base: number, suggested: number | null, net: number | null }[]
  fallback: number
  canEdit: boolean
  total: number
}
defineProps<Props>()
const rows = defineModel<PayrollRow[]>('rows', { required: true })
const fmt = (n: number) => n.toLocaleString('ar')
</script>

<template>
  <div class="table-wrap stack-wrap">
    <table>
      <thead>
        <tr>
          <th class="ta-start">
            #
          </th>
          <th class="ta-start">
            العامل
          </th>
          <th>المكافأة (₪)</th>
          <th>التقييم</th>
          <th>المحسوب</th>
          <th>تعديل (±) وسببه</th>
          <th>الصافي (₪)</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(r, i) in rows"
          :key="r.profile_id"
        >
          <td class="ta-start muted stack-hide">
            {{ i + 1 }}
          </td>
          <td class="ta-start">
            <span class="strong">{{ r.name }}</span>
            <span class="role">{{ roleLabel(r.role, r.gender) }}</span>
          </td>
          <td data-label="المكافأة (₪)">
            <input
              v-model="r.base"
              :disabled="!canEdit"
              type="number"
              min="1"
              class="cell"
              dir="ltr"
              :placeholder="String(fallback)"
              :aria-label="`مكافأة ${r.name}`"
            >
          </td>
          <td data-label="التقييم">
            <span
              v-if="r.role !== 'teacher'"
              class="muted"
            >ثابتة</span>
            <span
              v-else-if="r.final === null"
              class="wait"
            >بانتظار التقييم</span>
            <span
              v-else
              class="num"
            >{{ r.final }} / 100</span>
          </td>
          <td
            data-label="المحسوب"
            class="num"
          >
            {{ amounts[i]!.suggested === null ? '—' : fmt(amounts[i]!.suggested!) }}
          </td>
          <td data-label="تعديل وسببه">
            <div class="adj">
              <input
                v-model="r.adjustment"
                :disabled="!canEdit"
                type="number"
                class="cell cell-sm"
                dir="ltr"
                placeholder="0"
                :aria-label="`تعديل ${r.name}`"
              >
              <input
                v-if="Number(r.adjustment)"
                v-model="r.note"
                :disabled="!canEdit"
                type="text"
                maxlength="200"
                class="cell cell-note"
                placeholder="السبب (إلزامي)"
                :aria-label="`سبب تعديل ${r.name}`"
              >
            </div>
          </td>
          <td
            data-label="الصافي (₪)"
            class="strong num"
          >
            {{ amounts[i]!.net === null ? '—' : fmt(amounts[i]!.net!) }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td
            colspan="6"
            class="ta-start strong"
          >
            إجمالي الرواتب
          </td>
          <td class="strong num">
            {{ fmt(total) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 860px; }
thead tr, tfoot tr { background: var(--surface-2); }
th { padding: 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; text-align: center; }
th.ta-start { text-align: start; }
td { padding: 9px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.strong { font-weight: 700; color: var(--ink); }
.muted { color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
.cell { width: 130px; height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; text-align: center; outline: none; }
.cell:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.cell:disabled { opacity: .6; cursor: not-allowed; }
.role { display: block; font-size: 12.5px; color: var(--ink-3); }
.wait { font-size: 13px; font-weight: 600; color: var(--chip-warn-ink); }
.adj { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.cell-sm { width: 90px; }
.cell-note { width: 200px; text-align: start; }
</style>
