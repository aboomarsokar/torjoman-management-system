<script setup lang="ts">
/**
 * «تغيير الموعد» في لوحة المعلّم (طلب المستخدم 2026-10-25): المعلّمُ يغيّر موعدَ حلقته بنفسه عبر
 * `set_my_halaqa_time` — الدالّةُ تتحقّق أنّه معلّمُها وتُشعر المشرفَ والمديرَ الإداريّ والفنيّ (البنين)
 * أو المديرةَ الإدارية (البنات). والموعدُ بدايةُ الحلقة (والنهايةُ بعدها بساعتين في العرض).
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
  <UButton
    label="تغيير الموعد"
    icon="i-lucide-clock"
    color="neutral"
    variant="outline"
    :ui="{ base: 'rounded-[12px] min-h-11' }"
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
</template>
