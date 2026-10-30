<script setup lang="ts">
/**
 * الحضور اليوميّ — غياباتُ اليوم ثم «حفظ الحضور».
 * المعلم حلقتُه تلقائياً، والمعتمِدون/المديران يختارون حلقة. الحضورُ هو الأصل: الجميع حاضرٌ افتراضاً،
 * وتُسجَّل الغياباتُ وحدَها (بعذر / بلا عذر) في مسوّدةٍ يكتبها «حفظ الحضور»؛ والحلقةُ «انعقدت» في اليوم إذا
 * سُجّل حضورُه — لا زرَّ منفصلاً (طلب المستخدم 2026-10-21). والتعديلُ غيرُ المحفوظ يُنبَّه إليه قبل المغادرة.
 * شهرٌ رصدُه معتمَد يُقفل (قراءة)، ومشرف المشروع قراءةٌ فقط. الحكمُ الأخير لـRLS وحارسَي القاعدة.
 * وبلاغ «لم تنعقد» (2026-10-30): يومُ إجازةٍ عامة ← شريطُ الإجازة، ويومٌ فيه بلاغٌ ← لوحةُ البلاغ بقبولٍ ورفضٍ لمعتمِده؛
 * والبلاغُ المعلّق أو المرفوض يُترك لمن يكتب الحضورَ «حفظ الحضور» بعد تنبيهٍ بأنّه سيمحو البلاغ.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الحضور اليوميّ — ترجمان' })

type NameRow = { id: string, name: string, gender: string | null }
type StudentRow = { id: string, full_name: string, enrollment_date: string | null }

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const { isTeacher, isAdmin, canApprove, isReadOnly } = usePermissions()
// المعلّمُ يسجّل حضورَه في `/t` التي تعمل بلا إنترنت (البند 14) — شاشةٌ واحدةٌ له كي لا يتسابق حفظان على اليوم نفسه
watch(isTeacher, (teacher) => {
  if (teacher) navigateTo('/t', { replace: true })
}, { immediate: true })

const today = gazaToday()
// الجمعةُ عطلة (الدوامُ من السبت إلى الخميس — قرار المستخدم 2026-10-24): الشاشةُ تفتح يومَها على الخميس
// قبلها لإكمال حضوره، ولا يُرصَد فيها يوم؛ والحارسُ في القاعدة يرفضها كذلك
const fridayToday = isFriday(today)
const route = useRoute()
// ?d= من تفصيل يومٍ في «متابعة الرصد» — يومٌ صحيحٌ لا يتجاوز اليوم، وإلا اليوم (والجمعةُ ← الخميس)
const qd = typeof route.query.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.d) && route.query.d <= today ? route.query.d : null
// لا يومَ قبل بداية المشروع (2026-10-01 خميس، فلا يقع على جمعة)
const day = ref(clampDayToProjectStart(schoolDayOnOrBefore(qd ?? today)))
const dayIsFriday = computed(() => isFriday(day.value))
const halaqaId = ref<string | null>(typeof route.query.h === 'string' ? route.query.h : null)

// حلقة المعلم تلقائياً، وغيرُه يرى الحلقات التي تسمح له بها RLS
const { data: halaqat, pending: halaqatPending } = useLazyAsyncData<NameRow[]>('attendance-halaqat', async () => {
  if (!role.value) return []
  const query = supabase.from('halaqat').select('id, name, gender').order('name')
  if (role.value === 'teacher') {
    const { data } = await query.eq('teacher_id', profile.value?.id ?? '').limit(1)
    return data ?? []
  }
  const { data } = await query
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

watch(halaqat, (list) => {
  // ?h= من «متابعة الرصد» يبقى حتى تصل القائمة (فارغةً قبلها كانت تمسحه)
  if (list.length && !list.some(h => h.id === halaqaId.value)) halaqaId.value = list[0]?.id ?? null
}, { immediate: true })

// UiSelect لا يقبل null: الحلقةُ الفارغة نصٌّ فارغ في المحدِّد
const halaqaPick = computed<string>({
  get: () => halaqaId.value ?? '',
  set: (v) => {
    if (!keepsEdits()) halaqaId.value = v || null
  }
})
const halaqaItems = computed(() => halaqat.value.map(h => ({ label: h.name, value: h.id })))
const currentHalaqa = computed(() => halaqat.value.find(h => h.id === halaqaId.value))
const halaqaName = computed(() => currentHalaqa.value?.name ?? '')

// الطلاب النشطون في الحلقة؛ من التحق بعد اليوم المعروض لا يظهر فيه
const students = ref<StudentRow[]>([])
const studentsLoading = ref(false)
watch(halaqaId, async (hid) => {
  students.value = []
  if (!hid) return
  studentsLoading.value = true
  try {
    const { data, error } = await supabase.from('students').select('id, full_name, enrollment_date')
      .eq('halaqa_id', hid).eq('status', 'active').order('full_name')
    if (error) throw error
    if (hid === halaqaId.value) students.value = data ?? []
  } catch (err) {
    handle(err)
  } finally {
    studentsLoading.value = false
  }
}, { immediate: true })
const enrolled = computed(() => students.value.filter(s => !s.enrollment_date || s.enrollment_date <= day.value))

const { held, draft, locked, loading, saving, offDay, holiday, reviewing, load, setDraft, isDirty, save, cancelDay: cancelHeldDay, reviewOffDay } = useAttendanceDay(halaqaId, day)
watch([halaqaId, day], load, { immediate: true })

// إجازةٌ عامة أو بلاغٌ معتمَد ← لا كتابة؛ والمعلّقُ والمرفوضُ يبقى «حفظ الحضور» لهما (يمحوهما)
const canWrite = computed(() => !isReadOnly.value && (isTeacher.value || canApprove.value) && !locked.value && !dayIsFriday.value
  && !holiday.value && offDay.value?.status !== 'approved')
// الإجازة تُخفي القائمة إلا إن سُجّل فيها حضورٌ قبل تعيينها (يبقى قراءةً)، والبلاغُ يُخفيها عمّن لا يكتب
const showList = computed(() => (!holiday.value || held.value) && (!offDay.value || canWrite.value))
const canReview = computed(() => !isReadOnly.value && canReviewOffDayRole(role.value, currentHalaqa.value?.gender ?? null))
const enrolledIds = computed(() => enrolled.value.map(s => s.id))

// «حفظ الحضور» يسجّل اليومَ (فتنعقد الحلقة به) والغيابات معاً — متاحٌ ليومٍ لم يُسجَّل ولو بلا تعديل
const dirty = computed(() => isDirty(enrolledIds.value))
const canSave = computed(() => canWrite.value && enrolled.value.length > 0 && (!held.value || dirty.value))
const toast = useToast()
async function saveAttendance() {
  if (await save(enrolledIds.value)) toast.add({ title: 'حُفظ الحضور.', color: 'success', icon: 'i-lucide-circle-check' })
}
// يومٌ فيه بلاغٌ معلّق أو مرفوض: الحفظُ يمحو البلاغ (حارس القاعدة) فيُؤكَّد أولاً
const confirmSave = ref(false)
function requestSave() {
  if (saveWouldRemoveReport(offDay.value)) confirmSave.value = true
  else saveAttendance()
}
async function confirmedSave() {
  confirmSave.value = false
  await saveAttendance()
}
async function review(approve: boolean, note: string | null) {
  if (await reviewOffDay(approve, note)) {
    toast.add({ title: approve ? 'اعتُمد البلاغ.' : 'رُفض البلاغ.', color: 'success', icon: 'i-lucide-circle-check' })
  }
}

// تعديلٌ لم يُحفظ: تأكيدٌ قبل تبديل اليوم أو الحلقة أو مغادرة الشاشة
const { keepsEdits } = useUnsavedGuard(dirty, 'لديك تعديلٌ في الحضور لم يُحفظ — هل تتركه؟')
const dayModel = computed<string>({
  get: () => day.value,
  set: (v) => {
    if (!keepsEdits()) day.value = v
  }
})

// إلغاءُ يومٍ سُجّل خطأً — بعد تأكيد لأنّه يمحو غياباته
const confirmCancel = ref(false)
const cancelling = ref(false)
async function cancelDay() {
  cancelling.value = true
  await cancelHeldDay()
  cancelling.value = confirmCancel.value = false
}

const pending = computed(() => !role.value || halaqatPending.value || studentsLoading.value || loading.value)
</script>

<template>
  <div class="att">
    <UiPageHeader
      title="الحضور اليوميّ"
      subtitle="الجميعُ حاضرٌ افتراضاً — سجّل الغياباتِ وحدَها ثم «حفظ الحضور»."
    >
      <template
        v-if="isAdmin"
        #actions
      >
        <UButton
          label="أيام الإجازة"
          icon="i-lucide-calendar-heart"
          color="neutral"
          variant="outline"
          size="lg"
          to="/attendance/holidays"
          :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="role && !halaqatPending && !halaqat.length"
      icon="i-lucide-book-open"
      :title="isTeacher ? 'لا حلقة معيّنة لك' : 'لا حلقات في نطاقك'"
    />

    <template v-else>
      <AttendancePickCard
        v-model:halaqa="halaqaPick"
        v-model:day="dayModel"
        :fixed="isTeacher"
        :halaqa-name="halaqaName"
        :items="halaqaItems"
        :max="today"
      />

      <!-- يومَ الجمعة: عطلةٌ بلا رصد، والشاشةُ على الخميس قبلها -->
      <AttendanceFridayNotice
        v-if="fridayToday"
        :thursday-label="formatDay(schoolDayOnOrBefore(today))"
      />

      <div
        v-if="locked"
        class="locked"
      >
        <UBadge
          label="الشهر معتمَد"
          color="neutral"
          variant="soft"
          icon="i-lucide-lock"
          size="lg"
        />
        <span>رصدُ هذا الشهر معتمَد فلا تُعدَّل أيامُه — يُعيده المعتمِد إلى المسودّة أولاً.</span>
      </div>

      <div
        v-if="pending"
        class="stack"
        aria-busy="true"
      >
        <UiSkeletonRow
          v-for="i in 4"
          :key="i"
          :desc="false"
          :action="false"
        />
      </div>

      <UiEmptyState
        v-else-if="dayIsFriday"
        icon="i-lucide-calendar-off"
        title="الجمعة عطلة — لا يُسجَّل فيها حضور"
        description="اختر يوماً من السبت إلى الخميس."
      />

      <template v-else-if="halaqaId">
        <AttendanceHolidayBanner
          v-if="holiday"
          :reason="holiday"
          class="mb-4"
        />
        <AttendanceOffDayReviewPanel
          v-if="offDay"
          :day-label="formatDay(day)"
          :off="offDay"
          :can-review="canReview"
          :busy="reviewing"
          @review="review"
        />

        <!-- حالُ اليوم: الحلقةُ «انعقدت» إذا سُجّل حضورُها — لا زرَّ منفصلاً -->
        <AttendanceDayStateBar
          v-if="showList"
          :held="held"
          :can-write="canWrite"
          @cancel="confirmCancel = true"
        />

        <UiEmptyState
          v-if="showList && !enrolled.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون ملتحقون في هذا اليوم"
        />
        <UiEmptyState
          v-else-if="showList && !held && !canWrite"
          icon="i-lucide-calendar-x"
          title="لم تنعقد الحلقة في هذا اليوم"
        />
        <template v-else-if="showList">
          <AttendanceStudentList
            :students="enrolled"
            :draft="draft"
            :disabled="!canWrite"
            @set="setDraft"
          />
          <AttendanceSaveBar
            v-if="canWrite"
            :dirty="dirty"
            :held="held"
            :saving="saving"
            :can-save="canSave"
            @save="requestSave"
          />
        </template>
      </template>
    </template>

    <UiConfirmModal
      v-model:open="confirmCancel"
      title="إلغاء حضور هذا اليوم؟"
      message="يُعدّ اليومُ كأنّ الحلقةَ لم تنعقد فيه، وتُمحى الغياباتُ المسجّلة، ولا رجوع عن ذلك."
      confirm-label="إلغاء الحضور"
      :loading="cancelling"
      @confirm="cancelDay"
    />
    <UiConfirmModal
      v-model:open="confirmSave"
      title="حفظ الحضور يمحو البلاغ"
      message="لهذا اليوم بلاغُ «لم تنعقد الحلقة» لم يُعتمد. بحفظ الحضور يُحذف البلاغ ويُعدّ اليومُ يوماً انعقدت فيه الحلقة."
      confirm-label="احفظ الحضور وامحُ البلاغ"
      confirm-color="primary"
      confirm-icon="i-lucide-save"
      :loading="saving"
      @confirm="confirmedSave"
    />
  </div>
</template>

<style scoped>
.locked { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
</style>
