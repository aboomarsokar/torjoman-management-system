<script setup lang="ts">
/**
 * نافذةُ إعادة رصد الشهر إلى المعلم مسوّدةً — للمُرسَل («إعادة بملاحظة») وللمعتمَد («إعادة فتح»).
 * الملاحظةُ إلزاميةٌ (≤ 500 حرف) ويراها المعلم في شريطٍ أعلى شاشته؛ والقاعدةُ ترفض الإعادةَ بلا ملاحظة.
 */
import { NOTE_MAX } from '~/utils/quran/screen'

const props = defineProps<{ title: string, description: string, confirmLabel: string, loading?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [note: string] }>()

const note = ref('')
watch(open, (v) => {
  if (v) note.value = ''
})
const trimmed = computed(() => note.value.trim())
const valid = computed(() => trimmed.value.length > 0 && trimmed.value.length <= NOTE_MAX)
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
          label="الملاحظة للمعلم"
          required
          :hint="`${trimmed.length}/${NOTE_MAX}`"
        >
          <UTextarea
            v-model="note"
            :rows="4"
            :maxlength="NOTE_MAX"
            size="lg"
            class="w-full"
            placeholder="ما الذي يحتاج تصحيحاً؟"
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
            color="warning"
            size="lg"
            icon="i-lucide-undo-2"
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
