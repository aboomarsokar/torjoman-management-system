<script setup lang="ts">
/**
 * شريطُ أرقامٍ عامّة في رأس الشاشة (طلب المستخدم 2026-10-21: «في كلّ تبويب أرقامُ إحصائيات عامة بحسب عنوانه»).
 * بطاقاتُ `UiStatCard` مكدّسة في شبكةٍ تتكيّف: أربعٌ في الصفّ على الحاسوب واثنتان على الجوال.
 * الأرقامُ تُحسب في الشاشة من بياناتها المحمّلة (فتتبع نطاقَ RLS وتصفيتَها) — المكوّنُ للعرض وحده.
 */
export interface StatItem {
  key: string
  icon: string
  value: string | number
  label: string
  /** سطرٌ ثانٍ بخطٍّ أصغر وأرقامٍ بارزة (مثل «67٪ من المحسوم»). */
  sub?: string
  tone?: 'blue' | 'green' | 'neutral' | 'err'
}

defineProps<{ items: StatItem[], label?: string }>()
</script>

<template>
  <section
    class="strip"
    :class="`n-${Math.min(items.length, 4)}`"
    :aria-label="label ?? 'أرقامٌ عامّة'"
  >
    <UiStatCard
      v-for="s in items"
      :key="s.key"
      :icon="s.icon"
      :tone="s.tone ?? 'blue'"
      :value="s.value"
      :label="s.label"
      :sub="s.sub"
      stacked
    />
  </section>
</template>

<style scoped>
.strip { display: grid; gap: 14px; margin-bottom: 16px; }
.strip.n-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.strip.n-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.strip.n-2, .strip.n-1 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 900px) {
  .strip.n-4, .strip.n-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
}
</style>
