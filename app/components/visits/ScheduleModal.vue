<script setup lang="ts">
/**
 * جدولةُ زيارةٍ جديدة أو تعديلُ موعدِ زيارةٍ قائمة (المشرف الميداني صاحبها).
 * الزائرُ = من يجدول، يُسجَّل باسمه تلقائياً (قرار 2026-10-19). وتعديلُ الموعد يحتاج سبباً إلزامياً
 * يُحفظ في سجلٍّ تراه الإدارة — عبر `reschedule_visit` (السجلّ ثم الموعد في معاملةٍ واحدة)،
 * والقاعدةُ ترفض أيَّ تغييرٍ للموعد بلا سجلّه. ولا تعديلَ لموعد زيارةٍ نُفّذت.
 */
import type { Database } from '~/types/database.types'
import type { VisitHalqaOption, VisitRow } from '~/types/visits'

interface Props {
  open: boolean
  /** الزيارةُ المُعدَّل موعدُها؛ `null` = جدولةٌ جديدة. */
  visit: VisitRow | null
  halqat: VisitHalqaOption[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [boolean], 'saved': [] }>()

const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const MIN_REASON_LENGTH = 3
const form = reactive({ halaqa_id: '', scheduled_at: '', reason: '' })
const saving = ref(false)
const isEdit = computed(() => !!props.visit)

watch(() => props.open, (open) => {
  if (!open) return
  form.halaqa_id = props.visit?.halaqa_id ?? ''
  form.scheduled_at = props.visit?.scheduled_at ? splitLocal(props.visit.scheduled_at) : ''
  form.reason = ''
})

/** لحظةٌ مخزّنة ← `YYYY-MM-DDTHH:mm` بالتوقيت المحلّي لحقل التاريخ والوقت. */
function splitLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const halqaItems = computed(() => props.halqat.map(h => ({
  label: h.teacher?.full_name ? `${h.name} — ${h.teacher.full_name}` : h.name,
  value: h.id
})))
const selectedHalqaTime = computed(() => {
  const h = props.halqat.find(x => x.id === form.halaqa_id)
  return formatTime12(h?.daily_time)
})
const visitorName = computed(() => (isEdit.value ? props.visit?.supervisor?.full_name : profile.value?.full_name) ?? '')

function validate(s: typeof form) {
  const e: { name: string, message: string }[] = []
  if (!isEdit.value && !s.halaqa_id) e.push({ name: 'halaqa_id', message: 'اختر الحلقة.' })
  if (!s.scheduled_at) e.push({ name: 'scheduled_at', message: 'حدّد اليوم والوقت.' })
  if (isEdit.value && s.reason.trim().length < MIN_REASON_LENGTH) e.push({ name: 'reason', message: 'اكتب سبب تغيير الموعد.' })
  return e
}

async function save() {
  saving.value = true
  try {
    const when = new Date(form.scheduled_at).toISOString()
    if (props.visit) {
      const { error } = await supabase.rpc('reschedule_visit', { p_visit: props.visit.id, p_new_time: when, p_reason: form.reason.trim() })
      if (error) throw error
    } else {
      const { error } = await supabase.from('supervision_visits')
        .insert({ halaqa_id: form.halaqa_id, scheduled_at: when, supervisor_id: profile.value?.id ?? '' })
      if (error) throw error
    }
    toast.add({ title: props.visit ? 'تم تغيير موعد الزيارة وحُفظ السبب.' : 'تمت جدولة الزيارة.', color: 'success', icon: 'i-lucide-calendar-check' })
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'تعديل موعد الزيارة' : 'جدولة زيارة'"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <UForm
        :state="form"
        :validate="validate"
        class="form"
        @submit="save"
      >
        <UFormField
          v-if="!isEdit"
          label="الحلقة"
          name="halaqa_id"
          :hint="selectedHalqaTime ? `وقت الحلقة اليومي: ${selectedHalqaTime}` : ''"
        >
          <UiSelect
            v-model="form.halaqa_id"
            :items="halqaItems"
            placeholder="اختر الحلقة"
            size="lg"
          />
        </UFormField>
        <div
          v-else
          class="info-line"
        >
          <UIcon
            name="i-lucide-book-open"
            class="size-[18px]"
          />
          <span>الحلقة: <strong>{{ visit?.halaqa?.name || '—' }}</strong></span>
        </div>
        <div class="info-line">
          <UIcon
            name="i-lucide-user-check"
            class="size-[18px]"
          />
          <span>الزائر: <strong>{{ visitorName || '—' }}</strong></span>
          <span
            v-if="!isEdit"
            class="note"
          >يُسجَّل باسمك تلقائياً</span>
        </div>
        <UFormField
          :label="isEdit ? 'الموعد الجديد' : 'موعد الزيارة'"
          name="scheduled_at"
        >
          <UiDateTimeField
            v-model="form.scheduled_at"
            :suggested-time="selectedHalqaTime || null"
          />
        </UFormField>
        <UFormField
          v-if="isEdit"
          label="سبب تغيير الموعد"
          name="reason"
          help="يظهر للإدارة في سجلّ الزيارة."
        >
          <UTextarea
            v-model="form.reason"
            :rows="2"
            size="lg"
            class="w-full"
            placeholder="مثال: اختبارٌ مفاجئ في المدرسة يوم الموعد"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <div class="form-actions">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            size="lg"
            :ui="{ base: 'rounded-[13px]' }"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            :label="isEdit ? 'حفظ الموعد' : 'جدولة'"
            color="primary"
            size="lg"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.info-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 14px; border-radius: 13px; background: var(--surface-2); color: var(--ink-2); font-size: 14.5px; }
.info-line strong { color: var(--ink); font-weight: 600; }
.note { margin-inline-start: auto; font-size: 12.5px; color: var(--ink-3); }
</style>
