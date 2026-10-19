<script setup lang="ts">
/**
 * رأسُ شاشة الإنجاز القرآني: الحلقةُ (ثابتةٌ للمعلم، ومنتقًى لغيره مع زرٍّ يعود إلى قائمة الحلقات)،
 * والشهرُ بالأرقام (`QuranMonthPicker`)، وسطرُ يوم الفتح «الشهر MM يُرصَد ابتداءً من DD-MM-YYYY»،
 * والبحثُ باسم الطالب (يظهر متى اختيرت حلقة).
 */
const props = defineProps<{
  isTeacher: boolean
  halaqaName: string
  halaqaItems: { label: string, value: string }[]
  /** شهرُ اليوم بتوقيت غزة (لا شهرَ بعده). */
  max: { year: number, month: number }
}>()
const halaqaId = defineModel<string | null>('halaqa', { required: true })
const year = defineModel<number>('year', { required: true })
const month = defineModel<number>('month', { required: true })
const query = defineModel<string>('query', { required: true })

// UiSelect لا يقبل null: الحلقةُ الفارغة نصٌّ فارغ
const pick = computed<string>({
  get: () => halaqaId.value ?? '',
  set: (v) => { halaqaId.value = v || null }
})
const windowText = computed(() =>
  `الشهر ${String(month.value).padStart(2, '0')} يُرصَد ابتداءً من ${formatDay(openingDay(year.value, month.value))}`)
</script>

<template>
  <div class="card pick">
    <div class="pf">
      <label>الحلقة</label>
      <div
        v-if="props.isTeacher"
        class="halqa-auto"
      >
        <UIcon
          name="i-lucide-book-open"
          class="size-5"
        />{{ halaqaName }}
      </div>
      <div
        v-else
        class="row-pick"
      >
        <UiSelect
          v-model="pick"
          :items="halaqaItems"
          placeholder="كلّ الحلقات"
          size="lg"
        />
        <UButton
          v-if="halaqaId"
          icon="i-lucide-list"
          color="neutral"
          variant="ghost"
          size="lg"
          aria-label="العودة إلى قائمة الحلقات"
          class="tap"
          @click="halaqaId = null"
        />
      </div>
    </div>
    <div class="pf fit">
      <label>الشهر</label>
      <QuranMonthPicker
        v-model:year="year"
        v-model:month="month"
        :max="max"
      />
    </div>
    <p class="window">
      {{ windowText }} — في آخر يومٍ منه، والخميسَ إن كان آخرُه جمعة.
    </p>
    <div
      v-if="halaqaId"
      class="pf wide"
    >
      <label>الطالب</label>
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="ابحث باسم الطالب…"
        size="lg"
        class="w-full"
        :ui="{ base: 'rounded-[13px]' }"
      />
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.pick { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pf { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
.pf.fit { flex: 0 0 auto; }
.pf.wide { flex-basis: 100%; }
.pf label { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.row-pick { display: flex; gap: 8px; }
.tap { min-width: 48px; min-height: 48px; justify-content: center; }
.halqa-auto { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 0 16px; border-radius: var(--r-control); background: var(--surface-2); border: 1px solid var(--line); font-size: 15.5px; font-weight: 600; color: var(--ink); }
.window { flex-basis: 100%; margin: 0; font-size: 13.5px; color: var(--ink-2); }
</style>
