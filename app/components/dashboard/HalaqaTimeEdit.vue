<script setup lang="ts">
/**
 * «تغيير الموعد» في لوحة المعلّم (طلب المستخدم 2026-10-25): المعلّمُ يغيّر موعدَ حلقته بنفسه عبر
 * `set_my_halaqa_time` — الدالّةُ تتحقّق أنّه معلّمُها وتُشعر المشرفَ والمديرَ الإداريّ والفنيّ (البنين)
 * أو المديرةَ الإدارية (البنات). والموعدُ بدايةُ الحلقة (والنهايةُ بعدها بساعتين في العرض).
 * والزرُّ صغيرٌ بإطارٍ غامقٍ واضح بلا إبراز (طلب المستخدم 2026-10-26 — كان بإطارٍ ذهبيٍّ وشارة «جديد» وسطرِ تعريف).
 */
const props = defineProps<{ halaqaId: string, time: string | null, female?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const supabase = useSupabaseClient()
const { handle } = useErrorHandler()
const toast = useToast()
const open = ref(false)
const saving = ref(false)
const value = ref('')

function openModal() {
  value.value = props.time?.slice(0, 5) ?? ''
  open.value = true
}
async function save() {
  if (!value.value) return
  saving.value = true
  try {
    const { error } = await supabase.rpc('set_my_halaqa_time', { p_halaqa: props.halaqaId, p_time: value.value })
    if (error) throw error
    toast.add({ title: 'تغيّر موعدُ الحلقة، وأُشعرت الإدارة.', color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
    emit('changed')
  } catch (err) {
    handle(err, 'تعذّر تغييرُ الموعد.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="hte">
    <UButton
      label="تغيير الموعد"
      icon="i-lucide-clock"
      color="neutral"
      variant="outline"
      size="sm"
      class="hte-btn"
      :ui="{ base: 'rounded-[10px] min-h-10 px-3 text-[13px] font-semibold', leadingIcon: 'size-4' }"
      @click="openModal"
    />
    <UModal
      v-model:open="open"
      title="تغيير موعد الحلقة"
      :description="`يُشعَر ${female ? 'مشرفتُك' : 'مشرفُك'} والإدارةُ بالموعد الجديد.`"
    >
      <template #body>
        <UFormField label="بداية الحلقة">
          <UInput
            v-model="value"
            type="time"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[12px] min-h-12' }"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            :ui="{ base: 'rounded-[12px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            label="حفظ الموعد"
            icon="i-lucide-check"
            color="primary"
            :loading="saving"
            :disabled="!value || value === time?.slice(0, 5)"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.hte { display: flex; }
.hte :deep(.hte-btn) { border: 1.5px solid var(--navy); color: var(--navy); background: transparent; box-shadow: none; }
.hte :deep(.hte-btn:hover) { background: var(--blue-soft); }
/* في الليليّ الكحليُّ يذوب في الخلفية */
:global(.dark) .hte :deep(.hte-btn) { border-color: var(--blue); color: var(--blue); }
</style>
