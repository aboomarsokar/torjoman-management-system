<script setup lang="ts">
/**
 * رأس الصفحة الموحّد — صفّ أدواتٍ واحد: سطر الإرشاد (اختياري) والإجراءات (slot).
 * العنوان يحمله الشريط العلوي في التخطيط، فيبقى هنا عنواناً للقارئات الصوتية وحدها
 * (لا يتكرّر بصرياً، وتسلسل العناوين h1 ← h2 سليم).
 * والمعلّمُ بلا سطر الإرشاد في كلّ الصفحات (طلب المستخدم 2026-10-26: «احذف كل هذه الوصوف عند المعلم»).
 */
const props = defineProps<{ title: string, subtitle?: string }>()
const { isTeacher } = usePermissions()
const hint = computed(() => (isTeacher.value ? undefined : props.subtitle))
</script>

<template>
  <div
    class="head"
    :class="{ bare: !hint && !$slots.actions }"
  >
    <h2 class="sr-only">
      {{ title }}
    </h2>
    <p
      v-if="hint"
      class="hint"
    >
      {{ hint }}
    </p>
    <div
      v-if="$slots.actions"
      class="head-actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; margin-bottom: 16px; }
.head.bare { margin: 0; }
.hint { margin: 0; flex: 1 1 320px; max-width: 75ch; font-size: 14.5px; line-height: 1.6; color: var(--ink-3); }
.head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-inline-start: auto; }
</style>
