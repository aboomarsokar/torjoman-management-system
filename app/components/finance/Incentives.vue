<script setup lang="ts">
/**
 * حوافز الحلقات (§4.20د) — تخصيص المبلغ لكل حلقة/شهر (قفل بالاعتماد)
 * + جدول الكشوف الواردة من المعلمين (مستلَم/مصروف/متبقّي/حالة) مع «تمّ الاطّلاع».
 * reviewOnly: يُخفي التخصيص (للمدير الإداري وحده) ويُبقي مراجعة الكشوف — تستعمله
 * صفحة الحوافز للمعتمِدين (الفني والمديرة الإدارية) ولمشرف المشروع (عرضاً).
 */
import type { Database } from '~/types/database.types'

interface Props {
  /** إخفاء قسم التخصيص وأزراره، وإبقاء الكشوف الواردة فقط. */
  reviewOnly?: boolean
}
const props = withDefaults(defineProps<Props>(), { reviewOnly: false })

const { isReadOnly, isAdmin, isWomenAdmin } = usePermissions()
const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

type AllocRow = { halaqa_id: string, name: string, teacher: string, amount: string }
type StmtRow = { id: string, halaqa: string, received: number, spent: number, status: string, returnNote: string | null }
const rows = ref<AllocRow[]>([])
const statements = ref<StmtRow[]>([])
const approved = ref(false)
const loaded = ref(false)
const loading = ref(false)
const canEdit = computed(() => !approved.value && !isReadOnly.value && !props.reviewOnly)
// مراجعة الكشوف للمدير الإداري والمديرة الإدارية (بلا الفني — can_review_statement_in_halaqa في القاعدة)
const canReview = computed(() => (isAdmin.value || isWomenAdmin.value) && !isReadOnly.value)
const total = computed(() => rows.value.reduce((s, r) => s + (Number(r.amount) || 0), 0))
const fmt = (n: number) => n.toLocaleString('ar')

async function load() {
  loading.value = true
  try {
    const [{ data: halqat }, { data: alloc }, { data: stmts }] = await Promise.all([
      supabase.from('halaqat').select('id, name, teacher:teacher_id(full_name)').order('name').returns<{ id: string, name: string, teacher: { full_name: string } | null }[]>(),
      supabase.from('halaqa_incentives').select('halaqa_id, allocated_amount, approved').eq('incentive_month', month.value).eq('incentive_year', year.value),
      supabase.from('incentive_statements').select('id, halaqa_id, received_amount, status, return_note, items:incentive_statement_items(amount), halaqa:halaqa_id(name)').eq('statement_month', month.value).eq('statement_year', year.value)
        .returns<{ id: string, halaqa_id: string, received_amount: number, status: string, return_note: string | null, items: { amount: number }[], halaqa: { name: string } | null }[]>()
    ])
    const map: Record<string, number> = {}
    for (const a of alloc ?? []) map[a.halaqa_id] = a.allocated_amount
    approved.value = (alloc ?? []).some(a => a.approved)
    rows.value = (halqat ?? []).map(h => ({ halaqa_id: h.id, name: h.name, teacher: h.teacher?.full_name ?? '—', amount: map[h.id] != null ? String(map[h.id]) : '' }))
    statements.value = (stmts ?? []).map(s => ({
      id: s.id, halaqa: s.halaqa?.name ?? '—', received: s.received_amount,
      spent: (s.items ?? []).reduce((t, i) => t + i.amount, 0), status: s.status, returnNote: s.return_note
    }))
    loaded.value = true
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    // upsert أولاً ثم حذف المُفرَّغ فقط — لا نحذف الشهر كاملاً قبل الإدراج كي لا تضيع البيانات لو فشل
    const payload = rows.value.filter(r => Number(r.amount) > 0)
      .map(r => ({ halaqa_id: r.halaqa_id, incentive_month: month.value, incentive_year: year.value, allocated_amount: Number(r.amount), approved: false }))
    if (payload.length) {
      const { error } = await supabase.from('halaqa_incentives').upsert(payload, { onConflict: 'halaqa_id,incentive_month,incentive_year' })
      if (error) throw error
    }
    const cleared = rows.value.filter(r => !(Number(r.amount) > 0)).map(r => r.halaqa_id)
    if (cleared.length) {
      const { error } = await supabase.from('halaqa_incentives').delete()
        .eq('incentive_month', month.value).eq('incentive_year', year.value).in('halaqa_id', cleared)
      if (error) throw error
    }
    toast.add({ title: 'حُفظ التخصيص.', color: 'success', icon: 'i-lucide-save' })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const working = ref(false)
async function approveAlloc() {
  working.value = true
  try {
    await save()
    const { error } = await supabase.from('halaqa_incentives')
      .update({ approved: true, approved_by: profile.value?.id ?? null, approved_at: new Date().toISOString() })
      .eq('incentive_month', month.value).eq('incentive_year', year.value)
    if (error) throw error
    approved.value = true
    toast.add({ title: 'تم اعتماد التخصيص.', color: 'success', icon: 'i-lucide-lock' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}
async function reopen() {
  working.value = true
  try {
    const { error } = await supabase.from('halaqa_incentives')
      .update({ approved: false, approved_by: null, approved_at: null })
      .eq('incentive_month', month.value).eq('incentive_year', year.value)
    if (error) throw error
    approved.value = false
    toast.add({ title: 'أُعيد فتح التخصيص.', color: 'success', icon: 'i-lucide-lock-open' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}

// ترحيل التخصيص المعتمد كحركة «صادر/حوافز» — حركةٌ واحدة للشهر (source_key)، وإعادة الترحيل تُحدّثها.
// كانت الحوافز المعتمدة لا تدخل الملف المالي أصلاً فيبدو الرصيد أعلى من حقيقته.
async function postAsTransaction() {
  if (total.value <= 0) {
    toast.add({ title: 'لا مبلغ لترحيله.', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  working.value = true
  try {
    const { error } = await supabase.from('financial_transactions').upsert({
      transaction_date: new Date().toISOString().slice(0, 10),
      description: `حوافز الحلقات ${periodLabel(year.value, month.value)}`,
      category: 'حوافز', type: 'expense', amount: total.value, created_by: profile.value?.id ?? null,
      source_key: monthSourceKey('incentives', month.value, year.value)
    }, { onConflict: 'source_key' })
    if (error) throw error
    toast.add({ title: 'رُحّلت كحركة «صادر/حوافز» (تُحدَّث إن أُعيد الترحيل).', color: 'success', icon: 'i-lucide-arrow-left-right' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}

// الشهر الجاري يُحمَّل عند الفتح (كان يُطلب ضغط «تحميل» أولاً على شاشةٍ فارغة)
onMounted(load)

// بنودُ الكشف تُفتح في نافذةٍ و«تمّ الاطّلاع» فيها — لا إقرارَ بلا رؤية البنود
const reviewing = ref<StmtRow | null>(null)
const reviewOpen = ref(false)
function openStatement(s: StmtRow) {
  reviewing.value = s
  reviewOpen.value = true
}
function onReviewed(id: string) {
  const s = statements.value.find(x => x.id === id)
  if (s) s.status = 'reviewed'
}
function onReturned(id: string, note: string) {
  const s = statements.value.find(x => x.id === id)
  if (s) Object.assign(s, { status: 'draft', returnNote: note })
}
/** المسوّدةُ التي أعادها المراجِع تُميَّز عن مسوّدةٍ لم تُرسل قطّ. */
const statementBadge = (s: StmtRow) => (s.status === 'draft' && s.returnNote)
  ? { label: 'أُعيد للمعلّم', color: 'warning' as const }
  : STATEMENT_STATUS[s.status]
</script>

<template>
  <div>
    <div class="bar">
      <div class="picker">
        <UiSelect
          v-model="month"
          :items="monthItems"
          size="md"
          class="sel"
        />
        <UiSelect
          v-model="year"
          :items="yearItems"
          size="md"
          class="sel"
        />
        <UButton
          label="تحميل"
          color="primary"
          size="md"
          icon="i-lucide-folder-open"
          :loading="loading"
          :ui="{ base: 'rounded-[12px] font-semibold' }"
          @click="load"
        />
      </div>
      <UBadge
        v-if="loaded && approved"
        label="التخصيص معتمد"
        color="success"
        variant="soft"
        size="lg"
      />
    </div>

    <ClientOnly>
      <UiEmptyState
        v-if="!loaded"
        icon="i-lucide-gift"
        title="اختر الشهر ثم «تحميل»"
      />
      <template v-else>
        <!-- التخصيص -->
        <template v-if="!reviewOnly">
          <h3 class="sec-t">
            تخصيص الحوافز
          </h3>
          <div class="table-wrap stack-wrap">
            <table>
              <thead>
                <tr>
                  <th class="ta-start">
                    #
                  </th><th class="ta-start">
                    الحلقة
                  </th><th class="ta-start">
                    المعلّم
                  </th><th>المخصّص (₪)</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(r, i) in rows"
                  :key="r.halaqa_id"
                >
                  <td class="ta-start muted stack-hide">
                    {{ i + 1 }}
                  </td>
                  <td class="ta-start strong">
                    {{ r.name }}
                  </td>
                  <td
                    class="ta-start muted"
                    data-label="المعلّم"
                  >
                    {{ r.teacher }}
                  </td>
                  <td data-label="المخصّص (₪)">
                    <input
                      v-model="r.amount"
                      :disabled="!canEdit"
                      type="number"
                      class="cell"
                      dir="ltr"
                    >
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colspan="3"
                    class="ta-start strong"
                  >
                    إجمالي المخصّص
                  </td><td class="strong num">
                    {{ fmt(total) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="actions">
            <UButton
              v-if="canEdit"
              label="حفظ"
              color="primary"
              size="lg"
              icon="i-lucide-save"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="save"
            />
            <UButton
              v-if="canEdit"
              label="اعتماد التخصيص"
              color="success"
              size="lg"
              icon="i-lucide-lock"
              :loading="working"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
              @click="approveAlloc"
            />
            <template v-else-if="!isReadOnly">
              <UButton
                label="فتح للتعديل"
                color="neutral"
                variant="outline"
                size="lg"
                icon="i-lucide-lock-open"
                :loading="working"
                :ui="{ base: 'rounded-[13px]' }"
                @click="reopen"
              />
              <UButton
                label="ترحيل كحركة"
                color="neutral"
                variant="outline"
                size="lg"
                icon="i-lucide-arrow-left-right"
                :loading="working"
                :ui="{ base: 'rounded-[13px]' }"
                @click="postAsTransaction"
              />
            </template>
          </div>
        </template>

        <!-- الكشوف الواردة -->
        <h3 class="sec-t mt">
          الكشوف الواردة
        </h3>
        <UiEmptyState
          v-if="!statements.length"
          icon="i-lucide-inbox"
          title="لا كشوف لهذا الشهر"
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
                </th><th class="ta-start">
                  الحلقة
                </th><th>المستلَم</th><th>المصروف</th><th>المتبقّي</th><th>الحالة</th><th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, i) in statements"
                :key="s.id"
              >
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
                  data-label="المصروف"
                >
                  {{ fmt(s.spent) }}
                </td>
                <td
                  class="num"
                  :class="(s.received - s.spent) < 0 ? 'out' : ''"
                  data-label="المتبقّي"
                >
                  {{ fmt(s.received - s.spent) }}
                </td>
                <td data-label="الحالة">
                  <UBadge
                    :label="statementBadge(s)?.label"
                    :color="statementBadge(s)?.color"
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
                    @click="openStatement(s)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </ClientOnly>

    <FinanceStatementReviewModal
      v-model:open="reviewOpen"
      :statement="reviewing"
      :can-review="canReview"
      @reviewed="onReviewed"
      @returned="onReturned"
    />
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.picker { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.sel { width: 130px; }
.sec-t { margin: 0 0 12px; font-size: 16.5px; font-weight: 700; color: var(--ink); }
.sec-t.mt { margin-top: 26px; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 560px; }
thead tr, tfoot tr { background: var(--surface-2); }
th { padding: 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; text-align: center; }
th.ta-start { text-align: start; }
td { padding: 9px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.muted { color: var(--ink-3); }
.strong { font-weight: 700; color: var(--ink); }
.num { font-variant-numeric: tabular-nums; }
.out { color: var(--err); font-weight: 600; }
.cell { width: 130px; height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; text-align: center; outline: none; }
.cell:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.cell:disabled { opacity: .6; cursor: not-allowed; }
.actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
</style>
