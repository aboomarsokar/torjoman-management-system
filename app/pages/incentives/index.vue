<script setup lang="ts">
/**
 * كشف حوافز الحلقة الشهري (§4.25) — للمعلّم.
 * المعلّم يرفع مصروفات الحوافز لحلقته شهريّاً؛ المبلغ المخصّص يضبطه المدير
 * (للقراءة فقط)، والمتبقّي = المخصّص − المصروف. المدير يطّلع ويراجع (§4.20د).
 */
import type { Database } from '~/types/database.types'
import { STATEMENT_ITEM_CATEGORIES } from '~/constants/incentives'
import type { StatementItemField } from '~/composables/useIncentiveStatement'
import { INCENTIVE_HALQA_KEY } from '~/utils/incentiveOutbox'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'كشف الحوافز — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
// role (من useProfile أعلاه): ما دام فارغاً لا قفل ولا محتوى (كان «للمعلّم» يومض للمدير عند التحميل الكامل)
const { isTeacher, isAdmin, isWomenAdmin, isReadOnly } = usePermissions()
// المراجعة للمدير الإداري والمديرة الإدارية، ومشرف المشروع اطّلاعاً — بلا المدير الفني (قرار 2026-10-19؛
// القاعدة: can_review_statement_in_halaqa). canApprove لرصد الحضور (الإداري والمديرة)، فلا يصلح هنا.
const canReview = computed(() => isAdmin.value || isWomenAdmin.value || isReadOnly.value)

const categoryItems = STATEMENT_ITEM_CATEGORIES.map(c => ({ label: c, value: c }))
const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))

// حلقة المعلّم تلقائيّاً — ومن نسخة جهازه بلا اتصال (البند 14، 2026-10-28)
type NameRow = { id: string, name: string }
const { wrap } = useOfflineCopy()
const { data: myHalqa } = useLazyAsyncData<NameRow | null>(INCENTIVE_HALQA_KEY, wrap(INCENTIVE_HALQA_KEY, async () => {
  if (role.value !== 'teacher') return null
  const { data } = await supabase.from('halaqat').select('id, name').eq('teacher_id', profile.value?.id ?? '').limit(1).maybeSingle()
  return data
}), { server: false, default: () => null, watch: [role] })

const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const halaqaId = computed(() => myHalqa.value?.id ?? null)
const {
  loading, loaded, noCopy, saving, submitting, showErrors, statement, allocated, rows, bounds,
  canEdit: statementEditable, spent, remaining, errors, onDevice, rejected, retryRejected, discardRejected,
  addRow, removeRow, save, submit
} = useIncentiveStatement(halaqaId, month, year)
const statusBadge = computed(() => onDevice.value
  ? { label: 'على جهازك — بانتظار الرفع', color: 'warning' as const }
  : statement.value
    ? { label: STATEMENT_STATUS[statement.value.status]?.label, color: STATEMENT_STATUS[statement.value.status]?.color }
    : { label: 'جديد — لم يُحفظ', color: 'neutral' as const })
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
        <OfflineSavedNote :keys="[INCENTIVE_HALQA_KEY, 'incentive-statement|*']" />
        <OfflineRejectedDays
          v-if="rejected.length"
          title="لم تقبلها القاعدة"
          :entries="rejected"
          @retry="retryRejected"
          @discard="discardRejected"
        />
        <UiEmptyState
          v-if="!loaded"
          :icon="loading ? 'i-lucide-loader-circle' : noCopy ? 'i-lucide-cloud-off' : 'i-lucide-gift'"
          :title="loading ? 'يُحمَّل الكشف…' : noCopy ? 'كشفُ هذا الشهر ليس على جهازك' : myHalqa ? 'تعذّر تحميل الكشف' : 'لا حلقة معيّنة لك'"
          :description="noCopy ? 'افتحه مرّةً متّصلاً فيُحفظ على جهازك ويعمل بلا إنترنت.' : undefined"
        />

        <template v-else>
          <!-- ملخّص مالي: شريطٌ واحد بثلاثة أقسام (كانت ثلاثَ بطاقاتٍ متساوية وشارةً معلّقة بجانبها) -->
          <dl class="summary">
            <div class="sm-seg">
              <dt>المبلغ المخصّص</dt>
              <dd>{{ fmt(allocated) }} <small>₪</small></dd>
            </div>
            <div class="sm-seg">
              <dt>إجمالي المصروف</dt>
              <dd>{{ fmt(spent) }} <small>₪</small></dd>
            </div>
            <div
              class="sm-seg"
              :class="remaining < 0 ? 'neg' : 'pos'"
            >
              <dt>المتبقّي</dt>
              <dd>{{ fmt(remaining) }} <small>₪</small></dd>
            </div>
          </dl>

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
              <small>صحّح البنود ثم اضغط «إرسال الكشف».</small>
            </div>
          </div>

          <!-- الإرسالُ أعلى البنود في بطاقته وحدَه (طلب المستخدم 2026-10-27)، بعيداً عن «إضافة بند» و«حفظ مسوّدة» -->
          <IncentivesSendCard
            v-if="canEdit && rows.length"
            :count="rows.length"
            :total="fmt(spent)"
            :busy="submitting"
            @send="submit"
          />

          <!-- بنود المصروفات -->
          <div class="card items">
            <div class="items-head">
              <h3>
                بنود المصروفات <span
                  v-if="rows.length"
                  class="count"
                >{{ rows.length }}</span>
              </h3>
              <UBadge
                :label="statusBadge.label"
                :color="statusBadge.color"
                variant="soft"
              />
            </div>

            <UiEmptyState
              v-if="!rows.length && !canEdit"
              icon="i-lucide-receipt"
              title="لا بنود في هذا الكشف"
            />
            <div
              v-else-if="!rows.length"
              class="first-item"
            >
              <p>لم تُضِف مصروفاً لهذا الشهر بعد. سجّل كلّ مصروفٍ بتاريخه وبيانه ومبلغه.</p>
              <UButton
                label="إضافة أوّل بند"
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="lg"
                :ui="{ base: 'rounded-[13px] font-semibold' }"
                @click="addRow"
              />
            </div>
            <IncentivesItemsEditor
              v-else
              v-model:rows="rows"
              :can-edit="canEdit"
              :bounds="bounds"
              :category-items="categoryItems"
              :error-of="errorOf"
              @add="addRow"
              @remove="removeRow"
            />
            <div
              v-if="canEdit"
              class="actions"
            >
              <UButton
                label="حفظ مسوّدة"
                color="neutral"
                variant="outline"
                size="lg"
                icon="i-lucide-save"
                :loading="saving"
                :ui="{ base: 'rounded-[13px] font-semibold min-h-12 justify-center' }"
                @click="saveDraft"
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

/* المحدِّدات: الحلقةُ سطرٌ، والشهرُ والسنةُ معاً — على الجوال نصفان بدل سطرين كاملين */
.pick-fields { display: grid; grid-template-columns: minmax(0, 1fr) 140px 140px; gap: 14px; align-items: end; }
.pf { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.halqa-auto { display: flex; align-items: center; gap: 9px; height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* الملخّص: لوحٌ واحد بثلاثة أقسامٍ يفصلها خطّ */
.summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 0 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
.sm-seg { padding: 16px 20px; display: flex; flex-direction: column-reverse; gap: 6px; }
.sm-seg + .sm-seg { border-inline-start: 1px solid var(--line); }
.sm-seg dt { font-size: 13px; color: var(--ink-3); }
.sm-seg dd { margin: 0; font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1.1; font-variant-numeric: tabular-nums; }
.sm-seg dd small { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.sm-seg.pos dd { color: var(--green-ink); }
.sm-seg.neg dd { color: var(--err); }
.locked { display: flex; align-items: center; gap: 8px; background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }

.returned { display: flex; align-items: flex-start; gap: 10px; background: var(--blue-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; margin-bottom: 16px; }
.returned strong { display: block; font-size: 14.5px; font-weight: 700; }
.returned p { margin: 4px 0; font-size: 14px; color: var(--ink); overflow-wrap: anywhere; }
.returned small { font-size: 12.5px; color: var(--ink-3); }
.warn { display: flex; align-items: center; gap: 8px; background: var(--err-soft); color: var(--err); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }

.items-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.items-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.items-head .count { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.first-item { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 26px 12px 10px; text-align: center; }
.first-item p { margin: 0; max-width: 42ch; color: var(--ink-2); font-size: 14.5px; line-height: 1.7; }

.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); flex-wrap: wrap; }

@media (max-width: 620px) {
  .card { padding: 16px; }
  .pick-fields { grid-template-columns: 1fr 1fr; }
  .pick-fields .pf:first-child { grid-column: 1 / -1; }
  .sm-seg { padding: 12px 12px; }
  .sm-seg dd { font-size: 20px; }
  .sm-seg dt { font-size: 12px; }
  .actions > * { width: 100%; }
}
</style>
