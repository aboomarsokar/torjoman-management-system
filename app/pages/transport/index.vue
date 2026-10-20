<script setup lang="ts">
/**
 * كشف المواصلات: الشهرُ في الرابط (`?y=&m=`، الافتراضيّ شهرُ اليوم بتوقيت غزة)، والعرضُ بحسب الدور —
 * المشرف الميداني والمختبِر يدخلان رحلاتهما («رحلاتي»)، والمدير الإداري ومشرف المشروع يرون الجميع
 * («كلّ الرحلات»، والمدير الإداري يسدّد ومشرف المشروع يقرأ)، وغيرهم لا شأن لهم بالشاشة. الحكمُ لـRLS؛ هذا طبقةُ تجربة.
 */
import { TRANSPORT_LOGGER_ROLES } from '~/constants/transport'
import { gazaToday } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'كشف المواصلات — ترجمان' })

const route = useRoute()
const router = useRouter()
const { role, isAdmin, isReadOnly } = usePermissions()

const [todayYear, todayMonth] = gazaToday().split('-').map(Number) as [number, number]
const max = { year: todayYear, month: todayMonth }

/** الشهرُ من الرابط إن صحّ وليس بعد شهر اليوم، وإلا شهرُ اليوم. */
function fromQuery(): { year: number, month: number } {
  const y = Number(route.query.y)
  const m = Number(route.query.m)
  const valid = Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12 && y >= 2000 && y * 12 + m <= max.year * 12 + max.month
  return valid ? { year: y, month: m } : { year: max.year, month: max.month }
}
const initial = fromQuery()
const year = ref(initial.year)
const month = ref(initial.month)

/** رابطٌ يُفتح والصفحةُ قائمة (إشعار `/transport?y=&m=`): يُعاد تطبيقُ الشهر المتحقَّق منه. لا حلقة: كلٌّ من المراقِبَين يقارن قبل أن يكتب. */
watch(() => [route.query.y, route.query.m], () => {
  const q = fromQuery()
  if (q.year !== year.value) year.value = q.year
  if (q.month !== month.value) month.value = q.month
})

watch([year, month], ([y, m]) => {
  if (Number(route.query.y) === y && Number(route.query.m) === m) return
  router.replace({ query: { ...route.query, y: String(y), m: String(m) } })
})

const isLogger = computed(() => (TRANSPORT_LOGGER_ROLES as readonly string[]).includes(role.value ?? ''))
const seesAll = computed(() => isAdmin.value || isReadOnly.value)
const subtitle = computed(() => {
  if (isLogger.value) return 'رحلاتُك في الشهر — أضِفها وعدّلها ما دامت غيرَ مسدَّدة.'
  if (seesAll.value) return 'رحلاتُ المشرفين الميدانيين والمختبِرين في الشهر.'
  return undefined
})
</script>

<template>
  <div class="transport">
    <UiPageHeader
      title="كشف المواصلات"
      :subtitle="subtitle"
    />

    <template v-if="isLogger || seesAll">
      <div class="card month">
        <span class="month-label">الشهر</span>
        <QuranMonthPicker
          v-model:year="year"
          v-model:month="month"
          :max="max"
        />
      </div>
      <TransportMyTrips
        v-if="isLogger"
        :year="year"
        :month="month"
      />
      <TransportAllTrips
        v-else
        :year="year"
        :month="month"
      />
    </template>
    <UiEmptyState
      v-else-if="role"
      icon="i-lucide-lock"
      title="هذه الشاشة للمشرفين الميدانيين والمختبِرين والإدارة."
    />
  </div>
</template>

<style scoped>
.transport { display: flex; flex-direction: column; gap: 16px; }
.transport :deep(.head) { margin-bottom: 0; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); }
.month { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; }
.month-label { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
</style>
