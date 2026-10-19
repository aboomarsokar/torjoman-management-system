<script setup lang="ts">
/**
 * سجلُّ شهور الطالب المعتمَدة (للقراءة فقط): «وصل N من 30 جزءاً» وتحتها سطرُ كلّ شهرٍ
 * «MM-YYYY · من … إلى … · N صفحة». مشتركٌ بين بطاقة الرحلة (الطالب والموظّف) والرابط العامّ؛
 * الأسطرُ تُبنى خارجه بـ`toMonthHistory`.
 */
import { PROGRAM_JUZ_COUNT } from '~/constants/quran'
import type { MonthHistoryItem } from '~/utils/quran/studentHistory'

interface Props {
  items: MonthHistoryItem[]
  /** أجزاءُ البرنامج المكتملة؛ null قبل اكتمال التحميل فلا يُعرض السطر. */
  juzDone: number | null
}

defineProps<Props>()
</script>

<template>
  <section
    class="qh"
    aria-label="سجلّ الشهور المعتمدة"
  >
    <h4>سجلّ الشهور</h4>
    <p
      v-if="juzDone !== null"
      class="reached"
    >
      وصل {{ juzDone }} من {{ PROGRAM_JUZ_COUNT }} جزءاً
    </p>
    <ul v-if="items.length">
      <li
        v-for="i in items"
        :key="i.key"
      >
        {{ i.text }}
      </li>
    </ul>
    <p
      v-else
      class="none"
    >
      لا شهورَ معتمدةً بعد.
    </p>
  </section>
</template>

<style scoped>
.qh { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.qh h4 { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--ink); }
.reached { margin: 0 0 10px; font-size: 14.5px; font-weight: 600; color: var(--green-ink); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
li { background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; font-size: 14px; color: var(--ink-2); line-height: 1.7; }
.none { margin: 0; font-size: 14px; color: var(--ink-3); }
</style>
