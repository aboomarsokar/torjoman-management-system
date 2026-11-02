<script setup lang="ts">
/**
 * نافذةُ ملاحظةٍ للمعلم على رصد الشهر: الإعادةُ مسوّدةً — للمُرسَل («إعادة بملاحظة») وللمعتمَد («إعادة فتح») —
 * والملاحظةُ فيها إلزامية؛ و«الاعتماد» (`approve`، 2026-11-02) بملاحظةٍ اختيارية للشكر أو التوجيه تبدأ بـ`initial`.
 * ≤ 500 حرف، ويراها المعلم في شريطٍ أعلى شاشته.
 */
import { NOTE_MAX } from '~/utils/quran/screen'

const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  /** نافذةُ الاعتماد: الملاحظةُ اختيارية وزرُّها أخضر. */
  approve?: boolean
  /** نصٌّ مبدئيّ (ملاحظةُ اعتمادٍ محفوظة). */
  initial?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [note: string] }>()

const note = ref('')
watch(open, (v) => {
  if (v) note.value = props.initial ?? ''
})
const trimmed = computed(() => note.value.trim())
const valid = computed(() => (props.approve || trimmed.value.length > 0) && trimmed.value.length <= NOTE_MAX)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="props.title"
    :description="props.description"
  >
    <template #body>
      <div class="rm">
        <UFormField
          :label="props.approve ? 'كلمة للمعلم (اختيارية)' : 'الملاحظة للمعلم'"
          :required="!props.approve"
          :hint="`${trimmed.length}/${NOTE_MAX}`"
        >
          <UTextarea
            v-model="note"
            :rows="4"
            :maxlength="NOTE_MAX"
            size="lg"
            class="w-full"
            :placeholder="props.approve ? 'شكرٌ أو توجيهٌ يراه المعلم مع الاعتماد' : 'ما الذي يحتاج تصحيحاً؟'"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <div class="actions">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            size="lg"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            :label="confirmLabel"
            :color="props.approve ? 'success' : 'warning'"
            size="lg"
            :icon="props.approve ? 'i-lucide-badge-check' : 'i-lucide-undo-2'"
            :disabled="!valid"
            :loading="loading"
            :ui="{ base: 'rounded-[13px] min-h-11 font-semibold' }"
            @click="emit('confirm', trimmed)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rm { display: flex; flex-direction: column; gap: 16px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
