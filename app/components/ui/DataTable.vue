<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * جدول موحّد داخل بطاقة: أعمدة معرّفة + slot لكل عمود (#<key>="{ row }").
 * عند غياب slot العمود يُعرض row[key] مباشرةً. و`class` (اختياري) يُضاف لخانة العمود ورأسه
 * — لإظهار عمودٍ أو إخفائه بعرض الحاوية مثلاً.
 * وضع البطاقات: إن مرّرت الصفحة `#card="{ row, index }"` (غالباً UiCardRow) يُعرض الجدول بطاقاتٍ
 * حين تضيق حاويته عن 720px (الجوال) — بلا تمرير أفقيّ. بلا slot يبقى الجدول متمرّراً كما كان.
 */
defineProps<{
  columns: { key: string, label: string, align?: 'start' | 'end' | 'center', class?: string }[]
  rows: T[]
  rowKey?: string
  /** صنفٌ يُضاف لصفّ الجدول (لا للبطاقة) — لإبراز صفٍّ بعينه؛ التنسيقُ من الصفحة بـ`:deep()`. */
  rowClass?: (row: T, index: number) => string | undefined
}>()
</script>

<template>
  <div
    class="dt"
    :class="{ 'has-cards': !!$slots.card }"
  >
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
            :class="rowClass?.(row, i)"
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
    <ul
      v-if="$slots.card"
      class="dt-cards"
    >
      <li
        v-for="(row, i) in rows"
        :key="rowKey ? String(row[rowKey]) : i"
      >
        <slot
          name="card"
          :row="row"
          :index="i"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dt { container: dt / inline-size; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 15px; }
/* على الجوال بلا بطاقات: لا تضغط الأعمدة، اسمح بالتمرير الأفقي */
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

.dt-cards { display: none; list-style: none; margin: 0; padding: 0; }
@container dt (max-width: 719px) {
  .has-cards .table-wrap { display: none; }
  .has-cards .dt-cards { display: grid; gap: 12px; }
}
</style>
