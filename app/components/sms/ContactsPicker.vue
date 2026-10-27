<script setup lang="ts">
/**
 * جهاتُ الاتصال الخارجية لرسائل SMS (طلب المستخدم 2026-10-27): مرشّحون للمقابلات وغيرُهم، بوسمٍ يجمعهم
 * («مرشّحو مقابلات 11-2026» مثلاً). تُضاف وتُحذف هنا، وتُختار بالوسم أو سطراً سطراً. وتحتها أرقامٌ يدويةٌ لمرّةٍ واحدة.
 */
import type { Recipient, SmsContact } from '~/composables/useSms'
import { parseManualNumbers } from '~/composables/useSms'

const props = defineProps<{ contacts: SmsContact[], canEdit: boolean }>()
const emit = defineEmits<{ add: [c: { name: string, phone: string, tag: string, note: string }], remove: [id: string] }>()
const selected = defineModel<Recipient[]>({ required: true })
const manual = defineModel<string>('manual', { required: true })

const tag = ref('all')
const tags = computed(() => [...new Set(props.contacts.map(c => c.tag).filter((t): t is string => !!t))])
const tagItems = computed(() => [{ label: 'كلّ الوسوم', value: 'all' }, ...tags.value.map(t => ({ label: t, value: t }))])
const rows = computed(() => props.contacts.filter(c => tag.value === 'all' || c.tag === tag.value).map(c => ({ ...c, key: `c:${c.id}` })))
const keyed = computed(() => new Set(selected.value.map(r => r.key)))
const allPicked = computed(() => rows.value.length > 0 && rows.value.every(r => keyed.value.has(r.key)))
const manualInfo = computed(() => parseManualNumbers(manual.value))

function toggle(r: typeof rows.value[number]) {
  selected.value = keyed.value.has(r.key)
    ? selected.value.filter(x => x.key !== r.key)
    : [...selected.value, { key: r.key, name: r.name, phone: r.phone }]
}
function toggleAll() {
  const keys = new Set(rows.value.map(r => r.key))
  selected.value = allPicked.value
    ? selected.value.filter(x => !keys.has(x.key))
    : [...selected.value.filter(x => !keys.has(x.key)), ...rows.value.map(r => ({ key: r.key, name: r.name, phone: r.phone }))]
}

const form = reactive({ name: '', phone: '', tag: '', note: '' })
function add() {
  emit('add', { ...form })
  Object.assign(form, { name: '', phone: '' })
}
</script>

<template>
  <div class="cp">
    <div
      v-if="canEdit"
      class="cp-add"
    >
      <UInput
        v-model="form.name"
        placeholder="الاسم"
        size="md"
        class="w-full"
      />
      <UInput
        v-model="form.phone"
        placeholder="05XXXXXXXX"
        inputmode="tel"
        dir="ltr"
        size="md"
        class="w-full"
      />
      <UInput
        v-model="form.tag"
        placeholder="الوسم (مثلاً: مرشّحو مقابلات)"
        size="md"
        class="w-full"
      />
      <UButton
        label="أضف"
        icon="i-lucide-plus"
        color="primary"
        :ui="{ base: 'rounded-[10px] min-h-10' }"
        @click="add"
      />
    </div>
    <div
      v-if="contacts.length"
      class="cp-head"
    >
      <UCheckbox
        :model-value="allPicked"
        :label="`اختر الكلّ (${rows.length})`"
        @update:model-value="toggleAll"
      />
      <UiSelect
        v-model="tag"
        :items="tagItems"
        size="md"
        class="cp-tag"
      />
    </div>
    <p
      v-else
      class="cp-empty"
    >
      لا جهاتِ اتصالٍ محفوظة — أضف المرشّحين وغيرَهم بوسمٍ يجمعهم ليُختاروا معاً.
    </p>
    <ul
      v-if="rows.length"
      class="cp-list"
    >
      <li
        v-for="r in rows"
        :key="r.key"
      >
        <UCheckbox
          :model-value="keyed.has(r.key)"
          @update:model-value="toggle(r)"
        />
        <div class="who">
          <b>{{ r.name }}</b>
          <span v-if="r.tag">{{ r.tag }}</span>
        </div>
        <bdi
          dir="ltr"
          class="ph"
        >{{ r.phone }}</bdi>
        <UButton
          v-if="canEdit"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="حذف جهة الاتصال"
          @click="emit('remove', r.id)"
        />
      </li>
    </ul>
    <UFormField
      label="أرقامٌ يدوية لمرّةٍ واحدة"
      :hint="manual.trim() ? `${manualInfo.list.length} رقم${manualInfo.invalid ? ` · ${manualInfo.invalid} غير صالح` : ''}` : 'رقمٌ في كلّ سطر'"
    >
      <UTextarea
        v-model="manual"
        :rows="3"
        autoresize
        dir="ltr"
        class="w-full"
        placeholder="0599123456"
      />
    </UFormField>
  </div>
</template>

<style scoped>
.cp { display: flex; flex-direction: column; gap: 12px; }
.cp-add { display: grid; grid-template-columns: 1.2fr 1fr 1.2fr auto; gap: 8px; }
@media (max-width: 720px) { .cp-add { grid-template-columns: 1fr 1fr; } }
.cp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 4px; border-bottom: 1px solid var(--line); }
.cp-tag { min-width: 160px; }
.cp-empty { margin: 0; color: var(--ink-3); font-size: 13.5px; }
.cp-list { list-style: none; margin: 0; padding: 0; max-height: 300px; overflow: auto; }
.cp-list li { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-bottom: 1px solid var(--line); min-height: 48px; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.4; }
.who b { color: var(--ink); font-weight: 600; }
.who span { font-size: 12.5px; color: var(--ink-3); }
.ph { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
</style>
