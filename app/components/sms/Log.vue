<script setup lang="ts">
/** سجلُّ رسائل SMS المرسلة (طلب المستخدم 2026-10-27): النصُّ والعددُ والمقاطعُ والنتيجةُ ومن أرسل ومتى. */
import type { SmsLogRow } from '~/composables/useSms'
import { deliveryDate } from '~/utils/booklets'

defineProps<{ rows: SmsLogRow[] }>()
</script>

<template>
  <UiEmptyState
    v-if="!rows.length"
    icon="i-lucide-message-square"
    title="لم تُرسَل رسائلُ بعد"
    description="ما تُرسله يظهر هنا بنتيجته."
  />
  <ul
    v-else
    class="lg"
  >
    <li
      v-for="r in rows"
      :key="r.id"
    >
      <div class="lg-top">
        <UBadge
          :label="r.ok ? 'أُرسلت' : 'تعثّرت'"
          :color="r.ok ? 'success' : 'error'"
          variant="soft"
        />
        <span class="meta">
          {{ r.recipients_count }} مستلم · {{ r.segments }} مقطع · {{ r.sender?.full_name ?? '—' }} ·
          <bdi dir="ltr">{{ deliveryDate(r.created_at) }}</bdi>
        </span>
      </div>
      <p class="body">
        {{ r.body }}
      </p>
      <p
        v-if="!r.ok"
        class="err"
      >
        {{ r.result || `الرمز ${r.code}` }}
      </p>
    </li>
  </ul>
</template>

<style scoped>
.lg { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.lg li { padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.lg-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.meta { font-size: 13px; color: var(--ink-3); }
.body { margin: 8px 0 0; color: var(--ink); white-space: pre-wrap; line-height: 1.7; }
.err { margin: 6px 0 0; color: var(--ui-error); font-size: 13px; }
</style>
