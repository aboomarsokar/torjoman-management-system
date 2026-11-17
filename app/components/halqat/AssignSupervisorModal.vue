<script setup lang="ts">
/**
 * نافذةُ إسناد المشرفة لحلقة بنات — للمديرة الإدارية (طلب المستخدم 2026-11-17). المنطقُ في `useAssignSupervisor`.
 */
interface Props {
  halaqa: string
  items: { label: string, value: string }[]
  busy: boolean
}
defineProps<Props>()
const emit = defineEmits<{ save: [] }>()
const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<string>('selected', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`إسناد المشرفة — ${halaqa}`"
    description="تختارين المشرفةَ الميدانية لهذه الحلقة، أو «بلا مشرفة»."
  >
    <template #body>
      <UFormField label="المشرفة">
        <USelect
          v-model="selected"
          :items="items"
          class="w-full"
        />
      </UFormField>
    </template>
    <template #footer>
      <UButton
        label="حفظ"
        color="primary"
        size="lg"
        :loading="busy"
        :ui="{ base: 'min-h-11 rounded-[13px]' }"
        @click="emit('save')"
      />
    </template>
  </UModal>
</template>
