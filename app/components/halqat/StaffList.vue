<script setup lang="ts">
/**
 * طاقم الحلقة مكدَّساً (المعلم ثم المشرف ثم المختبِر، والطلاب اختياراً) — لعمود «الطاقم»
 * في الحاوية المتوسطة ولبطاقات الجوال. الخانة الشاغرة تُكتب بلونٍ أخفت لتُلحظ.
 * المسمّيات بجنس الحلقة: طاقم حلقة البنات من جنسها (حارس guard_halaqa_staff).
 * `hideSupervisor`: لصفحة المشرف الميداني — حلقاتُه كلُّها مسندةٌ إليه فلا معنى لتكرار اسمه.
 * `card`: شكلُ بطاقة الجوال (طلب المستخدم 2026-10-22) — سطرٌ لكلٍّ بأيقونته وتسميةٍ بعرضٍ ثابت واسمٍ أوضح،
 *   والعددُ شارةٌ تحتها لا سطرٌ بين الأسماء. و`dense` الشكلُ نفسُه مضغوطاً لخانة «الطاقم» في الجدول (بلا فواصل).
 */
const props = defineProps<{
  teacher: string | null
  supervisor: string | null
  examiner: string | null
  students?: number
  gender?: 'male' | 'female' | null
  hideSupervisor?: boolean
  card?: boolean
  dense?: boolean
}>()

const f = computed(() => props.gender === 'female')
const staff = computed(() => [
  { key: 't', icon: 'i-lucide-user-round', label: f.value ? 'المعلّمة' : 'المعلّم', value: props.teacher ?? (f.value ? 'بلا معلّمة' : 'بلا معلّم'), empty: !props.teacher },
  ...(props.hideSupervisor ? [] : [{ key: 's', icon: 'i-lucide-shield-check', label: f.value ? 'المشرفة' : 'المشرف', value: props.supervisor ?? (f.value ? 'بلا مشرفة' : 'بلا مشرف'), empty: !props.supervisor }]),
  { key: 'e', icon: 'i-lucide-award', label: f.value ? 'المختبِرة' : 'المختبِر', value: props.examiner ?? (f.value ? 'بلا مختبِرة' : 'بلا مختبِر'), empty: !props.examiner }
])
const studentsLabel = computed(() => f.value ? 'الطالبات' : 'الطلاب')
/** «6 طالبات» / «طالبةٌ واحدة» — للشارة في البطاقة. */
const studentsText = computed(() => studentsCountText(props.students ?? 0, f.value))
</script>

<template>
  <div
    v-if="card"
    class="sc"
    :class="{ dense }"
  >
    <ul class="sc-rows">
      <li
        v-for="r in staff"
        :key="r.key"
      >
        <span class="sc-ico"><UIcon
          :name="r.icon"
          class="size-4"
        /></span>
        <span class="sc-label">{{ r.label }}</span>
        <span
          class="sc-val"
          :class="{ empty: r.empty }"
        >{{ r.value }}</span>
      </li>
    </ul>
    <span
      v-if="students !== undefined"
      class="sc-count"
      :class="{ empty: students === 0 }"
    ><UIcon
      name="i-lucide-users"
      class="size-4"
    />{{ studentsText }}</span>
  </div>
  <dl
    v-else
    class="staff"
  >
    <template
      v-for="r in staff"
      :key="r.key"
    >
      <dt>{{ r.label }}</dt>
      <dd :class="{ empty: r.empty }">
        {{ r.value }}
      </dd>
    </template>
    <template v-if="students !== undefined">
      <dt>{{ studentsLabel }}</dt>
      <dd :class="{ empty: students === 0 }">
        {{ students }}
      </dd>
    </template>
  </dl>
</template>

<style scoped>
.staff { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; align-items: baseline; }
dt { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
dd { margin: 0; color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
dd.empty { color: var(--ink-3); }

.sc { display: flex; flex-direction: column; gap: 12px; }
.sc-rows { list-style: none; margin: 0; padding: 0; }
.sc-rows li { display: flex; align-items: center; gap: 10px; min-height: 40px; }
.sc-rows li + li { border-top: 1px dashed var(--line); }
.sc-ico { width: 28px; height: 28px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--ink-2); }
.sc-label { width: 64px; flex: none; font-size: 12.5px; color: var(--ink-3); }
.sc-val { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.sc-val.empty { font-weight: 500; color: var(--ink-3); }
.sc.dense { gap: 0; }
.sc.dense .sc-rows li { min-height: 30px; gap: 8px; }
.sc.dense .sc-rows li + li { border-top: 0; }
.sc.dense .sc-ico { width: 24px; height: 24px; border-radius: 7px; }
.sc.dense .sc-label { width: 56px; font-size: 12px; }
.sc.dense .sc-val { font-size: 14px; }
/* في خانة الجدول: الاسمُ سطرٌ واحدٌ بـ«…» والخانةُ لا تُعصر (كان كلمةً في السطر على العرض المتوسّط — 2026-10-25) */
.sc.dense { min-width: 210px; }
.sc.dense .sc-val { max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-count { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sc-count.empty { background: var(--surface-2); color: var(--ink-3); }
</style>
