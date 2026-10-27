<script setup lang="ts">
/**
 * شريطُ حالة الرفع في شاشة حضور المعلّم بلا إنترنت (طلب المستخدم 2026-10-26 — نمطُ الصحابة): أيقونةُ الاتصال، وسطرٌ
 * يقول ما ينتظر الرفعَ **بعدده** وإلا نضارةَ البيانات، وعدّادٌ بارزٌ لِما على الجهاز، وشارةُ «جاهزٌ للعمل بلا اتصال»
 * حين تصير الشاشةُ في خبيئة عامل الخدمة حقّاً. و«أعد المحاولة الآن» بعد تعثّرٍ وحدَه — الرفعُ تلقائيّ، وزرٌّ دائمٌ
 * يعلّم المعلّمَ أنّه يحتاجه. سطرٌ رفيعٌ لا بطاقة (طلب المستخدم 2026-10-26: «صفحة المعلم تكون بسيطة»).
 */
import type { Readiness } from '~/composables/useOfflineReadiness'

defineProps<{ text: string, online: boolean, pending: number, syncing: boolean, retrying: boolean, readiness: Readiness }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section
    class="ss"
    role="status"
    aria-live="polite"
  >
    <span
      class="ss-ico"
      :class="online ? 'on' : 'off'"
    >
      <UIcon
        :name="online ? 'i-lucide-wifi' : 'i-lucide-wifi-off'"
        class="size-4"
      />
    </span>
    <p class="ss-text">
      {{ text }}
    </p>
    <span
      v-if="pending"
      class="ss-count"
      :aria-label="`${pending} بانتظار الرفع`"
    >
      <UIcon
        :name="syncing ? 'i-lucide-loader-circle' : 'i-lucide-cloud-upload'"
        class="size-4"
        :class="{ 'animate-spin': syncing }"
      />
      <b>{{ pending }}</b> بانتظار الرفع
    </span>
    <UButton
      v-if="online && retrying && !syncing"
      label="أعد المحاولة الآن"
      icon="i-lucide-rotate-cw"
      color="neutral"
      variant="soft"
      size="sm"
      :ui="{ base: 'rounded-[10px] min-h-11' }"
      @click="emit('retry')"
    />
    <span
      v-else-if="readiness === 'ready' && !pending"
      class="ss-ready"
    >
      <UIcon
        name="i-lucide-cloud-check"
        class="size-4"
      />جاهزٌ للعمل بلا اتصال
    </span>
    <span
      v-else-if="readiness === 'preparing'"
      class="ss-prep"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-4 animate-spin"
      />يُجهَّز للعمل بلا اتصال…
    </span>
  </section>
</template>

<style scoped>
.ss { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); }
.ss-ico { width: 28px; height: 28px; border-radius: 9px; flex: none; display: inline-flex; align-items: center; justify-content: center; }
.ss-ico.on { background: var(--green-soft); color: var(--green-ink); }
.ss-ico.off { background: var(--chip-warn-bg); color: var(--chip-warn-ink); }
.ss-text { flex: 1 1 180px; margin: 0; font-size: 13.5px; font-weight: 500; color: var(--ink-2); line-height: 1.5; }
.ss-count { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13px; font-weight: 600; }
.ss-count b { font-size: 15px; font-variant-numeric: tabular-nums; }
.ss-ready, .ss-prep { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.ss-ready { background: var(--green-soft); color: var(--green-ink); }
.ss-prep { background: var(--blue-soft); color: var(--blue-ink); }
</style>
