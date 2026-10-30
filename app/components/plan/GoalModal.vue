<script setup lang="ts">
/** إضافةُ هدفٍ في خطة القسم أو تعديلُ عنوانه (للمدير الإداريّ). */
import { MAX_GOAL_TITLE } from '~/constants/deptPlan'

defineProps<{ editing: boolean, busy: boolean }>()
const emit = defineEmits<{ save: [] }>()
const open = defineModel<boolean>('open', { required: true })
const title = defineModel<string>('title', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'تعديل الهدف' : 'هدف جديد'"
  >
    <template #body>
      <UFormField
        label="الهدف"
        hint="اكتب الرقم في الهدف ليُقاس، مثل: تجهيز 100 سؤال لأربعة كتب"
      >
        <UTextarea
          v-model="title"
          :rows="2"
          autoresize
          class="w-full"
          :maxlength="MAX_GOAL_TITLE"
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
          label="احفظ"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('save')"
        />
      </div>
    </template>
  </UModal>
</template>
