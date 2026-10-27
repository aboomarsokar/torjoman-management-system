<script setup lang="ts">
/**
 * طلابُ حلقتي — تبويبُ «الطلاب» للمعلّم يعمل بلا إنترنت (البند 14، طلب المستخدم 2026-10-27).
 * القائمةُ من نسخة الجهاز (`useStudentsMirror` — طلابُ الحلقة كلُّهم بكلّ الحالات)، تُحدَّث متّصلاً عند الفتح.
 * بحثٌ بالاسم أو الهوية وترشيحٌ بالحالة في المتصفّح (الطلابُ عشرات)، والبطاقةُ تفتح ملفَّه (`/t/students/view`).
 * الإضافةُ والتعديلُ وما تحتاجه الإدارةُ في `/students` متّصلاً («إدارة الطلاب»).
 */
import type { Database } from '~/types/database.types'
import { isOnlineNow } from '~/utils/reachability'
import { STUDENT_STATUS, studentStatusLabel } from '~/utils/statusMeta'
import { filterStudents } from '~/utils/studentsMirror'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'الطلاب — ترجمان', robots: 'noindex' })

type StudentStatus = Database['public']['Enums']['student_status']

const user = useSupabaseUser()
const { role } = useProfile()
const { mirror, refreshing, loadLocal, refresh } = useStudentsMirror()
const { online, blockIfOffline } = useOfflineNav()
const ready = ref(false)

onMounted(async () => {
  await loadLocal(user.value?.sub ?? null).catch(() => null)
  ready.value = true
  const me = user.value?.sub ?? mirror.value?.uid
  if (me && isOnlineNow()) await refresh(me).catch(() => undefined)
})
// غيرُ المعلّم متّصلاً يذهب إلى صفحة الطلاب الكاملة
watch(role, (r) => {
  if (r && r !== 'teacher') navigateTo('/students', { replace: true })
}, { immediate: true })

const statusF = ref<StudentStatus | 'all'>('active')
const query = ref('')
const all = computed(() => mirror.value?.students ?? [])
const shown = computed(() => filterStudents(all.value, statusF.value, query.value))
const statusItems = computed(() => ([
  { value: 'all' as const, label: 'كل الحالات' },
  { value: 'active' as const, label: 'نشط' },
  { value: 'withdrawn' as const, label: 'منقطع' },
  { value: 'graduated' as const, label: 'متخرّج' },
  { value: 'transferred' as const, label: 'منقول' }
]).map(c => ({ value: c.value, label: `${c.label} (${c.value === 'all' ? all.value.length : all.value.filter(s => s.status === c.value).length})` })))

/** «اتصال»: جوّالُ وليّ الأمر، وإلا جوّالُ الطالب. */
const phoneOf = (s: { guardian_phone: string | null, phone: string | null }) => s.guardian_phone || s.phone || null
</script>

<template>
  <div class="ts">
    <div class="head">
      <UiSearchField
        v-model="query"
        placeholder="ابحث بالاسم أو رقم الهوية"
        :shown="shown.length"
        :total="all.length"
        class="search"
      />
      <UiSelect
        v-model="statusF"
        :items="statusItems"
        size="xl"
        class="status"
        aria-label="الحالة"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
      <UButton
        to="/students"
        label="إدارة الطلاب"
        icon="i-lucide-settings-2"
        color="neutral"
        variant="outline"
        size="lg"
        :class="{ 'needs-net': !online }"
        :ui="{ base: 'rounded-[12px] min-h-12 font-semibold justify-center' }"
        @click="blockIfOffline('/students', $event)"
      />
    </div>

    <div
      v-if="!ready || (refreshing && !mirror)"
      class="list"
      aria-busy="true"
    >
      <UiSkeletonRow
        v-for="i in 5"
        :key="i"
      />
    </div>
    <UiEmptyState
      v-else-if="!mirror"
      icon="i-lucide-wifi-off"
      title="افتح هذه الشاشة مرّةً وأنت متّصل"
      description="يُحفظ طلابُ حلقتك على جهازك عند أوّل فتحٍ متّصل، ثمّ تعمل بلا إنترنت."
    />
    <UiEmptyState
      v-else-if="!mirror.halaqa"
      icon="i-lucide-book-open"
      title="لا حلقة معيّنة لك"
    />
    <UiEmptyState
      v-else-if="!shown.length"
      icon="i-lucide-search-x"
      :title="query ? `لا طالبَ يطابق «${query}»` : 'لا طلابَ بهذه الحالة'"
    />
    <ul
      v-else
      class="list"
    >
      <li
        v-for="s in shown"
        :key="s.id"
        class="row"
      >
        <NuxtLink
          :to="`/t/students/view?id=${s.id}`"
          class="who"
        >
          <span class="av"><ProfileAvatar
            :name="s.full_name"
            :zoomable="false"
          /></span>
          <span class="txt">
            <b>{{ s.full_name }}</b>
            <small>{{ s.quran_parts != null ? `${s.quran_parts} جزء محفوظ عند الالتحاق` : 'محفوظُه عند الالتحاق غيرُ مسجَّل' }}</small>
          </span>
          <UBadge
            :label="studentStatusLabel(s.status, s.gender)"
            :color="STUDENT_STATUS[s.status]?.color"
            variant="soft"
            class="badge"
          />
        </NuxtLink>
        <UButton
          v-if="phoneOf(s)"
          :to="`tel:${phoneOf(s)}`"
          icon="i-lucide-phone"
          color="neutral"
          variant="ghost"
          size="lg"
          class="call"
          :aria-label="`اتصل بوليّ أمر ${s.full_name}`"
          :ui="{ base: 'min-w-11 min-h-11 justify-center rounded-xl' }"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ts { display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.search { flex: 1 1 280px; }
.status { flex: 0 0 190px; }
.needs-net { opacity: .5; }
.list { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); overflow: hidden; }
.row { display: flex; align-items: center; gap: 8px; padding: 10px 14px 10px 10px; }
.row + .row { border-top: 1px solid var(--line); }
.who { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 52px; color: inherit; text-decoration: none; border-radius: 12px; }
.who:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
.av { width: 42px; height: 42px; flex: none; border-radius: 12px; overflow: hidden; display: flex; }
.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.txt b { font-size: 15.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.txt small { font-size: 13px; color: var(--ink-3); }
.badge { flex: none; }
.call { flex: none; }
@media (max-width: 560px) {
  .status { flex: 1 1 100%; }
  .head :deep(a) { flex: 1 1 100%; }
}
</style>
