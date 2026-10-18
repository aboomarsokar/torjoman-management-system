<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * جدول موحّد داخل بطاقة: أعمدة معرّفة + slot لكل عمود (#<key>="{ row }").
 * عند غياب slot العمود يُعرض row[key] مباشرةً. و`class` (اختياري) يُضاف لخانة العمود ورأسه
 * — لإظهار عمودٍ أو إخفائه بعرض الحاوية مثلاً.
 */
defineProps<{
  columns: { key: string, label: string, align?: 'start' | 'end' | 'center', class?: string }[]
  rows: T[]
  rowKey?: string
}>()
</script>

<template>
  <div class="card table-wrap">
    <table>
      <thead>
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            :class="[`ta-${c.align || 'start'}`, c.class]"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in rows"
          :key="rowKey ? String(row[rowKey]) : i"
        >
          <td
            v-for="c in columns"
            :key="c.key"
            :class="[`ta-${c.align || 'start'}`, c.class]"
          >
            <slot
              :name="c.key"
              :row="row"
              :index="i"
            >
              {{ row[c.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 15px; }
/* على الجوال: لا تضغط الأعمدة، اسمح بالتمرير الأفقي */
@media (max-width: 640px) {
  .table-wrap table { min-width: 640px; }
}
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 14px 18px; font-weight: 600; color: var(--ink-3); font-size: 13px; white-space: nowrap; }
.ta-start { text-align: start; }
.ta-end { text-align: end; }
.ta-center { text-align: center; }
.table-wrap tbody tr { border-top: 1px solid var(--line); }
.table-wrap :deep(td) { padding: 14px 18px; vertical-align: middle; }
</style>
