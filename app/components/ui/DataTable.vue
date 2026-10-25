<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * جدول موحّد داخل بطاقة: أعمدة معرّفة + slot لكل عمود (#<key>="{ row }").
 * عند غياب slot العمود يُعرض row[key] مباشرةً. و`class` (اختياري) يُضاف لخانة العمود ورأسه
 * — لإظهار عمودٍ أو إخفائه بعرض الحاوية مثلاً.
 * وضع البطاقات: إن مرّرت الصفحة `#card="{ row, index }"` (غالباً UiCardRow) يُعرض الجدول بطاقاتٍ
 * حين تضيق حاويته عن 720px (الجوال) — بلا تمرير أفقيّ. بلا slot يبقى الجدول متمرّراً كما كان.
 *
 * `refined` — الشكلُ الجديد، **الافتراضيُّ لكلّ الجداول** (جُرّب على الطلاب ثم عُمّم بطلب المستخدم 2026-10-25):
 * بلا إطار، ورأسٌ أوضحُ ثابتٌ تحت الشريط العلويّ، وتظليلُ الصفّ عند المرور. `:refined="false"` للشكل القديم.
 * و`rowTo` يجعل الصفَّ كلَّه يفتح السجلّ (بالفأرة وبـEnter) — والأزرارُ والروابطُ داخله تعمل وحدها.
 */
const props = withDefaults(defineProps<{
  columns: { key: string, label: string, align?: 'start' | 'end' | 'center', class?: string }[]
  rows: T[]
  rowKey?: string
  /** صنفٌ يُضاف لصفّ الجدول (لا للبطاقة) — لإبراز صفٍّ بعينه؛ التنسيقُ من الصفحة بـ`:deep()`. */
  rowClass?: (row: T, index: number) => string | undefined
  refined?: boolean
  /** وجهةُ الصفّ حين يُضغط في غير زرٍّ أو رابط. */
  rowTo?: (row: T) => string
}>(), { refined: true })

/** ضغطةُ الصفّ تفتح سجلَّه — إلا إن كانت على زرٍّ أو رابطٍ أو حقلٍ داخله، أو تحديدٍ لنصّ. */
function onRowClick(row: T, e: MouseEvent) {
  if (!props.rowTo) return
  if ((e.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"]')) return
  if (window.getSelection()?.toString()) return
  if (e.metaKey || e.ctrlKey) {
    window.open(props.rowTo(row), '_blank')
    return
  }
  navigateTo(props.rowTo(row))
}
function onRowKey(row: T, e: KeyboardEvent) {
  if (props.rowTo && e.key === 'Enter' && e.target === e.currentTarget) navigateTo(props.rowTo(row))
}
</script>

<template>
  <div
    class="dt"
    :class="{ 'has-cards': !!$slots.card, refined, 'row-link': !!rowTo }"
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
            :tabindex="rowTo ? 0 : undefined"
            @click="onRowClick(row, $event)"
            @keydown="onRowKey(row, $event)"
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

/* ── الشكلُ الجديد (`refined`) ── */
/* clip لا auto: لا يصنع حاويةَ تمرير، فيثبت الرأسُ تحت الشريط العلويّ (76px) عند تمرير الصفحة.
   بلا إطار (طلب المستخدم 2026-10-25 «ما بدي حافة» — على مثال جدولٍ أرسله): لا حدَّ ولا ظلّ حول الصندوق،
   والجدولُ داخله بهامشٍ فلا تمسّ خطوطُ الفصل حافتَيه، ورأسٌ بحبرٍ أوضح لا رماديّ */
.refined .card { border: 0; box-shadow: none; padding: 6px 22px 10px; }
.refined .table-wrap { overflow-x: clip; }
.refined .table-wrap table { font-size: 14.5px; }
.refined .table-wrap thead tr { background: none; }
.refined .table-wrap th { position: sticky; top: 76px; z-index: 2; background: var(--surface); padding: 15px 14px 13px; font-size: 14px; font-weight: 600; color: var(--ink); border-bottom: 1px solid var(--line-2, var(--line)); }
.refined .table-wrap tbody tr:first-child { border-top: 0; }
.refined .table-wrap tbody tr:last-child { border-bottom: 0; }
.refined .table-wrap :deep(td) { padding: 13px 14px; }
.refined .table-wrap tbody tr { transition: background .12s; }
.refined .table-wrap tbody tr:hover { background: var(--surface-2); }
/* حاويةٌ أضيقُ من 900: clip يقصّ ما لا يتّسع (عمودُ الإجراءات) — فالتمريرُ الأفقيّ أولى من الرأس الثابت */
@container dt (max-width: 899px) {
  .refined .table-wrap { overflow-x: auto; }
  .refined .table-wrap th { position: static; }
  .refined .card { padding-inline: 12px; }
}
/* الصفُّ كلُّه رابطٌ إلى سجلّه */
.row-link .table-wrap tbody tr { cursor: pointer; }
.row-link .table-wrap tbody tr:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }

.dt-cards { display: none; list-style: none; margin: 0; padding: 0; }
@container dt (max-width: 719px) {
  .has-cards .table-wrap { display: none; }
  .has-cards .dt-cards { display: grid; gap: 12px; }
}
</style>
