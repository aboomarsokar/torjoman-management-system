<script setup lang="ts">
/**
 * «تغيير الموعد» في لوحة المعلّم (طلب المستخدم 2026-10-25): المعلّمُ يغيّر موعدَ حلقته بنفسه عبر
 * `set_my_halaqa_time` — الدالّةُ تتحقّق أنّه معلّمُها وتُشعر المشرفَ والمديرَ الإداريّ والفنيّ (البنين)
 * أو المديرةَ الإدارية (البنات). والموعدُ بدايةُ الحلقة (والنهايةُ بعدها بساعتين في العرض).
 * والزرُّ «جديد» (إطارٌ ذهبيٌّ وتوهّجٌ ينبض ثلاثاً وسطرُ تعريف) حتى يضغطه المعلّمُ أوّلَ مرّة (`useFeatureSeen`).
 */
const props = defineProps<{ halaqaId: string, time: string | null, female?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const supabase = useSupabaseClient()
const { handle } = useErrorHandler()
const toast = useToast()
const open = ref(false)
const saving = ref(false)
const value = ref('')
const { isNew, markSeen } = useFeatureSeen('halaqa-time-edit')

function openModal() {
  markSeen()
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
  <div
    class="hte"
    :class="{ 'is-new': isNew }"
  >
    <UButton
      icon="i-lucide-clock"
      color="neutral"
      variant="outline"
      class="hte-btn"
      :ui="{ base: 'rounded-[12px] min-h-11' }"
      @click="openModal"
    >
      تغيير الموعد
      <span
        v-if="isNew"
        class="hte-new"
      ><UIcon
        name="i-lucide-sparkles"
        class="size-3.5"
      />جديد</span>
    </UButton>
    <p
      v-if="isNew"
      class="hte-hint"
    >
      صار بإمكانك تغيير موعد حلقتك بنفسك.
    </p>
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
.hte { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.hte-new { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; background: var(--side-new-bg); color: var(--side-new-ink); font-size: 12px; font-weight: 700; -webkit-text-stroke: .3px currentColor; }
.is-new :deep(.hte-btn) { border-color: var(--side-new-bg); box-shadow: 0 0 0 1.5px var(--side-new-bg) inset; animation: hte-glow 1.6s ease-in-out 3; }
.hte-hint { margin: 0; font-size: 13px; color: var(--ink-2); }
@keyframes hte-glow {
  0%, 100% { box-shadow: 0 0 0 1.5px var(--side-new-bg) inset, 0 0 0 0 color-mix(in srgb, var(--side-new-bg) 55%, transparent); }
  50% { box-shadow: 0 0 0 1.5px var(--side-new-bg) inset, 0 0 0 8px color-mix(in srgb, var(--side-new-bg) 0%, transparent), 0 0 18px 2px color-mix(in srgb, var(--side-new-bg) 45%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .is-new :deep(.hte-btn) { animation: none; }
}
@media (max-width: 560px) {
  .hte { align-items: stretch; }
}
</style>
