<script setup lang="ts">
/**
 * الحضور اليوميّ — يومُ الحلقة وغياباتُها بضغطة.
 * المعلم حلقتُه تلقائياً، والمعتمِدون/المديران يختارون حلقة. الحضورُ هو الأصل: تفتح «انعقدت الحلقة»
 * فيصير الجميع حاضراً، وتسجّل الغياباتِ وحدَها (بعذر / بلا عذر) والحفظُ فوريّ.
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
const day = ref(today)
const halaqaId = ref<string | null>(null)

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
  if (!list.some(h => h.id === halaqaId.value)) halaqaId.value = list[0]?.id ?? null
}, { immediate: true })

// UiSelect لا يقبل null: الحلقةُ الفارغة نصٌّ فارغ في المحدِّد
const halaqaPick = computed<string>({
  get: () => halaqaId.value ?? '',
  set: (v) => { halaqaId.value = v || null }
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

const { held, absences, locked, loading, load, setHeld, setAbsence } = useAttendanceDay(halaqaId, day)
watch([halaqaId, day], load, { immediate: true })

const canWrite = computed(() => !isReadOnly.value && (isTeacher.value || canApprove.value) && !locked.value)
const summary = computed(() => summarizeDay(enrolled.value, absences.value))
const summaryText = computed(() => `حضر ${summary.value.present} · بعذر ${summary.value.excused} · بلا عذر ${summary.value.unexcused}`)

// فتحُ اليوم فوريّ، أمّا إلغاؤه فبعد تأكيد لأنّه يمحو غياباته
const confirmCancel = ref(false)
const cancelling = ref(false)
const heldModel = computed({
  get: () => held.value,
  set: (on: boolean) => {
    if (on) setHeld(true)
    else confirmCancel.value = true
  }
})
async function cancelDay() {
  cancelling.value = true
  await setHeld(false)
  cancelling.value = false
  confirmCancel.value = false
}

const pending = computed(() => !role.value || halaqatPending.value || studentsLoading.value || loading.value)
</script>

<template>
  <div class="att">
    <UiPageHeader
      title="الحضور اليوميّ"
      subtitle="افتح يومَ الحلقة فيصير الجميعُ حاضراً، ثم سجّل الغياباتِ وحدَها."
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
        <div class="pf fit">
          <label>اليوم</label>
          <AttendanceDayPicker
            v-model="day"
            :max="today"
          />
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

      <template v-else-if="halaqaId">
        <div class="card held">
          <div class="held-text">
            <strong>انعقدت الحلقة في هذا اليوم</strong>
            <span class="muted">{{ held ? 'الجميع حاضر ما لم يُسجَّل غيابه.' : 'اليومُ غيرُ مفتوح — لا حضور ولا غياب فيه.' }}</span>
          </div>
          <USwitch
            v-model="heldModel"
            size="lg"
            aria-label="انعقدت الحلقة في هذا اليوم"
            :disabled="!canWrite"
          />
        </div>

        <UiEmptyState
          v-if="!held"
          icon="i-lucide-calendar-x"
          title="لم تنعقد الحلقة في هذا اليوم"
          :description="canWrite ? 'فعّل «انعقدت الحلقة» لتسجيل الحضور والغياب.' : undefined"
        />
        <UiEmptyState
          v-else-if="!enrolled.length"
          icon="i-lucide-users"
          title="لا طلاب نشطون ملتحقون في هذا اليوم"
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
                :model-value="absences[s.id] ?? 'present'"
                :name="s.full_name"
                :disabled="!canWrite"
                @update:model-value="setAbsence(s.id, $event)"
              />
            </li>
          </ul>
        </template>
      </template>
    </template>

    <UiConfirmModal
      v-model:open="confirmCancel"
      title="إلغاء يوم الحلقة؟"
      message="سيُحذف هذا اليومُ وتُمحى الغياباتُ المسجّلة فيه، ولا رجوع عن ذلك."
      confirm-label="إلغاء اليوم"
      :loading="cancelling"
      @confirm="cancelDay"
    />
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.pick { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
.pf.fit { flex: 0 0 auto; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.halqa-auto { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }

.locked { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }

.held { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.held-text { display: flex; flex-direction: column; gap: 4px; font-size: 16px; color: var(--ink); }
.muted { font-size: 14px; font-weight: 300; color: var(--ink-2); }

.summary { margin: 0 4px 12px; font-size: 15px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.list { list-style: none; margin: 0; padding: 6px 20px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 10px 0; }
.row + .row { border-top: 1px solid var(--line); }
.name { font-size: 15.5px; font-weight: 600; color: var(--ink); min-width: 0; }

@media (max-width: 520px) { .row { flex-direction: column; align-items: stretch; gap: 8px; } }
</style>
