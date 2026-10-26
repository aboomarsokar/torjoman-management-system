<script setup lang="ts">
/**
 * «طلاب يحتاجون متابعتك» في لوحة المعلم — تُعرض داخل بطاقة شريطها (بلا إطارٍ ولا عنوانٍ هنا — طلب المستخدم 2026-10-26)، قوائمُ قصيرة لا كلُّ الطلاب: من غاب كثيراً هذا الشهر،
 * ومن لم يُرصد له في شهر الرصد، والمستحقّون للاختبار. كلُّ اسمٍ يفتح ملفَّ الطالب، والزائدُ «و N آخرون».
 */
import { ABSENCE_ATTENTION_DAYS, ATTENTION_LIST_MAX } from '~/constants/teacherDashboard'
import { isolateLtr } from '~/utils/transport'

interface Person { id: string, name: string, count?: number }
interface Props {
  absentees: Person[]
  unrecorded: Person[]
  /** يُعرض «لم يُرصد له» ما دام الرصدُ لم يُرسل (مسوّدةٌ أو معادٌ أو لم يبدأ). */
  showUnrecorded: boolean
  recordingLabel: string
  eligible: Person[]
  /** المتأخّرون عن مقرّر القراءة (`count` = عددُ المقرّرات المتأخّرة). */
  readingBehind: Person[]
}

const props = defineProps<Props>()

const groups = computed(() => [
  { key: 'abs', icon: 'i-lucide-user-x', tone: 'err', title: `غاب ${ABSENCE_ATTENTION_DAYS} أيام فأكثر هذا الشهر`, people: props.absentees, to: '/t', cta: 'الحضور' },
  ...(props.showUnrecorded ? [{ key: 'rec', icon: 'i-lucide-book-dashed', tone: 'blue', title: `لم يُدخَل إنجازهم القرآني — شهر ${isolateLtr(props.recordingLabel)}`, people: props.unrecorded, to: '/reports', cta: 'أدخِل الإنجاز' }] : []),
  { key: 'exam', icon: 'i-lucide-clipboard-check', tone: 'green', title: 'مستحقّون للاختبار ولم يُرشَّحوا', people: props.eligible, to: '/exams', cta: 'رشّح' },
  { key: 'read', icon: 'i-lucide-book-open-text', tone: 'blue', title: 'متأخّرون في البرامج المصاحبة', people: props.readingBehind, to: '/students', cta: 'الطلاب' }
].filter(g => g.people.length))

const shown = (people: Person[]) => people.slice(0, ATTENTION_LIST_MAX)
const rest = (people: Person[]) => Math.max(0, people.length - ATTENTION_LIST_MAX)
</script>

<template>
  <section
    class="att"
    aria-label="طلاب يحتاجون متابعتك"
  >
    <p
      v-if="!groups.length"
      class="none"
    >
      لا أحد يحتاج انتباهاً خاصّاً الآن.
    </p>
    <div
      v-for="g in groups"
      :key="g.key"
      class="grp"
    >
      <div class="g-head">
        <span
          class="g-ico"
          :class="g.tone"
        ><UIcon
          :name="g.icon"
          class="size-[18px]"
        /></span>
        <span class="g-title">{{ g.title }} <span class="g-n">({{ g.people.length }})</span></span>
        <UButton
          :to="g.to"
          :label="g.cta"
          color="neutral"
          variant="outline"
          size="sm"
          trailing-icon="i-lucide-chevron-left"
          class="g-cta"
          :ui="{ base: 'min-h-10 rounded-[10px]' }"
        />
      </div>
      <ul class="chips">
        <li
          v-for="p in shown(g.people)"
          :key="p.id"
        >
          <NuxtLink
            :to="`/students/${p.id}`"
            class="chip"
          >
            {{ p.name }}<span
              v-if="p.count"
              class="chip-n"
            >{{ p.count }}</span>
          </NuxtLink>
        </li>
        <li
          v-if="rest(g.people)"
          class="more"
        >
          و{{ rest(g.people) }} آخرون
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.att { display: flex; flex-direction: column; gap: 16px; }
.none { margin: 0; font-size: 14.5px; color: var(--ink-3); }
.grp { padding-top: 14px; border-top: 1px solid var(--line); }
.grp:first-of-type { padding-top: 0; border-top: none; }
.g-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.g-ico { width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.g-ico.err { background: var(--err-soft); color: var(--err); }
.g-ico.blue { background: var(--blue-soft); color: var(--blue-ink); }
.g-ico.green { background: var(--green-soft); color: var(--green-ink); }
.g-title { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 700; color: var(--ink); }
.g-n { font-weight: 500; color: var(--ink-3); }
.g-cta { flex: none; }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 14px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); font-size: 14px; font-weight: 600; color: var(--ink); text-decoration: none; }
.chip:hover { border-color: var(--line-2); background: var(--surface-3); }
.chip-n { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--err-soft); color: var(--err); font-size: 12px; display: inline-flex; align-items: center; justify-content: center; }
.more { display: inline-flex; align-items: center; min-height: 40px; padding: 0 6px; font-size: 13.5px; color: var(--ink-3); }

@media (max-width: 560px) { .att { padding: 16px; } }
</style>
