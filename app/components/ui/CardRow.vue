<script setup lang="ts">
/**
 * بطاقة صفٍّ على الجوال (تُمرَّر في `#card` لـUiDataTable): رأسٌ (صورة/أيقونة + عنوان + سطرٌ فرعيّ + شارة)،
 * ثم أزواجُ «عنوان: قيمة»، ثم أزرار. موحّدة كي تتشابه البطاقات في كل الشاشات.
 * `to` يجعل الرأس رابطاً (يفتح التفاصيل).
 */
export interface CardField { label: string, value: string | number | null | undefined, muted?: boolean }

defineProps<{
  title: string
  subtitle?: string | null
  /** اتجاه السطر الفرعيّ — `ltr` للأرقام (هوية، رقم وظيفي). */
  subtitleDir?: 'ltr' | 'rtl'
  fields?: CardField[]
  to?: string
}>()
</script>

<template>
  <div class="crow">
    <component
      :is="to ? 'NuxtLink' : 'div'"
      :to="to"
      class="crow-head"
    >
      <span
        v-if="$slots.lead"
        class="crow-lead"
      ><slot name="lead" /></span>
      <span class="crow-id">
        <span class="crow-title">{{ title }}</span>
        <span
          v-if="subtitle"
          class="crow-sub"
          :dir="subtitleDir"
        >{{ subtitle }}</span>
      </span>
      <span
        v-if="$slots.badge"
        class="crow-badge"
      ><slot name="badge" /></span>
    </component>
    <dl
      v-if="fields?.length"
      class="crow-fields"
    >
      <template
        v-for="f in fields"
        :key="f.label"
      >
        <dt>{{ f.label }}</dt>
        <dd :class="{ muted: f.muted }">
          {{ f.value === null || f.value === undefined || f.value === '' ? '—' : f.value }}
        </dd>
      </template>
    </dl>
    <div
      v-if="$slots.actions"
      class="crow-actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* بلا حدود (طلب المستخدم): بطاقةٌ بيضاء على خلفية الصفحة، والفصل بالمسافة بين البطاقات */
.crow { background: var(--surface); border-radius: 16px; padding: 14px 16px; }
.crow-head { display: flex; align-items: center; gap: 12px; color: inherit; }
.crow-lead { flex: none; display: flex; }
.crow-id { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.crow-title { font-weight: 600; color: var(--ink); line-height: 1.35; overflow-wrap: anywhere; }
.crow-sub { font-size: 13px; color: var(--ink-3); }
.crow-sub[dir="ltr"] { text-align: end; align-self: flex-start; font-variant-numeric: tabular-nums; }
.crow-badge { flex: none; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.crow-fields { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--line); font-size: 14px; }
.crow-fields dt { color: var(--ink-3); font-size: 12.5px; white-space: nowrap; }
.crow-fields dd { margin: 0; color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
.crow-fields dd.muted { color: var(--ink-3); }
.crow-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
/* الأزرار ذات النصّ تتقاسم العرض، وذات الأيقونة وحدها (صنف icon-only) مربّعٌ 44px للّمس */
.crow-actions > :deep(*) { flex: 1 1 auto; justify-content: center; min-height: 44px; }
.crow-actions > :deep(.icon-only) { flex: 0 0 44px; }
</style>
