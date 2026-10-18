<script setup lang="ts">
/**
 * الرواتب الشهرية (§4.20ج) — سجلّ مرجعي: راتب كل عامل لكل شهر.
 * إدخال + إجمالي + اعتماد (قفل) + ترحيل كحركة «صادر/رواتب».
 */
import type { Database } from '~/types/database.types'
import { roleLabel, STAFF_ROLES, type Role } from '~/constants/roles'

/**
 * أصحاب الرواتب: العاملون عدا المدير الإداري ومشرف المشروع والمدير الفني (قرار 2026-10-18)
 * — والطالب ليس عاملاً.
 */
const UNSALARIED_ROLES: Role[] = ['admin_manager', 'project_supervisor', 'technical_manager']
const SALARIED_ROLES = STAFF_ROLES.filter(r => !UNSALARIED_ROLES.includes(r))

const { isReadOnly } = usePermissions()
const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

type Row = { profile_id: string, name: string, role: Role, gender: 'male' | 'female' | null, amount: string }
const rows = ref<Row[]>([])
const approved = ref(false)
const loaded = ref(false)
const loading = ref(false)
const canEdit = computed(() => !approved.value && !isReadOnly.value)
const total = computed(() => rows.value.reduce((s, r) => s + (Number(r.amount) || 0), 0))
const fmt = (n: number) => n.toLocaleString('ar')

async function load() {
  loading.value = true
  try {
    const [{ data: workers }, { data: sal }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, gender').in('role', SALARIED_ROLES).eq('status', 'active').order('full_name'),
      supabase.from('monthly_salaries').select('profile_id, amount, approved').eq('salary_month', month.value).eq('salary_year', year.value)
    ])
    const map: Record<string, { amount: number, approved: boolean }> = {}
    for (const s of sal ?? []) map[s.profile_id] = { amount: s.amount, approved: s.approved }
    approved.value = (sal ?? []).some(s => s.approved)
    rows.value = (workers ?? []).map(w => ({ profile_id: w.id, name: w.full_name, role: w.role, gender: w.gender, amount: map[w.id] ? String(map[w.id]!.amount) : '' }))
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
      .map(r => ({ profile_id: r.profile_id, salary_month: month.value, salary_year: year.value, amount: Number(r.amount), approved: false }))
    if (payload.length) {
      const { error } = await supabase.from('monthly_salaries').upsert(payload, { onConflict: 'profile_id,salary_month,salary_year' })
      if (error) throw error
    }
    const cleared = rows.value.filter(r => !(Number(r.amount) > 0)).map(r => r.profile_id)
    if (cleared.length) {
      const { error } = await supabase.from('monthly_salaries').delete()
        .eq('salary_month', month.value).eq('salary_year', year.value).in('profile_id', cleared)
      if (error) throw error
    }
    toast.add({ title: 'حُفظت الرواتب.', color: 'success', icon: 'i-lucide-save' })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

const working = ref(false)
async function approveMonth() {
  working.value = true
  try {
    await save()
    const { error } = await supabase.from('monthly_salaries')
      .update({ approved: true, approved_by: profile.value?.id ?? null, approved_at: new Date().toISOString() })
      .eq('salary_month', month.value).eq('salary_year', year.value)
    if (error) throw error
    approved.value = true
    toast.add({ title: 'تم اعتماد رواتب الشهر.', color: 'success', icon: 'i-lucide-lock' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}
async function reopen() {
  working.value = true
  try {
    const { error } = await supabase.from('monthly_salaries')
      .update({ approved: false, approved_by: null, approved_at: null })
      .eq('salary_month', month.value).eq('salary_year', year.value)
    if (error) throw error
    approved.value = false
    toast.add({ title: 'أُعيد فتح الرواتب للتعديل.', color: 'success', icon: 'i-lucide-lock-open' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}

async function postAsTransaction() {
  if (total.value <= 0) {
    toast.add({ title: 'لا مبلغ لترحيله.', color: 'warning', icon: 'i-lucide-info' })
    return
  }
  working.value = true
  try {
    const { error } = await supabase.from('financial_transactions').insert({
      transaction_date: new Date().toISOString().slice(0, 10),
      description: `رواتب ${monthName(month.value)} ${year.value}`,
      category: 'رواتب', type: 'expense', amount: total.value, created_by: profile.value?.id ?? null
    })
    if (error) throw error
    toast.add({ title: 'رُحّلت كحركة «صادر/رواتب».', color: 'success', icon: 'i-lucide-arrow-left-right' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}
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
        label="معتمد"
        color="success"
        variant="soft"
        size="lg"
      />
    </div>

    <ClientOnly>
      <UiEmptyState
        v-if="!loaded"
        icon="i-lucide-wallet"
        title="اختر الشهر ثم «تحميل»"
      />
      <template v-else>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="ta-start">
                  #
                </th>
                <th class="ta-start">
                  العامل
                </th>
                <th>الدور</th>
                <th>راتب الشهر (₪)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in rows"
                :key="r.profile_id"
              >
                <td class="ta-start muted">
                  {{ i + 1 }}
                </td>
                <td class="ta-start strong">
                  {{ r.name }}
                </td>
                <td>
                  <UBadge
                    :label="roleLabel(r.role, r.gender)"
                    color="neutral"
                    variant="soft"
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
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td
                  colspan="3"
                  class="ta-start strong"
                >
                  إجمالي الرواتب
                </td>
                <td class="strong num">
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
            label="اعتماد رواتب الشهر"
            color="success"
            size="lg"
            icon="i-lucide-lock"
            :loading="working"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="approveMonth"
          />
          <UButton
            v-else-if="!isReadOnly"
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
            v-if="!isReadOnly"
            label="ترحيل كحركة"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-arrow-left-right"
            :loading="working"
            :ui="{ base: 'rounded-[13px]' }"
            @click="postAsTransaction"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.picker { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.sel { width: 130px; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 480px; }
thead tr, tfoot tr { background: var(--surface-2); }
th { padding: 12px; font-weight: 600; color: var(--ink-3); font-size: 12.5px; text-align: center; }
th.ta-start { text-align: start; }
td { padding: 9px 12px; vertical-align: middle; text-align: center; border-top: 1px solid var(--line); }
.ta-start { text-align: start; }
.strong { font-weight: 700; color: var(--ink); }
.muted { color: var(--ink-3); }
.num { font-variant-numeric: tabular-nums; }
.cell { width: 130px; height: 38px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 14px; text-align: center; outline: none; }
.cell:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--ring); }
.cell:disabled { opacity: .6; cursor: not-allowed; }
.actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
</style>
