<script setup lang="ts">
/**
 * أيام الإجازة (`/attendance/holidays`) — للمدير الإداري وحده: يعيّن أيامَ إجازةٍ عامةً للشبكة كلّها بسببٍ نصٍّ حرّ،
 * ويحذف ما عيّنه. المدى «من — إلى» يُوسَّع إلى أيامه بلا الجُمَع، وما كان إجازةً أصلاً يُتخطّى ويُذكر عدده، ثم تأكيدٌ يقول
 * كم يوماً وكم حلقةً سجّلت فيها حضوراً (يبقى كما هو). التعيينُ يُحذف ولا يُعدَّل. غيرُ المدير الإداري يرى الإجازاتِ في
 * شاشاته ولا يرى هذه الشاشة. الحكمُ الأخير لـRLS ومشغّل القاعدة (الجمعة، وما قبل بداية المشروع).
 */
import { PROJECT_START_DATE } from '~/constants/project'
import { daysCount } from '~/utils/attendanceOutbox'
import { expandHolidayRange, holidayConfirmMessage, holidayHorizon, splitNewHolidays } from '~/utils/holidays'
import { formatDay, gazaToday, schoolDayOnOrBefore } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'أيام الإجازة — ترجمان' })

const { role } = useProfile()
const { isAdmin } = usePermissions()
const { handle } = useErrorHandler()
const toast = useToast()
const { list, loading, saving, load, add, remove, recordedHalaqat } = useHolidays()

const today = gazaToday()
const max = holidayHorizon(today)
// الجمعةُ لا تُعيَّن، ولا يومَ قبل بداية المشروع
const start = schoolDayOnOrBefore(today < PROJECT_START_DATE ? PROJECT_START_DATE : today)
const from = ref(start)
const to = ref(start)
const form = useTemplateRef<{ reset: () => void }>('form')

watch(isAdmin, (admin) => {
  if (admin) void load()
}, { immediate: true })

// إضافة: تُحسب الأيامُ والحلقات ثم يُطلب التأكيد
interface PendingAdd { fresh: string[], skipped: number, halaqat: number, reason: string }
const pendingAdd = ref<PendingAdd | null>(null)
const confirmAdd = computed({
  get: () => pendingAdd.value !== null,
  set: (open: boolean) => {
    if (!open) pendingAdd.value = null
  }
})
const checking = ref(false)

async function prepare(payload: { from: string, to: string, reason: string }) {
  const { fresh, skipped } = splitNewHolidays(expandHolidayRange(payload.from, payload.to), list.value.map(h => h.day))
  if (!fresh.length) {
    toast.add({
      title: skipped.length ? 'كلُّ أيام المدى إجازةٌ أصلاً.' : 'المدى جُمَعٌ كلُّه — والجمعةُ عطلةٌ أصلاً.',
      color: 'warning',
      icon: 'i-lucide-circle-alert'
    })
    return
  }
  checking.value = true
  try {
    pendingAdd.value = { fresh, skipped: skipped.length, halaqat: await recordedHalaqat(fresh), reason: payload.reason }
  } catch (err) {
    handle(err)
  } finally {
    checking.value = false
  }
}

const addMessage = computed(() => {
  const p = pendingAdd.value
  return p ? `«${p.reason}» — ${holidayConfirmMessage(p.fresh.length, p.halaqat, p.skipped)}` : ''
})

async function confirmedAdd() {
  const p = pendingAdd.value
  if (!p) return
  if (await add(p.fresh, p.reason)) {
    toast.add({ title: `أُضيفت الإجازة: ${daysCount(p.fresh.length)}.`, color: 'success', icon: 'i-lucide-circle-check' })
    form.value?.reset()
  }
  pendingAdd.value = null
}

// حذف: بعد تأكيد
const removing = ref<string | null>(null)
const confirmRemove = computed({
  get: () => removing.value !== null,
  set: (open: boolean) => {
    if (!open) removing.value = null
  }
})

async function confirmedRemove() {
  const day = removing.value
  if (!day) return
  if (await remove(day)) toast.add({ title: 'حُذفت الإجازة.', color: 'success', icon: 'i-lucide-circle-check' })
  removing.value = null
}
</script>

<template>
  <div>
    <div
      v-if="!role"
      class="stack"
      aria-busy="true"
    >
      <UiSkeletonRow
        v-for="i in 3"
        :key="i"
        :desc="false"
        :action="false"
      />
    </div>

    <UiEmptyState
      v-else-if="!isAdmin"
      icon="i-lucide-lock"
      title="هذه الشاشة للمدير الإداري"
    />

    <template v-else>
      <UiPageHeader
        title="أيام الإجازة"
        subtitle="إجازةٌ عامةٌ للشبكة كلّها: لا يُسجَّل فيها حضور، والحضورُ المسجَّل قبل تعيينها يبقى."
      >
        <template #actions>
          <UButton
            label="الحضور اليوميّ"
            icon="i-lucide-calendar-check"
            color="neutral"
            variant="outline"
            size="lg"
            to="/attendance"
            :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
          />
        </template>
      </UiPageHeader>

      <AttendanceHolidayForm
        ref="form"
        v-model:from="from"
        v-model:to="to"
        :max="max"
        :busy="checking || saving"
        @submit="prepare"
      />

      <div
        v-if="loading && !list.length"
        class="stack"
        aria-busy="true"
      >
        <UiSkeletonRow
          v-for="i in 3"
          :key="i"
          :desc="false"
        />
      </div>
      <UiEmptyState
        v-else-if="!list.length"
        icon="i-lucide-calendar-off"
        title="لا أيام إجازة معيَّنة"
        description="أضف إجازةً من النموذج أعلاه."
      />
      <AttendanceHolidayList
        v-else
        :items="list"
        :today="today"
        :busy="saving"
        @remove="removing = $event"
      />
    </template>

    <UiConfirmModal
      v-model:open="confirmAdd"
      title="تأكيد إضافة الإجازة"
      :message="addMessage"
      confirm-label="أضف الإجازة"
      confirm-color="primary"
      confirm-icon="i-lucide-calendar-plus"
      :loading="saving"
      @confirm="confirmedAdd"
    />
    <UiConfirmModal
      v-model:open="confirmRemove"
      title="حذف الإجازة؟"
      :message="removing ? `يعود ${formatDay(removing)} يوماً عادياً يُسجَّل فيه الحضور.` : ''"
      :loading="saving"
      @confirm="confirmedRemove"
    />
  </div>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 12px; }
</style>
