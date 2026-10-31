<script setup lang="ts">
/**
 * أزرارُ طلب الملازم عند المدير الإداريّ (طلب المستخدم 2026-10-31): محادثةُ المعلّم، و«إبلاغ بالاستلام» للجديد،
 * و«تسليم» و«إلغاء» لما لم يُسلَّم. `block` لبطاقة الجوال.
 */
import type { BookletRequest } from '~/composables/useBookletRequests'
import { isPendingRequest } from '~/utils/bookletRequests'

const props = defineProps<{ row: BookletRequest, busy: boolean, block?: boolean }>()
const emit = defineEmits<{ chat: [], ready: [], deliver: [], cancel: [] }>()

const pending = computed(() => isPendingRequest(props.row.status))
const ui = computed(() => ({ base: props.block ? 'rounded-[12px] min-h-11 font-semibold' : 'rounded-[11px] min-h-10 px-3 font-semibold' }))
</script>

<template>
  <div :class="block ? 'ra ra-block' : 'ra'">
    <UTooltip
      text="محادثة المعلّم"
      :disabled="block"
    >
      <UButton
        :label="block ? 'محادثة' : undefined"
        icon="i-lucide-message-circle"
        color="secondary"
        variant="soft"
        :block="block"
        :aria-label="`محادثة ${row.halaqa?.teacher?.full_name ?? 'المعلّم'}`"
        :ui="block ? ui : { base: 'rounded-[11px] min-h-10 min-w-10 justify-center' }"
        @click="emit('chat')"
      />
    </UTooltip>
    <UButton
      v-if="row.status === 'open'"
      label="إبلاغ بالاستلام"
      icon="i-lucide-bell-ring"
      color="info"
      variant="soft"
      :block="block"
      :loading="busy"
      :ui="ui"
      @click="emit('ready')"
    />
    <UButton
      v-if="pending"
      label="تسليم"
      icon="i-lucide-package-check"
      color="success"
      variant="solid"
      :block="block"
      :loading="busy"
      :ui="ui"
      @click="emit('deliver')"
    />
    <UTooltip
      v-if="pending"
      text="إلغاء الطلب"
      :disabled="block"
    >
      <UButton
        :label="block ? 'إلغاء' : undefined"
        icon="i-lucide-x"
        color="error"
        variant="ghost"
        :block="block"
        aria-label="إلغاء الطلب"
        :ui="block ? ui : { base: 'rounded-[11px] min-h-10 min-w-10 justify-center' }"
        @click="emit('cancel')"
      />
    </UTooltip>
  </div>
</template>

<style scoped>
.ra { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
.ra-block { width: 100%; flex-wrap: wrap; }
.ra-block > * { flex: 1 1 40%; }
</style>
