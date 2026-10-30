<script setup lang="ts">
/**
 * بطاقةُ اختيار الحلقة واليوم في «الحضور اليوميّ»: المعلّمُ يرى حلقتَه ثابتةً، وغيرُه يختار من قائمة. القيدُ على التبديل
 * (تعديلٌ لم يُحفظ) في الصفحة عبر اعتراض `v-model`، لا هنا.
 */
defineProps<{
  /** المعلّمُ: الحلقةُ ثابتةٌ باسمها لا قائمة. */
  fixed: boolean
  halaqaName: string
  items: { label: string, value: string }[]
  /** آخرُ يومٍ يُختار (اليوم). */
  max: string
}>()
const halaqa = defineModel<string>('halaqa', { required: true })
const day = defineModel<string>('day', { required: true })
</script>

<template>
  <div class="card pick">
    <div class="pf">
      <label>الحلقة</label>
      <div
        v-if="fixed"
        class="halqa-auto"
      >
        <UIcon
          name="i-lucide-book-open"
          class="size-5"
        />
        {{ halaqaName }}
      </div>
      <UiSelect
        v-else
        v-model="halaqa"
        :items="items"
        size="lg"
      />
    </div>
    <div class="pf">
      <label>اليوم</label>
      <AttendanceDayPicker
        v-model="day"
        :max="max"
      />
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.pick { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.halqa-auto { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 16px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }
</style>
