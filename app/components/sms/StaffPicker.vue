<script setup lang="ts">
/**
 * اختيارُ مستلمي SMS من الكادر (طلب المستخدم 2026-10-27): بالدور والقسم، ثم «اختر الكلّ» أو سطراً سطراً.
 * من لا جوالَ له يظهر معطّلاً. يُصدر المختارين `Recipient[]`.
 */
import type { Recipient, StaffRow } from '~/composables/useSms'
import { roleLabel } from '~/constants/roles'
import type { Role } from '~/constants/roles'
import { normalizeLocalPhone } from '~/utils/sms'

const props = defineProps<{ staff: StaffRow[] }>()
const selected = defineModel<Recipient[]>({ required: true })

const ROLE_FILTERS: { key: string, label: string }[] = [
  { key: 'all', label: 'الكلّ' },
  { key: 'teacher', label: 'المعلمون' },
  { key: 'field_supervisor', label: 'المشرفون' },
  { key: 'examiner', label: 'المختبِرون' },
  { key: 'managers', label: 'الإدارة' }
]
const MANAGERS = ['project_supervisor', 'admin_manager', 'technical_manager', 'women_admin']
const role = ref('all')
const section = ref<'all' | 'male' | 'female'>('all')
const sectionItems = [{ label: 'القسمان', value: 'all' }, { label: 'البنين', value: 'male' }, { label: 'البنات', value: 'female' }]

const rows = computed(() => props.staff
  .filter(s => role.value === 'all' || (role.value === 'managers' ? MANAGERS.includes(s.role) : s.role === role.value))
  .filter(s => section.value === 'all' || s.gender === section.value)
  .map(s => ({ ...s, local: normalizeLocalPhone(s.phone), key: `s:${s.id}` })))
const keyed = computed(() => new Set(selected.value.map(r => r.key)))
const pickable = computed(() => rows.value.filter(r => r.local))
const allPicked = computed(() => pickable.value.length > 0 && pickable.value.every(r => keyed.value.has(r.key)))

function toggle(r: typeof rows.value[number]) {
  if (!r.local) return
  selected.value = keyed.value.has(r.key)
    ? selected.value.filter(x => x.key !== r.key)
    : [...selected.value, { key: r.key, name: r.full_name, phone: r.local }]
}
function toggleAll() {
  const keys = new Set(pickable.value.map(r => r.key))
  selected.value = allPicked.value
    ? selected.value.filter(x => !keys.has(x.key))
    : [...selected.value.filter(x => !keys.has(x.key)), ...pickable.value.map(r => ({ key: r.key, name: r.full_name, phone: r.local! }))]
}
</script>

<template>
  <div class="sp">
    <div class="sp-filters">
      <div class="chips">
        <UButton
          v-for="f in ROLE_FILTERS"
          :key="f.key"
          :label="f.label"
          :color="role === f.key ? 'primary' : 'neutral'"
          :variant="role === f.key ? 'solid' : 'outline'"
          size="sm"
          :ui="{ base: 'rounded-full min-h-9 px-4' }"
          @click="role = f.key"
        />
      </div>
      <UiSelect
        v-model="section"
        :items="sectionItems"
        size="md"
        class="sp-sec"
      />
    </div>
    <div class="sp-head">
      <UCheckbox
        :model-value="allPicked"
        :label="`اختر الكلّ (${pickable.length})`"
        @update:model-value="toggleAll"
      />
    </div>
    <ul class="sp-list">
      <li
        v-for="r in rows"
        :key="r.key"
        :class="{ off: !r.local }"
      >
        <UCheckbox
          :model-value="keyed.has(r.key)"
          :disabled="!r.local"
          @update:model-value="toggle(r)"
        />
        <div class="who">
          <b>{{ r.full_name }}</b>
          <span>{{ roleLabel(r.role as Role, r.gender as 'male' | 'female' | null) }}</span>
        </div>
        <bdi
          dir="ltr"
          class="ph"
        >{{ r.local ?? 'بلا جوال' }}</bdi>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sp { display: flex; flex-direction: column; gap: 10px; }
.sp-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sp-sec { min-width: 130px; }
.sp-head { padding: 6px 4px; border-bottom: 1px solid var(--line); }
.sp-list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow: auto; display: flex; flex-direction: column; }
.sp-list li { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-bottom: 1px solid var(--line); min-height: 48px; }
.sp-list li.off { opacity: .55; }
.who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.4; }
.who b { color: var(--ink); font-weight: 600; }
.who span { font-size: 12.5px; color: var(--ink-3); }
.ph { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
</style>
