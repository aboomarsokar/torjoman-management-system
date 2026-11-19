<script setup lang="ts">
/**
 * جدولُ كشوف الحوافز الواردة لشهر: المستلَم والمرحَّل والمصروف والمتبقّي والحالة وزرُّ البنود.
 * وللمراجِع (`canReview`) خانةُ تحديدٍ لكلّ كشفٍ مُرسَل وزرُّ «اطّلاع على المحدَّد» بتأكيدٍ يذكر العددَ
 * وما سيُرحَّل (طلب المستخدم 2026-11-19). الطلبُ في `useStatementReview`، والأبُ يحدّث الحالةَ بـ`reviewed`.
 */
import { bulkReviewText, reviewableIds, statementLeft, type StatementRow } from '~/utils/statementReview'

const props = defineProps<{
  rows: StatementRow[]
  canReview: boolean
}>()
const emit = defineEmits<{ open: [row: StatementRow], reviewed: [ids: string[]] }>()

const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { reviewMany } = useStatementReview()

const fmt = (n: number) => n.toLocaleString('ar')
const badge = (s: StatementRow) => (s.status === 'draft' && s.returnNote)
  ? { label: 'أُعيد للمعلّم', color: 'warning' as const }
  : STATEMENT_STATUS[s.status]

const selected = ref<string[]>([])
const submitted = computed(() => props.rows.filter(r => r.status === 'submitted'))
const chosen = computed(() => reviewableIds(props.rows, selected.value))
const allChosen = computed(() => submitted.value.length > 0 && chosen.value.length === submitted.value.length)
// ما خرج من العرض (فلترٌ أو اطّلاع) يخرج من التحديد
watch(() => props.rows, () => {
  selected.value = reviewableIds(props.rows, selected.value)
}, { deep: true })

function toggle(id: string, on: boolean) {
  selected.value = on ? [...selected.value, id] : selected.value.filter(x => x !== id)
}
function toggleAll(on: boolean) {
  selected.value = on ? submitted.value.map(r => r.id) : []
}

const confirmOpen = ref(false)
const busy = ref(false)
const confirmText = computed(() => bulkReviewText(props.rows.filter(r => chosen.value.includes(r.id))))
async function confirmReview() {
  busy.value = true
  try {
    const done = await reviewMany(chosen.value, profile.value?.id ?? null)
    toast.add({ title: `تمّ الاطّلاع على ${done.length} من ${chosen.value.length}.`, color: 'success', icon: 'i-lucide-check-check' })
    emit('reviewed', done)
    selected.value = []
    confirmOpen.value = false
  } catch (err) {
    handle(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div
      v-if="canReview && submitted.length"
      class="bulk"
    >
      <label class="pick">
        <UCheckbox
          :model-value="allChosen"
          :indeterminate="chosen.length > 0 && !allChosen"
          aria-label="تحديد كل الكشوف المُرسَلة"
          @update:model-value="(v: boolean | 'indeterminate') => toggleAll(v === true)"
        />
        <span>تحديد كل المُرسَلة ({{ submitted.length }})</span>
      </label>
      <UButton
        :label="`اطّلاع على المحدَّد${chosen.length ? ` (${chosen.length})` : ''}`"
        icon="i-lucide-check-check"
        color="primary"
        :disabled="!chosen.length"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="confirmOpen = true"
      />
    </div>
    <div class="table-wrap stack-wrap">
      <table>
        <thead>
          <tr>
            <th
              v-if="canReview"
              class="pick-col"
            />
            <th class="ta-start">
              #
            </th><th class="ta-start">
              الحلقة
            </th><th>المستلَم</th><th>المرحَّل</th><th>المصروف</th><th>المتبقّي</th><th>الحالة</th><th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(s, i) in rows"
            :key="s.id"
            :class="{ picked: chosen.includes(s.id) }"
          >
            <td
              v-if="canReview"
              class="pick-col"
            >
              <label
                v-if="s.status === 'submitted'"
                class="pick-cell"
              >
                <UCheckbox
                  :model-value="selected.includes(s.id)"
                  :aria-label="`تحديد كشف ${s.halaqa}`"
                  @update:model-value="(v: boolean | 'indeterminate') => toggle(s.id, v === true)"
                />
              </label>
            </td>
            <td class="ta-start muted stack-hide">
              {{ i + 1 }}
            </td>
            <td class="ta-start strong">
              {{ s.halaqa }}
            </td>
            <td
              class="num"
              data-label="المستلَم"
            >
              {{ fmt(s.received) }}
            </td>
            <td
              class="num"
              :class="{ out: s.carried > s.received }"
              :title="s.carried > s.received ? 'الرصيدُ المرحَّل أكبر من مخصّص شهر — الحلقة لا تصرف ما تستلم' : undefined"
              data-label="المرحَّل"
            >
              {{ s.carried ? fmt(s.carried) : '—' }}
            </td>
            <td
              class="num"
              data-label="المصروف"
            >
              {{ fmt(s.spent) }}
            </td>
            <td
              class="num"
              :class="statementLeft(s) < 0 ? 'out' : ''"
              data-label="المتبقّي"
            >
              {{ fmt(statementLeft(s)) }}
            </td>
            <td data-label="الحالة">
              <UBadge
                :label="badge(s)?.label"
                :color="badge(s)?.color"
                variant="soft"
                size="sm"
                class="stack-keep"
              />
            </td>
            <td>
              <UButton
                :label="canReview && s.status === 'submitted' ? 'راجع البنود' : 'البنود'"
                :color="canReview && s.status === 'submitted' ? 'primary' : 'neutral'"
                variant="outline"
                size="sm"
                icon="i-lucide-list"
                class="stack-keep"
                :ui="{ base: 'rounded-[9px]' }"
                @click="emit('open', s)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiConfirmModal
      v-model:open="confirmOpen"
      title="اطّلاع على المحدَّد"
      :message="confirmText"
      confirm-label="تمّ الاطّلاع"
      confirm-color="primary"
      confirm-icon="i-lucide-check-check"
      :loading="busy"
      @confirm="confirmReview"
    />
  </div>
</template>

<style scoped>
.bulk { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; margin-bottom: 12px; }
.pick { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink-2); cursor: pointer; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 560px; }
thead tr { background: var(--surface-2); }
th { padding: 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; text-align: center; }
th.ta-start, .ta-start { text-align: start; }
td { padding: 9px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
tr.picked td { background: var(--blue-soft); }
.pick-col { width: 48px; padding-inline: 4px; }
.pick-cell { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; cursor: pointer; }
.muted { color: var(--ink-3); }
.strong { font-weight: 700; color: var(--ink); }
.num { font-variant-numeric: tabular-nums; }
.out { color: var(--err); font-weight: 600; }
</style>
