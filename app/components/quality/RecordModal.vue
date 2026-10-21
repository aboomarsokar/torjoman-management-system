<script setup lang="ts">
/**
 * نافذةُ سجلّ تقييم الجودة الشهريّ لمعلّمٍ (قرارات المستخدم 2026-10-21):
 * - **مشرفُ الحلقة** يرى الأرقام الحيّة (`quality_month_preview`)، ويكتب درجة الاجتماعات (0–8) وملاحظاته،
 *   و«حفظ وإقفال» (`save_quality_month`) يثبّت الأرقام ويُقفل ويُشعر المعلم — ابتداءً من يوم الفتح + 4.
 * - **المدير الإداري والفنيّ** يفتحان المقفل (`unlock_quality_month`)، و**الفنيّ** يكتب «ملاحظات الإدارة» (`set_quality_admin_notes`).
 * - **المعلم** يرى سجلّه المقفل ويُقرّ بالاطّلاع (`acknowledge_quality_month`).
 */
import type { Database } from '~/types/database.types'
import type { QualityHalaqa, QualityNumbers, QualityRow } from '~/utils/qualityRecord'
import { MEETINGS_MAX, QUALITY_STATE_META, parseNumbers, qualityState } from '~/utils/qualityRecord'

const props = defineProps<{ halaqa: QualityHalaqa | null, year: number, month: number, record: QualityRow | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
const { profile } = useProfile()
const { isAdmin, isTechnical, isTeacher, isFieldSupervisor } = usePermissions()

// أسماءُ المعايير الستّة من بنود النموذج (مُخبّأةٌ مع نافذة الزيارة)
const { data: items } = useLazyAsyncData('visit-deduction-items', async () => {
  const { data, error } = await supabase.from('visit_deduction_items')
    .select('key, criterion, criterion_label, criterion_hint, label, per_time, sort_order').order('sort_order')
  if (error) handle(error)
  return data ?? []
}, { server: false, default: () => [] })
const criteria = computed(() => {
  const m = new Map<number, string>()
  for (const i of items.value ?? []) if (!m.has(i.criterion)) m.set(i.criterion, i.criterion_label)
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l)
})

const preview = ref<QualityNumbers | null>(null)
const loading = ref(false)
const busy = ref(false)
const printing = ref(false)
const meetings = ref(MEETINGS_MAX)
const supNotes = ref('')
const adminNotes = ref('')

const state = computed(() => qualityState(props.record))
const locked = computed(() => !!props.record?.locked_at)
const isSupervisorHere = computed(() => isFieldSupervisor.value && !!props.halaqa && props.halaqa.supervisor_id === profile.value?.id)
const canSave = computed(() => isSupervisorHere.value && !locked.value)
const opensOn = computed(() => preview.value?.opens_on ?? null)
const notOpenYet = computed(() => !!opensOn.value && gazaToday() < opensOn.value)
/** الأرقامُ المعروضة: المثبّتةُ إن أُقفل السجلّ، وإلا الحيّة. */
const numbers = computed<QualityNumbers | null>(() => locked.value ? parseNumbers(props.record?.numbers) : preview.value)
const shownMeetings = computed(() => locked.value ? (props.record?.meetings_score ?? 0) : meetings.value)

watch([open, () => props.halaqa?.id, () => props.record?.id, () => props.record?.locked_at], async ([isOpen]) => {
  const h = props.halaqa
  if (!isOpen || !h) return
  meetings.value = props.record?.meetings_score ?? MEETINGS_MAX
  supNotes.value = props.record?.supervisor_notes ?? ''
  adminNotes.value = props.record?.admin_notes ?? ''
  preview.value = null
  if (locked.value) return
  // المعلمُ لا يرى إلا المحفوظ؛ وغيرُه يعاين الأرقام الحيّة
  if (isTeacher.value) return
  loading.value = true
  const { data, error } = await supabase.rpc('quality_month_preview', { p_halaqa: h.id, p_year: props.year, p_month: props.month })
  loading.value = false
  if (error) handle(error)
  else preview.value = parseNumbers(data)
}, { immediate: true })

async function run(fn: () => PromiseLike<{ error: unknown }>, done: string, close = true) {
  busy.value = true
  try {
    const { error } = await fn()
    if (error) throw error
    toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
    if (close) open.value = false
    emit('changed')
  } catch (err) {
    handle(err)
  } finally {
    busy.value = false
  }
}

const save = () => run(() => supabase.rpc('save_quality_month', {
  p_halaqa: props.halaqa!.id, p_year: props.year, p_month: props.month, p_meetings: meetings.value, p_notes: supNotes.value
}), 'حُفظ السجلّ وأُقفل — وصل المعلمَ إشعار.')
const unlock = () => run(() => supabase.rpc('unlock_quality_month', { p_id: props.record!.id }), 'فُتح السجلّ للتعديل — وصل المشرفَ إشعار.')
const ack = () => run(() => supabase.rpc('acknowledge_quality_month', { p_id: props.record!.id }), 'سُجّل اطّلاعك على سجلّك الشهريّ.')
const saveAdminNotes = () => run(() => supabase.rpc('set_quality_admin_notes', { p_id: props.record!.id, p_notes: adminNotes.value }), 'حُفظت ملاحظات الإدارة.', false)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`سجلّ تقييم الجودة — ${halaqa?.teacher?.full_name ?? 'بلا معلّم'}`"
    :description="`${halaqa?.name ?? ''} · الشهر ${String(month).padStart(2, '0')}-${year} · المشرف ${halaqa?.supervisor?.full_name ?? '—'}`"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div class="qr">
        <div class="qr-state">
          <UBadge
            :label="QUALITY_STATE_META[state].label"
            :color="QUALITY_STATE_META[state].color"
            variant="soft"
            size="lg"
          />
          <span
            v-if="!locked && numbers"
            class="qr-live"
          >معاينةٌ بالأرقام الحاليّة — تُثبَّت عند الحفظ</span>
        </div>

        <div
          v-if="loading"
          class="qr-empty"
        >
          جارٍ حساب الأرقام…
        </div>
        <p
          v-else-if="!numbers"
          class="qr-empty"
        >
          {{ isTeacher ? 'لم يرصد المشرف سجلّ هذا الشهر بعد.' : 'تعذّر حساب الأرقام.' }}
        </p>
        <QualitySheet
          v-else
          :numbers="numbers"
          :criteria="criteria"
          :meetings="shownMeetings"
        />

        <!-- مدخلاتُ المشرف -->
        <div
          v-if="canSave"
          class="qr-inputs"
        >
          <UFormField
            label="حضور الاجتماعات الدورية"
            :hint="`من 0 إلى ${MEETINGS_MAX}`"
          >
            <UInputNumber
              v-model="meetings"
              :min="0"
              :max="MEETINGS_MAX"
              size="lg"
              class="w-40"
            />
          </UFormField>
          <UFormField label="ملاحظات المشرف">
            <UTextarea
              v-model="supNotes"
              autoresize
              :rows="3"
              :maxrows="10"
              :maxlength="2000"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] leading-[1.9]' }"
            />
          </UFormField>
        </div>
        <section
          v-else-if="record?.supervisor_notes"
          class="qr-notes"
        >
          <h4>ملاحظات المشرف</h4>
          <p>{{ record.supervisor_notes }}</p>
        </section>

        <!-- ملاحظاتُ الإدارة: يكتبها المدير الفنيّ، ويراها الجميع -->
        <section
          v-if="record && isTechnical"
          class="qr-inputs"
        >
          <UFormField label="ملاحظات الإدارة">
            <UTextarea
              v-model="adminNotes"
              autoresize
              :rows="3"
              :maxrows="10"
              :maxlength="2000"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px] leading-[1.9]' }"
            />
          </UFormField>
          <div class="qr-row-end">
            <UButton
              label="حفظ ملاحظات الإدارة"
              color="neutral"
              variant="outline"
              icon="i-lucide-save"
              :loading="busy"
              :ui="{ base: 'rounded-[12px]' }"
              @click="saveAdminNotes"
            />
          </div>
        </section>
        <section
          v-else-if="record?.admin_notes"
          class="qr-notes"
        >
          <h4>ملاحظات الإدارة</h4>
          <p>{{ record.admin_notes }}</p>
        </section>

        <p
          v-if="canSave && notOpenYet"
          class="qr-warn"
        >
          يُرصد سجلّ هذا الشهر ابتداءً من {{ opensOn!.split('-').reverse().join('-') }} — بعد مهلة تسليم التقارير.
        </p>

        <div class="qr-actions">
          <UButton
            label="إغلاق"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="open = false"
          />
          <!-- التنزيلُ لكلّ من يرى السجلّ، بعد إقفاله (أرقامُه قبلها معاينةٌ تتغيّر) -->
          <UButton
            v-if="locked"
            label="تنزيل PDF"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-file-down"
            :ui="{ base: 'rounded-[13px]' }"
            @click="printing = true"
          />
          <UButton
            v-if="locked && (isAdmin || isTechnical)"
            label="فتح التعديل للمشرف"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-lock-open"
            :loading="busy"
            :ui="{ base: 'rounded-[13px]' }"
            @click="unlock"
          />
          <UButton
            v-if="locked && isTeacher && !record?.teacher_ack_at"
            label="اطّلعت وأقرّ"
            color="primary"
            size="lg"
            icon="i-lucide-check-check"
            :loading="busy"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="ack"
          />
          <UButton
            v-if="canSave"
            label="حفظ وإقفال"
            color="primary"
            size="lg"
            icon="i-lucide-lock"
            :loading="busy"
            :disabled="!numbers || notOpenYet"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>

  <QualityPrintSheet
    :active="printing"
    :halaqa="halaqa"
    :record="record"
    :criteria="criteria"
    :year="year"
    :month="month"
    @done="printing = false"
  />
</template>

<style scoped>
.qr { display: flex; flex-direction: column; gap: 14px; }
.qr-state { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.qr-live { font-size: 12.5px; color: var(--ink-3); }
.qr-empty { margin: 0; padding: 22px; border-radius: 13px; background: var(--surface-2); color: var(--ink-2); text-align: center; font-size: 14px; }
.qr-inputs { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 14px; background: var(--surface-2); }
.qr-row-end { display: flex; justify-content: flex-end; }
.qr-notes { padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); }
.qr-notes h4 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: var(--ink); }
.qr-notes p { margin: 0; font-size: 14.5px; line-height: 1.9; color: var(--ink); white-space: pre-wrap; }
.qr-warn { margin: 0; padding: 10px 14px; border-radius: 13px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 13.5px; font-weight: 600; }
.qr-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
</style>
