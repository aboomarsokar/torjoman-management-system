<script setup lang="ts">
/**
 * تفصيلُ إنجاز حلقةٍ في شهر (طلب المستخدم 2026-10-22): معلّمُها وأزرارُ التواصل معه (واتس أب واتصال — المعلمُ وحده،
 * لا أولياءُ الأمور)، ثم طلابُها في مجموعاتٍ: مقصّر (صفحاتُه من المطلوب) · لم يُرصد · لا يُقاس · أنجز.
 * البياناتُ من `halaqa_achievement_students` بحكم سجلّ التقييم نفسه.
 */
import type { Database } from '~/types/database.types'
import type { AchievementRow } from '~/utils/halaqatAchievement'
import { achievementPct, whatsappLink } from '~/utils/halaqatAchievement'
import { REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '~/utils/quran/screen'

const props = defineProps<{ row: AchievementRow | null, year: number, month: number }>()
const open = defineModel<boolean>('open', { default: false })

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()

type Student = Database['public']['Functions']['halaqa_achievement_students']['Returns'][number]
const students = ref<Student[]>([])
const loading = ref(false)

watch([open, () => props.row?.halaqa_id, () => props.year, () => props.month], async ([isOpen]) => {
  const r = props.row
  if (!isOpen || !r) return
  loading.value = true
  students.value = []
  const { data, error } = await supabase.rpc('halaqa_achievement_students', { p_halaqa: r.halaqa_id, p_year: props.year, p_month: props.month })
  loading.value = false
  if (error) handle(error)
  else students.value = data ?? []
}, { immediate: true })

const GROUPS = [
  { key: 'short', label: 'مقصّرون', tone: 'err' },
  { key: 'unrecorded', label: 'لم يُرصدوا', tone: 'warn' },
  { key: 'unmeasured', label: 'لا يُقاسون (غابوا الشهرَ كلّه)', tone: 'neutral' },
  { key: 'done', label: 'أنجزوا', tone: 'ok' }
] as const
const groups = computed(() => GROUPS
  .map(g => ({ ...g, items: students.value.filter(s => s.state === g.key) }))
  .filter(g => g.items.length))

const pct = computed(() => props.row ? achievementPct(props.row) : null)
const wa = computed(() => whatsappLink(props.row?.teacher_whatsapp || props.row?.teacher_phone))
const tel = computed(() => props.row?.teacher_phone ? `tel:${props.row.teacher_phone.replace(/[^\d+]/g, '')}` : null)
const status = computed(() => (props.row?.report_status ?? 'none') as keyof typeof REPORT_STATUS_LABELS)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="row?.halaqa_name ?? 'الحلقة'"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div
        v-if="row"
        class="am"
      >
        <dl class="am-meta">
          <div><dt>الشهر</dt><dd><bdi dir="ltr">{{ month }}/{{ year }}</bdi></dd></div>
          <div><dt>الإنجاز</dt><dd>{{ pct === null ? '—' : `${pct}٪` }} · أنجز {{ row.done }} من {{ row.done + row.short + row.unrecorded }}</dd></div>
          <div>
            <dt>رصدُ الشهر</dt><dd>
              <UBadge
                :label="REPORT_STATUS_LABELS[status]"
                :color="REPORT_STATUS_COLORS[status]"
                variant="soft"
              />
            </dd>
          </div>
        </dl>

        <!-- التواصلُ مع المعلم وحده (قرار المستخدم 2026-10-22) -->
        <div class="am-teacher">
          <div class="am-t-name">
            <span>المعلّم</span>
            <b>{{ row.teacher_name ?? 'بلا معلّم' }}</b>
          </div>
          <div class="am-t-actions">
            <UButton
              v-if="wa"
              :to="wa"
              target="_blank"
              rel="noopener"
              label="واتس أب"
              icon="i-simple-icons-whatsapp"
              color="success"
              :ui="{ base: 'rounded-[12px] font-semibold min-h-11' }"
            />
            <UButton
              v-if="tel"
              :to="tel"
              label="اتصال"
              icon="i-lucide-phone"
              color="neutral"
              variant="outline"
              :ui="{ base: 'rounded-[12px] min-h-11' }"
            />
            <span
              v-if="!wa && !tel"
              class="am-none"
            >لا رقمَ للمعلّم في بياناته</span>
          </div>
        </div>

        <UiSkeletonLines
          v-if="loading"
          :fields="4"
        />
        <p
          v-else-if="!groups.length"
          class="am-empty"
        >
          لا طلابَ نشطين في الحلقة.
        </p>
        <section
          v-for="g in groups"
          v-else
          :key="g.key"
          class="am-group"
        >
          <h4 :class="`t-${g.tone}`">
            {{ g.label }} <span>{{ g.items.length }}</span>
          </h4>
          <ul>
            <li
              v-for="s in g.items"
              :key="s.student_id"
            >
              <NuxtLink
                :to="`/students/${s.student_id}`"
                class="am-name"
              >{{ s.full_name }}</NuxtLink>
              <span
                v-if="s.pages !== null"
                class="am-pages"
              >{{ s.pages }}<template v-if="s.required !== null"> من {{ s.required }}</template> صفحة</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.am { display: flex; flex-direction: column; gap: 14px; }
.am-meta { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 0; padding: 10px 14px; border-radius: 13px; background: var(--surface-2); }
.am-meta dt { font-size: 12px; color: var(--ink-3); }
.am-meta dd { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink); }
.am-teacher { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; }
.am-t-name { display: flex; flex-direction: column; gap: 2px; }
.am-t-name span { font-size: 12px; color: var(--ink-3); }
.am-t-name b { font-size: 15.5px; color: var(--ink); }
.am-t-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.am-none { font-size: 13px; color: var(--ink-3); }
.am-empty { margin: 0; padding: 18px; text-align: center; color: var(--ink-2); background: var(--surface-2); border-radius: 13px; }
.am-group h4 { margin: 0 0 6px; font-size: 14.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.am-group h4 span { font-size: 12.5px; padding: 1px 9px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); }
.t-err { color: var(--err); }
.t-warn { color: var(--chip-warn-ink); }
.t-ok { color: var(--green-ink); }
.t-neutral { color: var(--ink-2); }
.am-group ul { list-style: none; margin: 0; padding: 0; }
.am-group li { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; border-top: 1px solid var(--line); }
.am-name { color: var(--ink); font-weight: 600; text-decoration: none; }
.am-name:hover { color: var(--blue-ink); }
.am-pages { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
