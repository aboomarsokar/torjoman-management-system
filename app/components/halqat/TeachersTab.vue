<script setup lang="ts">
/**
 * تبويبُ «المعلّمون والمعلّمات» في صفحة الحلقات (طلب المستخدم 2026-10-25): كلُّ معلّمٍ بحلقته وعدد طلابها
 * وجوّاله وواتس أبه، وبحثٌ بالاسم أو الرقم الوظيفي. المصدرُ ملفّاتُ دور المعلّم في النطاق: من يرى الكلَّ يرى
 * معلّمي النطاق كلَّهم — ومنهم من بلا حلقة (`allTeachers`؛ والفنيُّ البنين بـRLS، والمديرةُ البنات `femaleOnly`) —
 * والمشرفُ والمختبِرُ معلّمي حلقاتهما وحدهم. الجنسُ من فلتر الصفحة.
 */
import type { Database } from '~/types/database.types'

type Gender = Database['public']['Enums']['gender_type']
export interface TeacherHalaqa { id: string, name: string, gender: Gender | null, status: string, teacher_id: string, students: number }
interface TeacherProfile {
  id: string
  full_name: string
  employee_number: string | null
  gender: Gender | null
  phone: string | null
  whatsapp: string | null
  status: string
}

const props = defineProps<{
  halqat: TeacherHalaqa[]
  gender: Gender | 'all'
  allTeachers: boolean
  femaleOnly: boolean
}>()

const supabase = useSupabaseClient<Database>()
const { data: teachers, pending } = useLazyAsyncData<TeacherProfile[]>('halqat-teachers', async () => {
  let q = supabase.from('profiles').select('id, full_name, employee_number, gender, phone, whatsapp, status').eq('role', 'teacher')
  if (props.femaleOnly) q = q.eq('gender', 'female')
  const { data, error } = await q.order('full_name')
  if (error) {
    console.error('[halqat-teachers] فشل الجلب:', error.message)
    return []
  }
  return data ?? []
}, { server: false, default: () => [] })

const halqatByTeacher = computed(() => {
  const m = new Map<string, TeacherHalaqa[]>()
  for (const h of props.halqat) m.set(h.teacher_id, [...(m.get(h.teacher_id) ?? []), h])
  return m
})
const rows = computed(() => (teachers.value ?? [])
  .filter(t => props.allTeachers || halqatByTeacher.value.has(t.id))
  .map((t) => {
    const hs = halqatByTeacher.value.get(t.id) ?? []
    return { ...t, halqat: hs, students: hs.filter(h => h.status === 'active').reduce((n, h) => n + h.students, 0) }
  }))

const query = ref('')
const filtered = computed(() => rows.value.filter(t =>
  (props.gender === 'all' || t.gender === props.gender)
  && matchesSearch(query.value, t.full_name, t.employee_number)))
const { page, pageCount, total, pageSize, paged, resetPage } = usePagination(filtered, 12)
watch([query, () => props.gender], resetPage)

const columns = [
  { key: 'num', label: '#' },
  { key: 'teacher', label: 'المعلّم' },
  { key: 'halqa', label: 'الحلقة' },
  { key: 'students', label: 'الطلاب', align: 'center' as const },
  { key: 'contact', label: 'التواصل', align: 'end' as const }
]
const isF = (t: { gender: Gender | null }) => t.gender === 'female'
const telHref = (raw: string | null) => raw ? `tel:${raw.replace(/[^\d+]/g, '')}` : null
</script>

<template>
  <div
    id="panel-teachers"
    role="tabpanel"
    aria-labelledby="tab-teachers"
  >
    <div class="tt-filters">
      <UiSearchField
        v-model="query"
        placeholder="ابحث بالاسم أو الرقم الوظيفي"
        :shown="filtered.length"
        :total="rows.length"
        class="tt-search"
      />
    </div>

    <UiSkeletonTable
      v-if="pending && !rows.length"
      :columns="columns"
    />
    <UiEmptyState
      v-else-if="!rows.length"
      icon="i-lucide-users"
      title="لا معلّمين في نطاقك"
      description="يظهر هنا معلّمو حلقاتك متى أُسندوا إليها."
    />
    <UiEmptyState
      v-else-if="!filtered.length"
      icon="i-lucide-search-x"
      title="لا أحدَ بهذا الاسم"
      description="جرّب جزءاً من الاسم أو الرقمَ الوظيفي."
    />
    <template v-else>
      <UiDataTable
        :columns="columns"
        :rows="paged"
        row-key="id"
      >
        <template #num="{ index }">
          <span class="tt-idx">{{ (page - 1) * pageSize + index + 1 }}</span>
        </template>
        <template #teacher="{ row }">
          <NuxtLink
            :to="`/profile/${row.id}`"
            class="tt-name"
          >
            <span class="tt-av">{{ row.full_name.charAt(0) }}</span>
            <span class="tt-who">
              <b>{{ row.full_name }}</b>
              <bdi
                v-if="row.employee_number"
                dir="ltr"
              >{{ row.employee_number }}</bdi>
            </span>
          </NuxtLink>
        </template>
        <template #halqa="{ row }">
          <span
            v-if="!row.halqat.length"
            class="tt-none"
          >بلا حلقة</span>
          <span
            v-else
            class="tt-halqat"
          >
            <NuxtLink
              v-for="h in row.halqat"
              :key="h.id"
              :to="`/halqat/${h.id}`"
              class="tt-halqa"
              :class="{ stopped: h.status !== 'active' }"
            >{{ h.name }}</NuxtLink>
          </span>
        </template>
        <template #students="{ row }">
          <span
            class="tt-stud"
            :class="{ zero: !row.students }"
          ><UIcon
            name="i-lucide-users"
            class="size-3.5"
          />{{ studentsCountText(row.students, isF(row)) }}</span>
        </template>
        <template #contact="{ row }">
          <div class="tt-acts">
            <bdi
              v-if="row.phone"
              dir="ltr"
              class="tt-phone"
            >{{ row.phone }}</bdi>
            <UTooltip
              v-if="whatsappLink(row.whatsapp || row.phone)"
              text="واتس أب"
            >
              <UButton
                :to="whatsappLink(row.whatsapp || row.phone)!"
                target="_blank"
                rel="noopener"
                color="success"
                variant="soft"
                size="sm"
                icon="i-simple-icons-whatsapp"
                aria-label="مراسلة على واتس أب"
                :ui="{ base: 'rounded-[10px]' }"
              />
            </UTooltip>
            <UTooltip
              v-if="telHref(row.phone)"
              text="اتّصال"
            >
              <UButton
                :to="telHref(row.phone)!"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-phone"
                aria-label="اتّصال"
                :ui="{ base: 'rounded-[10px]' }"
              />
            </UTooltip>
          </div>
        </template>
        <template #card="{ row, index }">
          <UiCardRow
            :title="row.full_name"
            :subtitle="row.employee_number ?? ''"
            subtitle-dir="ltr"
            :to="`/profile/${row.id}`"
            :fields="[
              { label: 'الحلقة', value: row.halqat.map((h: TeacherHalaqa) => h.name).join('، ') || 'بلا حلقة', muted: !row.halqat.length },
              { label: isF(row) ? 'طالباتها' : 'طلابه', value: studentsCountText(row.students, isF(row)) },
              { label: 'الجوال', value: row.phone ?? '—' }
            ]"
          >
            <template #lead>
              <span class="tt-lead"><span class="tt-seq">{{ (page - 1) * pageSize + index + 1 }}</span><span class="tt-av">{{ row.full_name.charAt(0) }}</span></span>
            </template>
            <template
              v-if="row.phone || row.whatsapp"
              #actions
            >
              <UButton
                v-if="whatsappLink(row.whatsapp || row.phone)"
                :to="whatsappLink(row.whatsapp || row.phone)!"
                target="_blank"
                rel="noopener"
                label="واتس أب"
                color="success"
                variant="soft"
                icon="i-simple-icons-whatsapp"
                :ui="{ base: 'rounded-[11px]' }"
              />
              <UButton
                v-if="telHref(row.phone)"
                :to="telHref(row.phone)!"
                label="اتّصال"
                color="neutral"
                variant="outline"
                icon="i-lucide-phone"
                :ui="{ base: 'rounded-[11px]' }"
              />
            </template>
          </UiCardRow>
        </template>
      </UiDataTable>
      <UiPaginator
        :page="page"
        :page-count="pageCount"
        :total="total"
        :page-size="pageSize"
        @update:page="page = $event"
      />
    </template>
  </div>
</template>

<style scoped>
.tt-filters { display: flex; gap: 12px; margin-bottom: 16px; }
.tt-search { flex: 1; max-width: 520px; }
.tt-idx { color: var(--ink-3); font-variant-numeric: tabular-nums; }
.tt-name { display: inline-flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; }
.tt-name:hover b { color: var(--blue-ink); }
.tt-av { width: 40px; height: 40px; flex: none; border-radius: 12px; background: var(--navy); color: #fff; font-weight: 600; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; }
.tt-who { display: flex; flex-direction: column; line-height: 1.35; }
.tt-who b { font-size: 15px; font-weight: 600; }
.tt-who bdi { font-size: 13px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.tt-halqat { display: flex; flex-wrap: wrap; gap: 6px; }
.tt-halqa { color: var(--blue-ink); font-weight: 500; text-decoration: none; }
.tt-halqa:hover { text-decoration: underline; text-underline-offset: 3px; }
.tt-halqa.stopped { color: var(--ink-3); }
.tt-none { color: var(--ink-3); }
.tt-stud { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 999px; background: var(--blue-soft); color: var(--blue-ink); font-size: 13.5px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tt-stud.zero { background: var(--surface-2); color: var(--ink-3); }
.tt-acts { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.tt-phone { margin-inline-end: 6px; color: var(--ink-2); font-size: 14px; font-variant-numeric: tabular-nums; }
.tt-lead { display: inline-flex; align-items: center; gap: 10px; }
.tt-seq { min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) {
  .tt-search { max-width: none; }
}
</style>
