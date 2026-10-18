<script setup lang="ts">
/**
 * كشف حوافز الحلقة الشهري (§4.25) — للمعلّم.
 * المعلّم يرفع مصروفات الحوافز لحلقته شهريّاً؛ المبلغ المخصّص يضبطه المدير
 * (للقراءة فقط)، والمتبقّي = المخصّص − المصروف. المدير يطّلع ويراجع (§4.20د).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'كشف الحوافز — ترجمان' })

type StatementStatus = Database['public']['Enums']['statement_status']
const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()
const { isTeacher, canApprove, isReadOnly } = usePermissions()
const canReview = computed(() => canApprove.value || isReadOnly.value)

const CATEGORIES = ['جوائز', 'أنشطة', 'ضيافة', 'أخرى']
const categoryItems = CATEGORIES.map(c => ({ label: c, value: c }))
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

type ItemRow = { description: string, category: string, amount: number | string, item_date: string }
const loaded = ref(false)
const loading = ref(false)
const statement = ref<{ id: string, status: StatementStatus } | null>(null)
const allocated = ref(0)
const rows = ref<ItemRow[]>([])

const canEdit = computed(() => isTeacher.value && statement.value?.status !== 'reviewed')
const num = (v: number | string) => (v === '' || v === null) ? 0 : Number(v)
const spent = computed(() => rows.value.reduce((s, r) => s + num(r.amount), 0))
const remaining = computed(() => allocated.value - spent.value)
const today = new Date().toISOString().slice(0, 10)

async function load() {
  if (!myHalqa.value) return
  loading.value = true
  try {
    const hid = myHalqa.value.id
    const [{ data: alloc }, { data: st }] = await Promise.all([
      supabase.from('halaqa_incentives').select('allocated_amount').eq('halaqa_id', hid).eq('incentive_month', month.value).eq('incentive_year', year.value).maybeSingle(),
      supabase.from('incentive_statements').select('id, status, received_amount').eq('halaqa_id', hid).eq('statement_month', month.value).eq('statement_year', year.value).maybeSingle()
    ])
    allocated.value = alloc?.allocated_amount ?? 0
    statement.value = st ? { id: st.id, status: st.status } : null

    let items: { description: string | null, category: string | null, amount: number, item_date: string | null }[] = []
    if (st) {
      const { data } = await supabase.from('incentive_statement_items').select('description, category, amount, item_date').eq('statement_id', st.id)
      items = data ?? []
    }
    rows.value = items.map(i => ({ description: i.description ?? '', category: i.category ?? 'جوائز', amount: i.amount, item_date: i.item_date ?? today }))
    loaded.value = true
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}

function addRow() {
  rows.value.push({ description: '', category: 'جوائز', amount: '', item_date: today })
}
function removeRow(i: number) {
  rows.value.splice(i, 1)
}

const saving = ref(false)
async function save() {
  if (!myHalqa.value) return
  saving.value = true
  try {
    let sid = statement.value?.id
    if (!sid) {
      const { data, error } = await supabase.from('incentive_statements')
        .insert({ halaqa_id: myHalqa.value.id, statement_month: month.value, statement_year: year.value, received_amount: allocated.value, status: 'draft', created_by: profile.value?.id ?? null })
        .select('id, status').single()
      if (error || !data) throw error
      statement.value = { id: data.id, status: data.status }
      sid = data.id
    } else {
      const { error } = await supabase.from('incentive_statements').update({ received_amount: allocated.value }).eq('id', sid)
      if (error) throw error
    }

    await supabase.from('incentive_statement_items').delete().eq('statement_id', sid)
    const payload = rows.value
      .filter(r => r.description.trim() || num(r.amount) > 0)
      .map(r => ({ statement_id: sid!, description: r.description.trim() || null, category: r.category, amount: num(r.amount), item_date: r.item_date || null }))
    if (payload.length) {
      const { error } = await supabase.from('incentive_statement_items').insert(payload)
      if (error) throw error
    }
    toast.add({ title: 'حُفظ الكشف.', color: 'success', icon: 'i-lucide-save' })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const submitting = ref(false)
async function submit() {
  if (!statement.value) {
    toast.add({ title: 'احفظ الكشف أولاً.', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  submitting.value = true
  try {
    const { error } = await supabase.from('incentive_statements').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', statement.value.id)
    if (error) throw error
    statement.value.status = 'submitted'
    toast.add({ title: 'أُرسل الكشف للمدير.', color: 'success', icon: 'i-lucide-send' })
  } catch (err) {
    handle(err)
  } finally {
    submitting.value = false
  }
}

const fmt = (n: number) => n.toLocaleString('ar')
</script>

<template>
  <div class="inc">
    <UiPageHeader
      :title="canReview ? 'كشوف حوافز الحلقات' : 'كشف حوافز الحلقة'"
      :subtitle="canReview ? 'الكشوف الواردة من المعلّمين لكل شهر — مراجعتها واعتمادها بـ«تمّ الاطّلاع».' : 'مصروفات مبلغ الحوافز الشهري لحلقتك — أضِف البنود وارفع الكشف للمدير.'"
    />

    <!-- المعتمِدون ومشرف المشروع: مراجعة الكشوف الواردة في نطاقهم (RLS) بلا تخصيص -->
    <FinanceIncentives
      v-if="canReview"
      review-only
    />

    <UiEmptyState
      v-else-if="!isTeacher"
      icon="i-lucide-lock"
      title="هذه الصفحة للمعلّم."
    />

    <template v-else>
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
          <UButton
            label="تحميل / إنشاء"
            color="primary"
            size="lg"
            icon="i-lucide-folder-open"
            :disabled="!myHalqa"
            :loading="loading"
            :ui="{ base: 'rounded-[13px] font-semibold self-end' }"
            @click="load"
          />
        </div>
      </div>

      <ClientOnly>
        <UiEmptyState
          v-if="!loaded"
          icon="i-lucide-gift"
          title="اختر الشهر ثم اضغط «تحميل / إنشاء»"
          description="يظهر المبلغ المخصّص وبنود المصروفات للتعبئة."
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
              class="table-wrap"
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
                    <td class="ta-start muted">
                      {{ i + 1 }}
                    </td>
                    <td class="ta-start">
                      <input
                        v-model="r.description"
                        :disabled="!canEdit"
                        class="cell wide"
                        placeholder="وصف البند"
                      >
                    </td>
                    <td>
                      <UiSelect
                        v-model="r.category"
                        :items="categoryItems"
                        :disabled="!canEdit"
                        size="sm"
                      />
                    </td>
                    <td>
                      <input
                        v-model="r.amount"
                        :disabled="!canEdit"
                        type="number"
                        class="cell"
                        dir="ltr"
                      >
                    </td>
                    <td>
                      <input
                        v-model="r.item_date"
                        :disabled="!canEdit"
                        type="date"
                        class="cell"
                        dir="ltr"
                      >
                    </td>
                    <td v-if="canEdit">
                      <UButton
                        color="error"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-x"
                        aria-label="حذف"
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
                @click="save"
              />
              <UButton
                v-if="statement && statement.status === 'draft'"
                label="إرسال للمدير"
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
.inc { max-width: 1080px; margin: 0 auto; }
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

.actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }

@media (max-width: 620px) { .pf, .pf.sm { flex: 1 1 100%; } }
</style>
