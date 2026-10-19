<script setup lang="ts">
/**
 * بنودُ كشف الحوافز للمعلّم: تحريرٌ ما دام مسوّدة، وقائمةُ قراءةٍ بعد الإرسال.
 * على العرض الواسع أعمدةٌ ثابتة بعناوين مرّةً واحدة؛ وعلى الضيّق كتلةٌ لكلّ بند: البيانُ سطرٌ كامل،
 * والتصنيفُ سطر، والمبلغُ والتاريخُ نصفان متساويان، والحذفُ في رأس البند — باستعلام حاويةٍ لا شاشة.
 * كانت جدولاً متراصّاً بعناوين جانبية وعروضٍ متفاوتة وتاريخٍ مقصوص (طلب المستخدم 2026-10-19).
 */
import type { DateBounds, StatementItemDraft, StatementItemField } from '~/composables/useIncentiveStatement'

interface Props {
  canEdit: boolean
  bounds: DateBounds
  categoryItems: { label: string, value: string }[]
  /** خطأُ الخانة إن وجب إظهارُه (بعد محاولة حفظ). */
  errorOf: (index: number, field: StatementItemField) => string | undefined
}
defineProps<Props>()
const rows = defineModel<StatementItemDraft[]>('rows', { required: true })
const emit = defineEmits<{ add: [], remove: [index: number] }>()

const fmt = (v: number | string) => (v === '' || v === null ? '—' : Number(v).toLocaleString('ar'))
</script>

<template>
  <div class="ie">
    <!-- قراءة: قائمةُ نصوصٍ لا حقولٌ معطّلة -->
    <ul
      v-if="!canEdit"
      class="ie-read"
    >
      <li
        v-for="(r, i) in rows"
        :key="i"
      >
        <div class="ir-main">
          <span class="ir-desc">{{ r.description || '—' }}</span>
          <span class="ir-meta"><span dir="ltr">{{ r.item_date ? formatDay(r.item_date) : 'بلا تاريخ' }}</span> · {{ r.category }}</span>
        </div>
        <span class="ir-amount">{{ fmt(r.amount) }} ₪</span>
      </li>
    </ul>

    <template v-else>
      <div
        class="ie-head"
        aria-hidden="true"
      >
        <span>#</span><span>البيان</span><span>التصنيف</span><span>المبلغ (₪)</span><span>التاريخ</span><span />
      </div>
      <ol class="ie-list">
        <li
          v-for="(r, i) in rows"
          :key="i"
          class="ie-row"
        >
          <div class="ie-top">
            <span class="ie-num">بند {{ i + 1 }}</span>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`حذف البند ${i + 1}`"
              class="ie-del"
              :ui="{ base: 'rounded-[11px] size-11 justify-center' }"
              @click="emit('remove', i)"
            />
          </div>
          <span
            class="ie-idx"
            aria-hidden="true"
          >{{ i + 1 }}</span>

          <label class="ie-f f-desc">
            <span class="ie-lbl">البيان</span>
            <input
              v-model="r.description"
              class="ie-in"
              :class="{ bad: errorOf(i, 'description') }"
              :aria-invalid="!!errorOf(i, 'description')"
              :aria-label="`البيان — بند ${i + 1}`"
              placeholder="مثال: جوائز المتفوّقين في حفظ جزء عمّ"
            >
            <small v-if="errorOf(i, 'description')">{{ errorOf(i, 'description') }}</small>
          </label>

          <div class="ie-f f-cat">
            <span class="ie-lbl">التصنيف</span>
            <UiSelect
              v-model="r.category"
              :items="categoryItems"
              size="lg"
              :aria-label="`التصنيف — بند ${i + 1}`"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
            />
          </div>

          <label class="ie-f f-amount">
            <span class="ie-lbl">المبلغ (₪)</span>
            <input
              v-model="r.amount"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              dir="ltr"
              placeholder="0"
              class="ie-in num"
              :class="{ bad: errorOf(i, 'amount') }"
              :aria-invalid="!!errorOf(i, 'amount')"
              :aria-label="`المبلغ — بند ${i + 1}`"
            >
            <small v-if="errorOf(i, 'amount')">{{ errorOf(i, 'amount') }}</small>
          </label>

          <label class="ie-f f-date">
            <span class="ie-lbl">التاريخ</span>
            <input
              v-model="r.item_date"
              type="date"
              :min="bounds.min"
              :max="bounds.max"
              dir="ltr"
              class="ie-in num"
              :class="{ bad: errorOf(i, 'item_date') }"
              :aria-invalid="!!errorOf(i, 'item_date')"
              :aria-label="`التاريخ — بند ${i + 1}`"
            >
            <small v-if="errorOf(i, 'item_date')">{{ errorOf(i, 'item_date') }}</small>
          </label>
        </li>
      </ol>

      <button
        type="button"
        class="ie-add"
        @click="emit('add')"
      >
        <UIcon
          name="i-lucide-plus"
          class="size-[18px]"
        />
        إضافة بند
      </button>
    </template>
  </div>
</template>

<style scoped>
.ie { container: ie / inline-size; }

/* قراءة */
.ie-read { list-style: none; margin: 0; padding: 0; }
.ie-read li { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 0; }
.ie-read li + li { border-top: 1px solid var(--line); }
.ir-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ir-desc { color: var(--ink); font-weight: 600; overflow-wrap: anywhere; }
.ir-meta { color: var(--ink-3); font-size: 13px; }
.ir-amount { flex: none; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

/* تحرير — العرض الواسع: صفٌّ واحدٌ بأعمدةٍ ثابتة وعناوينُ مرّةً واحدة */
.ie-head, .ie-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 150px 130px 168px 44px; gap: 10px; align-items: start; }
.ie-head { padding: 0 0 8px; border-bottom: 1px solid var(--line); font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
.ie-list { list-style: none; margin: 0; padding: 0; }
.ie-row { padding: 12px 0; border-bottom: 1px solid var(--line); }
.ie-idx { grid-column: 1; grid-row: 1; align-self: center; color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; }
.ie-top { display: contents; }
.ie-num { display: none; }
.ie-del { grid-column: 6; grid-row: 1; }
.f-desc { grid-column: 2; grid-row: 1; }
.f-cat { grid-column: 3; grid-row: 1; }
.f-amount { grid-column: 4; grid-row: 1; }
.f-date { grid-column: 5; grid-row: 1; }
.ie-f { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ie-lbl { display: none; font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.ie-in { width: 100%; height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 15px; outline: none; transition: border-color .15s, box-shadow .15s; }
.ie-in::placeholder { color: var(--ui-text-dimmed); }
.ie-in.num { font-variant-numeric: tabular-nums; text-align: end; }
.ie-in:hover { border-color: var(--ink-3); }
.ie-in:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.ie-in.bad { border-color: var(--err); }
.ie-f small { color: var(--err); font-size: 12.5px; line-height: 1.4; }

.ie-add { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 48px; margin-top: 14px; border: 1.5px dashed var(--line-2); border-radius: 13px; background: transparent; color: var(--blue); font-size: 15px; font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s; }
.ie-add:hover { background: var(--blue-soft); border-color: var(--blue); }
.ie-add:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ring); }

/* العرض الضيّق: كتلةٌ لكلّ بند، والعناوين فوق الحقول */
@container ie (max-width: 719px) {
  .ie-head { display: none; }
  .ie-row { grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px 0 16px; }
  .ie-idx { display: none; }
  .ie-top { display: flex; grid-column: 1 / -1; grid-row: auto; align-items: center; justify-content: space-between; margin-bottom: -4px; }
  .ie-num { display: block; font-size: 13.5px; font-weight: 700; color: var(--ink-2); }
  .ie-del { grid-column: auto; grid-row: auto; margin-inline-end: -10px; }
  .f-desc, .f-cat { grid-column: 1 / -1; grid-row: auto; }
  .f-amount { grid-column: 1; grid-row: auto; }
  .f-date { grid-column: 2; grid-row: auto; }
  .ie-lbl { display: block; }
}
</style>
