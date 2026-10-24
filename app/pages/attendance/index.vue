<script setup lang="ts">
/**
 * الحضور اليوميّ — غياباتُ اليوم ثم «حفظ الحضور».
 * المعلم حلقتُه تلقائياً، والمعتمِدون/المديران يختارون حلقة. الحضورُ هو الأصل: الجميع حاضرٌ افتراضاً،
 * وتُسجَّل الغياباتُ وحدَها (بعذر / بلا عذر) في مسوّدةٍ يكتبها «حفظ الحضور»؛ والحلقةُ «انعقدت» في اليوم إذا
 * سُجّل حضورُه — لا زرَّ منفصلاً (طلب المستخدم 2026-10-21). والتعديلُ غيرُ المحفوظ يُنبَّه إليه قبل المغادرة.
 * شهرٌ رصدُه معتمَد يُقفل (قراءة)، ومشرف المشروع قراءةٌ فقط. الحكمُ الأخير لـRLS وحارسَي القاعدة.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الحضور اليوميّ — ترجمان' })

type NameRow = { id: string, name: string }
type StudentRow = { id: string, full_name: string, enrollment_date: string | null }

const supabase = useSupabaseClient<Database>()
const { role, profile } = useProfile()
const { handle } = useErrorHandler()
const { isTeacher, canApprove, isReadOnly } = usePermissions()

const today = gazaToday()
// الجمعةُ عطلة (الدوامُ من السبت إلى الخميس — قرار المستخدم 2026-10-24): الشاشةُ تفتح يومَها على الخميس
// قبلها لإكمال حضوره، ولا يُرصَد فيها يوم؛ والحارسُ في القاعدة يرفضها كذلك
const fridayToday = isFriday(today)
const route = useRoute()
// ?d= من تفصيل يومٍ في «متابعة الرصد» — يومٌ صحيحٌ لا يتجاوز اليوم، وإلا اليوم (والجمعةُ ← الخميس)
const qd = typeof route.query.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.d) && route.query.d <= today ? route.query.d : null
const day = ref(schoolDayOnOrBefore(qd ?? today))
const dayIsFriday = computed(() => isFriday(day.value))
const halaqaId = ref<string | null>(typeof route.query.h === 'string' ? route.query.h : null)

// حلقة المعلم تلقائياً، وغيرُه يرى الحلقات التي تسمح له بها RLS
const { data: halaqat, pending: halaqatPending } = useLazyAsyncData<NameRow[]>('attendance-halaqat', async () => {
  if (!role.value) return []
  const query = supabase.from('halaqat').select('id, name').order('name')
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
const halaqaName = computed(() => halaqat.value.find(h => h.id === halaqaId.value)?.name ?? '')

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

const { held, draft, locked, loading, saving, load, setDraft, isDirty, save, cancelDay: cancelHeldDay } = useAttendanceDay(halaqaId, day)
watch([halaqaId, day], load, { immediate: true })

const canWrite = computed(() => !isReadOnly.value && (isTeacher.value || canApprove.value) && !locked.value && !dayIsFriday.value)
const enrolledIds = computed(() => enrolled.value.map(s => s.id))
const summary = computed(() => summarizeDay(enrolled.value, draft.value))
const summaryText = computed(() => `حضر ${summary.value.present} · بعذر ${summary.value.excused} · بلا عذر ${summary.value.unexcused}`)

// «حفظ الحضور» يسجّل اليومَ (فتنعقد الحلقة به) والغيابات معاً — متاحٌ ليومٍ لم يُسجَّل ولو بلا تعديل
const dirty = computed(() => isDirty(enrolledIds.value))
const canSave = computed(() => canWrite.value && enrolled.value.length > 0 && (!held.value || dirty.value))
const toast = useToast()
async function saveAttendance() {
  if (await save(enrolledIds.value)) toast.add({ title: 'حُفظ الحضور.', color: 'success', icon: 'i-lucide-circle-check' })
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
    />

    <UiEmptyState
      v-if="role && !halaqatPending && !halaqat.length"
      icon="i-lucide-book-open"
      :title="isTeacher ? 'لا حلقة معيّنة لك' : 'لا حلقات في نطاقك'"
    />

    <template v-else>
      <div class="card pick">
        <div
          v-if="!isTeacher"
          class="pf"
        >
          <label>الحلقة</label>
          <UiSelect
            v-model="halaqaPick"
            :items="halaqaItems"
            size="lg"
          />
        </div>
        <div
          v-else
          class="pf"
        >
          <label>الحلقة</label>
          <div class="halqa-auto">
            <UIcon
              name="i-lucide-book-open"
              class="size-5"
            />
            {{ halaqaName }}
          </div>
        </div>
        <div class="pf">
          <label>اليوم</label>
          <AttendanceDayPicker
            v-model="dayModel"
            :max="today"
          />
        </div>
      </div>

      <!-- يومَ الجمعة: عطلةٌ بلا رصد، والشاشةُ على الخميس قبلها -->
      <div
        v-if="fridayToday"
        class="holiday"
        role="status"
      >
        <UIcon
          name="i-lucide-calendar-off"
          class="size-6 shrink-0"
        />
        <div>
          <b>اليوم الجمعة — عطلةُ الحلقات</b>
          <span>لا يُسجَّل فيه حضور. يُعرض الخميس <bdi class="holiday-day">{{ formatDay(schoolDayOnOrBefore(today)) }}</bdi> لتُكمل حضوره إن لزم.</span>
        </div>
      </div>

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
        <!-- حالُ اليوم: الحلقةُ «انعقدت» إذا سُجّل حضورُها — لا زرَّ منفصلاً -->
        <div
          class="day-state"
          :class="{ on: held }"
        >
          <UIcon
            :name="held ? 'i-lucide-calendar-check' : 'i-lucide-calendar-clock'"
            class="size-5"
          />
          <span>{{ held ? 'سُجّل حضور هذا اليوم — عدّل ثم احفظ إن لزم.' : canWrite ? 'لم يُسجَّل حضور هذا اليوم بعد — الجميع حاضر افتراضاً، سجّل الغيابات ثم احفظ.' : 'لم يُسجَّل حضور هذا اليوم.' }}</span>
          <button
            v-if="held && canWrite"
            type="button"
            class="cancel-link"
            @click="confirmCancel = true"
          >
            إلغاء حضور هذا اليوم
          </button>
        </div>

        <UiEmptyState
          v-if="!enrolled.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون ملتحقون في هذا اليوم"
        />
        <UiEmptyState
          v-else-if="!held && !canWrite"
          icon="i-lucide-calendar-x"
          title="لم تنعقد الحلقة في هذا اليوم"
        />
        <template v-else>
          <p
            class="summary"
            aria-live="polite"
          >
            {{ summaryText }}
          </p>
          <ul class="card list">
            <li
              v-for="s in enrolled"
              :key="s.id"
              class="row"
            >
              <span class="name">{{ s.full_name }}</span>
              <AttendanceStatusSegment
                :model-value="draft[s.id] ?? 'present'"
                :name="s.full_name"
                :disabled="!canWrite"
                @update:model-value="setDraft(s.id, $event)"
              />
            </li>
          </ul>

          <div
            v-if="canWrite"
            class="save-bar"
            data-float-above
          >
            <span
              class="save-note"
              :class="{ warn: dirty }"
            >{{ dirty ? 'لديك تعديلٌ لم يُحفظ' : held ? 'كلُّ شيءٍ محفوظ' : 'لم يُحفظ بعد' }}</span>
            <UButton
              label="حفظ الحضور"
              icon="i-lucide-save"
              color="primary"
              size="lg"
              :loading="saving"
              :disabled="!canSave"
              :ui="{ base: 'min-h-12 rounded-xl font-semibold justify-center px-6' }"
              @click="saveAttendance"
            />
          </div>
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
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.pick { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.halqa-auto { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }

.locked { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.holiday { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; margin-bottom: 16px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--blue) 40%, transparent); background: var(--blue-soft); color: var(--blue-ink); line-height: 1.6; }
.holiday b { display: block; font-size: 15.5px; font-weight: 700; }
.holiday span { font-size: 14.5px; font-weight: 500; }
.holiday-day { white-space: nowrap; font-variant-numeric: tabular-nums; }

.day-state { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--blue-soft); color: var(--blue-ink); font-size: 14.5px; font-weight: 600; line-height: 1.6; }
.day-state.on { background: var(--green-soft); color: var(--green-ink); }
.day-state > span { flex: 1 1 220px; }
.cancel-link { border: none; background: none; padding: 0; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--err); text-decoration: underline; cursor: pointer; min-height: 44px; }

.save-bar { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 4px; padding: 12px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
.save-note { font-size: 14px; font-weight: 600; color: var(--ink-3); }
.save-note.warn { color: var(--err); }

.summary { margin: 0 4px 12px; font-size: 15px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.list { list-style: none; margin: 0; padding: 6px 20px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 10px 0; }
.row + .row { border-top: 1px solid var(--line); }
.name { font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }

@media (max-width: 520px) {
  .row { flex-direction: column; align-items: stretch; gap: 8px; }
  .save-bar :deep(button) { flex: 1 1 100%; }
}
</style>
