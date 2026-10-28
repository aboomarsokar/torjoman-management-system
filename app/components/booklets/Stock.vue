<script setup lang="ts">
/**
 * مخزونُ الملازم (طلب المستخدم 2026-10-28): رصيدُ كلّ ملزمةٍ بمستواه (نفد / قارب النفاد / كافٍ / لم يُجرد)،
 * وزرّا «توريد» و«جرد» للمدير الإداريّ، وآخرُ الحركات (توريدٌ وجردٌ وتسليمٌ وإرجاع).
 */
import type { StockAction, StockMove } from '~/composables/useBookletStock'
import { BOOKLETS } from '~/constants/booklets'
import type { StockItem, StockLevel } from '~/utils/bookletStock'

defineProps<{ items: StockItem[], moves: StockMove[], halaqaNames: Record<string, string>, canEdit: boolean }>()
const emit = defineEmits<{ act: [booklet: number, action: StockAction], edit: [move: StockMove] }>()

const LEVEL: Record<StockLevel, { label: string, color: 'error' | 'warning' | 'success' | 'neutral' }> = {
  out: { label: 'نفد', color: 'error' },
  low: { label: 'قارب النفاد', color: 'warning' },
  ok: { label: 'كافٍ', color: 'success' },
  untracked: { label: 'لم يُجرد', color: 'neutral' }
}
const REASON: Record<string, string> = { supply: 'توريد', count: 'جرد', delivery: 'تسليم', delivery_removed: 'إرجاع' }
const labelOf = (no: number) => BOOKLETS.find(b => b.no === no)?.label ?? ''
/** «28/10/2026» من `YYYY-MM-DD`. */
const when = (day: string) => day.split('-').reverse().map(Number).join('/')
</script>

<template>
  <div class="st">
    <p
      v-if="canEdit"
      class="st-hint"
    >
      أدخل العددَ الفعليّ لكلّ ملزمةٍ بزرّ «جرد» أوّلَ مرّة، ثم «توريد» كلّما وصلت نسخ. يُخصم من الرصيد مع كلّ تسليم، ولا يُسلَّم أكثرُ من الرصيد.
    </p>
    <ul class="st-grid">
      <li
        v-for="it in items"
        :key="it.no"
        :class="`lv-${it.level}`"
      >
        <div class="st-top">
          <b>{{ it.label }}</b>
          <UBadge
            :label="LEVEL[it.level].label"
            :color="LEVEL[it.level].color"
            variant="soft"
          />
        </div>
        <div class="st-qty">
          <span class="n">{{ it.quantity ?? '—' }}</span>
          <span class="u">نسخة</span>
        </div>
        <p class="st-alert">
          {{ it.alertAt === null ? 'لم يُحدَّد حدُّ التنبيه' : `ينبّه عند ${it.alertAt} نسخة أو أقلّ` }}
        </p>
        <div
          v-if="canEdit"
          class="st-acts"
        >
          <UButton
            label="توريد"
            icon="i-lucide-package-plus"
            color="primary"
            variant="soft"
            size="sm"
            :ui="{ base: 'rounded-[10px] min-h-10' }"
            @click="emit('act', it.no, 'supply')"
          />
          <UButton
            label="جرد"
            icon="i-lucide-clipboard-list"
            color="neutral"
            variant="outline"
            size="sm"
            :ui="{ base: 'rounded-[10px] min-h-10' }"
            @click="emit('act', it.no, 'count')"
          />
        </div>
      </li>
    </ul>

    <section class="st-log">
      <h2>آخرُ الحركات</h2>
      <p
        v-if="!moves.length"
        class="st-empty"
      >
        لا حركاتٍ بعد.
      </p>
      <ul v-else>
        <li
          v-for="m in moves"
          :key="m.id"
        >
          <span
            class="d"
            :class="m.delta > 0 ? 'plus' : 'minus'"
            dir="ltr"
          >{{ m.delta > 0 ? `+${m.delta}` : m.delta }}</span>
          <span class="w">
            <b>{{ REASON[m.reason] ?? m.reason }} · {{ labelOf(m.booklet) }}</b>
            <small>{{ when(m.moved_on) }}<template v-if="m.halaqa_id && halaqaNames[m.halaqa_id]"> · {{ halaqaNames[m.halaqa_id] }}</template><template v-if="m.note"> · {{ m.note }}</template></small>
          </span>
          <span class="b">الرصيد {{ m.balance_after }}</span>
          <UButton
            v-if="canEdit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`تعديل حركة ${REASON[m.reason] ?? ''}`"
            :ui="{ base: 'rounded-full min-h-10 min-w-10 justify-center' }"
            @click="emit('edit', m)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.st { display: flex; flex-direction: column; gap: 16px; }
.st-hint { margin: 0; font-size: 14px; color: var(--ink-2); line-height: 1.8; }
.st-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.st-grid li { padding: 14px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
.st-grid li.lv-low { border-color: color-mix(in srgb, var(--ui-warning) 45%, var(--line)); }
.st-grid li.lv-out { border-color: color-mix(in srgb, var(--ui-error) 45%, var(--line)); }
.st-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.st-top b { color: var(--ink); font-weight: 600; }
.st-qty { display: flex; align-items: baseline; gap: 6px; }
.st-qty .n { font-size: 28px; font-weight: 600; color: var(--navy); font-variant-numeric: tabular-nums; }
.lv-low .st-qty .n { color: var(--ui-warning); }
.lv-out .st-qty .n { color: var(--ui-error); }
.st-qty .u { font-size: 13px; color: var(--ink-3); }
.st-alert { margin: 0; font-size: 12px; color: var(--ink-3); }
.st-acts { display: flex; gap: 8px; margin-top: 4px; }
.st-log { padding: 16px 18px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
.st-log h2 { margin: 0 0 10px; font-size: 16px; font-weight: 600; color: var(--ink); }
.st-empty { margin: 0; color: var(--ink-3); }
.st-log ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.st-log li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
.st-log li:first-child { border-top: 0; }
.st-log .d { min-width: 56px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; padding: 2px 8px; border-radius: 999px; }
.st-log .d.plus { color: var(--green-ink); background: var(--green-soft); }
.st-log .d.minus { color: var(--ink-2); background: var(--surface-2); }
.st-log .w { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.st-log .w b { font-weight: 600; color: var(--ink); font-size: 14px; }
.st-log .w small { color: var(--ink-3); font-size: 12px; }
.st-log .b { font-size: 12px; color: var(--ink-2); white-space: nowrap; }
</style>
