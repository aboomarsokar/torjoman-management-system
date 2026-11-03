<script setup lang="ts">
/**
 * الرواتب الشهرية (§4.20ج) — كشفٌ يُحسب من التقييم (طلب المستخدم 2026-11-03): المعلمُ بمكافأته × تقييمه النهائيّ ÷ 100
 * مرفوعاً إلى أقرب 5، والمشرفُ والمختبِرُ وسائرُ أصحاب الرواتب بمكافأتهم كاملة (الافتراضيّة 600 وتُعدَّل لكلّ عامل)،
 * وتعديلٌ يدويّ بسببٍ إلزاميّ. حفظ + اعتماد (قفل) + ترحيل كحركة «صادر/رواتب». البياناتُ والحفظ في `usePayroll`.
 */
import type { Database } from '~/types/database.types'
import { STAFF_ROLES, type Role } from '~/constants/roles'
import { rowAmounts } from '~/composables/usePayroll'

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
const payroll = usePayroll(SALARIED_ROLES)
const { rows, fallback, approved } = payroll

const now = new Date()
const yearItems = [now.getFullYear() - 1, now.getFullYear()].map(y => ({ label: String(y), value: y }))
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const loaded = ref(false)
const loading = ref(false)
const canEdit = computed(() => !approved.value && !isReadOnly.value)
const amounts = computed(() => rows.value.map(r => rowAmounts(r, fallback.value)))
const total = computed(() => amounts.value.reduce((s, a) => s + (a.net ?? 0), 0))
const waiting = computed(() => amounts.value.filter((a, i) => rows.value[i]!.role === 'teacher' && a.suggested === null).length)

async function load() {
  loading.value = true
  try {
    await payroll.load(month.value, year.value)
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
    await payroll.save(month.value, year.value)
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
    await payroll.save(month.value, year.value)
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
    // حركةٌ واحدة لكل شهر (source_key فريد): إعادة الترحيل تُحدّث مبلغها لا تُضيف حركةً ثانية
    const { error } = await supabase.from('financial_transactions').upsert({
      transaction_date: new Date().toISOString().slice(0, 10),
      description: `رواتب ${periodLabel(year.value, month.value)}`,
      category: 'رواتب', type: 'expense', amount: total.value, created_by: profile.value?.id ?? null,
      source_key: monthSourceKey('salaries', month.value, year.value)
    }, { onConflict: 'source_key' })
    if (error) throw error
    toast.add({ title: 'رُحّلت كحركة «صادر/رواتب» (تُحدَّث إن أُعيد الترحيل).', color: 'success', icon: 'i-lucide-arrow-left-right' })
  } catch (err) {
    handle(err)
  } finally {
    working.value = false
  }
}

// الشهر الجاري يُحمَّل عند الفتح
onMounted(load)
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

    <p
      v-if="loaded && waiting"
      class="note"
    >
      <UIcon
        name="i-lucide-hourglass"
        class="size-4"
      /> {{ waiting }} من المعلمين بانتظار إقفال سجلّ الجودة — لا يُحسب لهم مبلغٌ قبله.
    </p>
    <ClientOnly>
      <UiEmptyState
        v-if="!loaded"
        icon="i-lucide-wallet"
        title="اختر الشهر ثم «تحميل»"
      />
      <template v-else>
        <FinanceSalaryTable
          v-model:rows="rows"
          :amounts="amounts"
          :fallback="fallback"
          :can-edit="canEdit"
          :total="total"
        />

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
            v-if="!isReadOnly && approved"
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
.actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.note { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 14px; }
</style>
