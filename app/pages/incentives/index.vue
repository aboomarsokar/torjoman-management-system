<script setup lang="ts">
/**
 * كشف حوافز الحلقة الشهري (§4.25) — للمعلّم.
 * المعلّم يرفع مصروفات الحوافز لحلقته شهريّاً؛ المبلغ المخصّص يضبطه المدير
 * (للقراءة فقط)، والمتبقّي = المخصّص − المصروف. المدير يطّلع ويراجع (§4.20د).
 */
import type { Database } from '~/types/database.types'
import { STATEMENT_ITEM_CATEGORIES } from '~/constants/incentives'
import type { StatementItemField } from '~/composables/useIncentiveStatement'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'كشف الحوافز — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
// role (من useProfile أعلاه): ما دام فارغاً لا قفل ولا محتوى (كان «للمعلّم» يومض للمدير عند التحميل الكامل)
const { isTeacher, isAdmin, isWomenAdmin, isReadOnly } = usePermissions()
// المراجعة للمدير الإداري والمديرة الإدارية، ومشرف المشروع اطّلاعاً — بلا المدير الفني (قرار 2026-10-19؛
// القاعدة: can_review_statement_in_halaqa). canApprove يشمل المدير الفني (يستعمله تسجيل الحضور)، فلا يصلح هنا.
const canReview = computed(() => isAdmin.value || isWomenAdmin.value || isReadOnly.value)

const categoryItems = STATEMENT_ITEM_CATEGORIES.map(c => ({ label: c, value: c }))
const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))

// حلقة المعلّم تلقائيّاً
type NameRow = { id: string, name: string }
const { data: myHalqa } = useLazyAsyncData<NameRow | null>('inc-my-halqa', async () => {
  if (role.value !== 'teacher') return null
  const { data } = await supabase.from('halaqat').select('id, name').eq('teacher_id', profile.value?.id ?? '').limit(1).maybeSingle()
  return data
}, { server: false, default: () => null, watch: [role] })

const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const halaqaId = computed(() => myHalqa.value?.id ?? null)
const {
  loading, loaded, saving, submitting, showErrors, statement, allocated, rows, bounds,
  canEdit: statementEditable, spent, remaining, errors, addRow, removeRow, save, submit
} = useIncentiveStatement(halaqaId, month, year)
// المعلّم يعدّل المسودّة فقط (أو كشفاً لم يُحفظ بعد) — حارس القاعدة يرفض أيّ تعديل بعد الإرسال
const canEdit = computed(() => isTeacher.value && statementEditable.value)
const errorOf = (i: number, field: StatementItemField) => (showErrors.value ? errors.value[i]?.[field] : undefined)
async function saveDraft() {
  await save()
}

const fmt = (n: number) => n.toLocaleString('ar')
</script>

<template>
  <div class="inc">
    <UiPageHeader
      :title="canReview ? 'كشوف حوافز الحلقات' : 'كشف حوافز الحلقة'"
      :subtitle="canReview ? 'الكشوف الواردة من المعلّمين لكل شهر — مراجعتها واعتمادها بـ«تمّ الاطّلاع».' : isTeacher ? 'مصروفات مبلغ الحوافز الشهري لحلقتك — أضِف البنود وارفع الكشف للمدير.' : undefined"
    />

    <!-- المعتمِدون ومشرف المشروع: مراجعة الكشوف الواردة في نطاقهم (RLS) بلا تخصيص -->
    <FinanceIncentives
      v-if="canReview"
      review-only
    />

    <UiEmptyState
      v-else-if="role && !isTeacher"
      icon="i-lucide-lock"
      title="كشف الحوافز للمعلّم والمدير الإداري والمديرة الإدارية."
    />

    <template v-else-if="isTeacher">
      <!-- المُحدِّدات -->
      <div class="card pick">
        <div class="pick-fields">
          <div class="pf">
            <label>الحلقة</label>
            <div class="halqa-auto">
              <UIcon
                name="i-lucide-book-open"
                class="size-5"
              />
              {{ myHalqa?.name || 'لا حلقة معيّنة لك' }}
            </div>
          </div>
          <div class="pf sm">
            <label>الشهر</label>
            <UiSelect
              v-model="month"
              :items="monthItems"
              size="lg"
            />
          </div>
          <div class="pf sm">
            <label>السنة</label>
            <UiSelect
              v-model="year"
              :items="yearItems"
              size="lg"
            />
          </div>
        </div>
      </div>

      <ClientOnly>
        <UiEmptyState
          v-if="!loaded"
          :icon="loading ? 'i-lucide-loader-circle' : 'i-lucide-gift'"
          :title="loading ? 'يُحمَّل الكشف…' : myHalqa ? 'تعذّر تحميل الكشف' : 'لا حلقة معيّنة لك'"
        />

        <template v-else>
          <!-- ملخّص مالي -->
          <div class="summary">
            <div class="sm-card">
              <div class="sm-val">
                {{ fmt(allocated) }}
              </div>
              <div class="sm-lbl">
                المبلغ المخصّص
              </div>
            </div>
            <div class="sm-card">
              <div class="sm-val">
                {{ fmt(spent) }}
              </div>
              <div class="sm-lbl">
                إجمالي المصروف
              </div>
            </div>
            <div
              class="sm-card"
              :class="remaining < 0 ? 'neg' : 'pos'"
            >
              <div class="sm-val">
                {{ fmt(remaining) }}
              </div>
              <div class="sm-lbl">
                المتبقّي
              </div>
            </div>
            <div class="sm-status">
              <UBadge
                :label="statement ? STATEMENT_STATUS[statement.status]?.label : 'جديد (لم يُحفظ)'"
                :color="statement ? STATEMENT_STATUS[statement.status]?.color : 'neutral'"
                variant="soft"
                size="lg"
              />
            </div>
          </div>

          <div
            v-if="remaining < 0"
            class="warn"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="size-4"
            />
            تجاوز المصروف المبلغ المخصّص بمقدار {{ fmt(Math.abs(remaining)) }}.
          </div>

          <div
            v-if="statement && statement.status !== 'draft'"
            class="locked"
          >
            <UIcon
              name="i-lucide-lock"
              class="size-4"
            />
            {{ statement.status === 'reviewed' ? 'تمّت مراجعة الكشف — للقراءة فقط.' : 'أُرسل — بانتظار الاعتماد. لا يُعدَّل بعد الإرسال.' }}
          </div>

          <!-- أعاده المراجِع: الملاحظةُ ظاهرةٌ ما دام مسوّدةً عند المعلّم -->
          <div
            v-if="statement?.status === 'draft' && statement.returnNote"
            class="returned"
            role="status"
          >
            <UIcon
              name="i-lucide-undo-2"
              class="size-5 flex-none"
            />
            <div>
              <strong>أُعيد إليك الكشف للتعديل</strong>
              <p>{{ statement.returnNote }}</p>
              <small>صحّح البنود ثم اضغط «حفظ وإرسال للمراجعة».</small>
            </div>
          </div>

          <!-- بنود المصروفات -->
          <div class="card items">
            <div class="items-head">
              <h3>بنود المصروفات</h3>
              <UButton
                v-if="canEdit"
                label="إضافة بند"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-plus"
                :ui="{ base: 'rounded-[11px]' }"
                @click="addRow"
              />
            </div>

            <UiEmptyState
              v-if="!rows.length"
              icon="i-lucide-receipt"
              title="لا بنود بعد"
              description="أضِف أول بند مصروف."
            />
            <div
              v-else
              class="table-wrap stack-wrap"
            >
              <table>
                <thead>
                  <tr>
                    <th class="ta-start">
                      #
                    </th>
                    <th class="ta-start">
                      البيان
                    </th>
                    <th>التصنيف</th>
                    <th>المبلغ</th>
                    <th>التاريخ</th>
                    <th v-if="canEdit" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in rows"
                    :key="i"
                  >
                    <td class="ta-start muted stack-hide">
                      {{ i + 1 }}
                    </td>
                    <td
                      class="ta-start"
                      data-label="البيان"
                    >
                      <div class="fld">
                        <input
                          v-model="r.description"
                          :disabled="!canEdit"
                          class="cell wide"
                          :class="{ bad: errorOf(i, 'description') }"
                          :aria-invalid="!!errorOf(i, 'description')"
                          placeholder="مثال: جوائز المتفوّقين في حفظ جزء عمّ"
                        >
                        <small v-if="errorOf(i, 'description')">{{ errorOf(i, 'description') }}</small>
                      </div>
                    </td>
                    <td data-label="التصنيف">
                      <UiSelect
                        v-model="r.category"
                        :items="categoryItems"
                        :disabled="!canEdit"
                        size="sm"
                      />
                    </td>
                    <td data-label="المبلغ">
                      <div class="fld">
                        <input
                          v-model="r.amount"
                          :disabled="!canEdit"
                          type="number"
                          min="0"
                          step="any"
                          inputmode="decimal"
                          class="cell"
                          :class="{ bad: errorOf(i, 'amount') }"
                          :aria-invalid="!!errorOf(i, 'amount')"
                          dir="ltr"
                        >
                        <small v-if="errorOf(i, 'amount')">{{ errorOf(i, 'amount') }}</small>
                      </div>
                    </td>
                    <td data-label="التاريخ">
                      <div class="fld">
                        <input
                          v-model="r.item_date"
                          :disabled="!canEdit"
                          type="date"
                          :min="bounds.min"
                          :max="bounds.max"
                          class="cell"
                          :class="{ bad: errorOf(i, 'item_date') }"
                          :aria-invalid="!!errorOf(i, 'item_date')"
                          dir="ltr"
                        >
                        <small v-if="errorOf(i, 'item_date')">{{ errorOf(i, 'item_date') }}</small>
                      </div>
                    </td>
                    <td v-if="canEdit">
                      <UButton
                        color="error"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-x"
                        aria-label="حذف البند"
                        class="stack-keep"
                        @click="removeRow(i)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="canEdit"
              class="actions"
            >
              <UButton
                label="حفظ"
                color="primary"
                size="lg"
                icon="i-lucide-save"
                :loading="saving"
                :ui="{ base: 'rounded-[13px] font-semibold' }"
                @click="saveDraft"
              />
              <UButton
                label="حفظ وإرسال للمراجعة"
                color="success"
                size="lg"
                icon="i-lucide-send"
                :loading="submitting"
                :ui="{ base: 'rounded-[13px] font-semibold' }"
                @click="submit"
              />
            </div>
          </div>
        </template>
      </ClientOnly>
    </template>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 18px; }

.pick-fields { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px; }
.pf.sm { flex: 0 0 140px; min-width: 120px; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.halqa-auto { display: flex; align-items: center; gap: 9px; height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }

.summary { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.sm-card { flex: 1; min-width: 130px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 16px 18px; }
.sm-val { font-size: 24px; font-weight: 700; color: var(--ink); line-height: 1; }
.sm-card.pos .sm-val { color: var(--green-ink); }
.sm-card.neg .sm-val { color: var(--err); }
.sm-lbl { font-size: 13px; color: var(--ink-3); margin-top: 7px; }
.sm-status { flex: none; }
.locked { display: flex; align-items: center; gap: 8px; background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }

.returned { display: flex; align-items: flex-start; gap: 10px; background: var(--blue-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; margin-bottom: 16px; }
.returned strong { display: block; font-size: 14.5px; font-weight: 700; }
.returned p { margin: 4px 0; font-size: 14px; color: var(--ink); overflow-wrap: anywhere; }
.returned small { font-size: 12.5px; color: var(--ink-3); }
.warn { display: flex; align-items: center; gap: 8px; background: var(--err-soft); color: var(--err); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }

.items-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.items-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 640px; }
.table-wrap thead tr { background: var(--surface-2); }
.table-wrap th { padding: 11px 10px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; text-align: center; }
.table-wrap th.ta-start { text-align: start; }
.table-wrap td { padding: 7px 10px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.muted { color: var(--ink-2); }
.cell { width: 110px; height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; outline: none; }
.cell.wide { width: 100%; min-width: 160px; text-align: start; }
.cell:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.cell:disabled { opacity: .6; cursor: not-allowed; }
.cell.bad { border-color: var(--err); }
.fld { display: flex; flex-direction: column; align-items: stretch; gap: 4px; }
.fld small { color: var(--err); font-size: 12px; text-align: start; line-height: 1.4; }

.actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }

@media (max-width: 620px) { .pf, .pf.sm { flex: 1 1 100%; } }
</style>
