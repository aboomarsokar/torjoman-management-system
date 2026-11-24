<script setup lang="ts">
/**
 * جدول هيكلي (Skeleton) — نائب عن UiDataTable ريثما يكتمل الجلب غير الحاجز.
 * يعرض ترويسة الأعمدة الحقيقية (متوفّرة فوراً، غير معتمدة على الشبكة) فوق
 * صفوف نابضة بعدد `rows`، فلا يقفز التخطيط عند وصول البيانات الفعلية.
 */
withDefaults(defineProps<{
  columns: { key: string, label: string, align?: 'start' | 'end' | 'center' }[]
  rows?: number
}>(), {
  rows: 6
})
</script>

<template>
  <div
    class="card table-wrap"
    aria-hidden="true"
  >
    <table>
      <thead>
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            :class="`ta-${c.align || 'start'}`"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="i in rows"
          :key="i"
        >
          <td
            v-for="c in columns"
            :key="c.key"
            :class="`ta-${c.align || 'start'}`"
          >
            <USkeleton
              class="sline"
              :style="{ width: c.align === 'end' ? '70px' : '55%', marginInlineStart: c.align === 'end' ? 'auto' : 0 }"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 15px; }
@media (max-width: 640px) { .table-wrap table { min-width: 640px; } }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 14px 18px; font-weight: 600; color: var(--ink-3); font-size: 13px; white-space: nowrap; }
.ta-start { text-align: start; }
.ta-end { text-align: end; }
.ta-center { text-align: center; }
.table-wrap tbody tr { border-top: 1px solid var(--line); }
.table-wrap td { padding: 14px 18px; vertical-align: middle; }
.sline { height: 14px; border-radius: 6px; }
</style>
