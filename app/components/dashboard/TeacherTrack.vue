<script setup lang="ts">
/**
 * «مساري» في لوحة المعلم (نظامُ المسارين — قرار المستخدم 2026-11-16): مسارُ الحلقة ونصابُه وأصلُ مكافأته، ومحتسبو
 * الشهر حتى اليوم والخصمُ المتوقَّع، ومسارُ الفصل التالي، وطلبُ التغيير وسحبُه، وقائمةُ الطلاب بحضورهم.
 * الأرقامُ من `halaqa_track_standing` (والحكمُ النهائيّ عند إقفال سجلّ الجودة). متّصلةٌ وحدها — بلا إنترنت تختفي.
 */
import { TRACKS, TRACK_RATE_CONSECUTIVE, TRACK_RATE_FIRST } from '~/constants/tracks'
import { gazaToday } from '~/utils/reportWindow'
import { yyyymmLabel } from '~/utils/tracks'

interface Props {
  halaqaId: string
  female: boolean
  online: boolean
}
const props = defineProps<Props>()

const today = gazaToday()
const year = ref(Number(today.slice(0, 4)))
const month = ref(Number(today.slice(5, 7)))
const hid = computed(() => (props.online ? props.halaqaId : null))
const { standing, busy, requestTrack, cancelRequest } = useTrackStanding(hid, year, month)
const { isReadOnly } = usePermissions()

const r = computed(() => standing.value?.reward ?? null)
const spec = computed(() => TRACKS[standing.value?.current_track ?? 1])
const nextTrack = computed(() => standing.value?.next_term_track ?? 1)
const termLabel = computed(() => (standing.value ? yyyymmLabel(standing.value.next_term) : ''))
const wanted = computed(() => (nextTrack.value === 1 ? 2 : 1) as 1 | 2)
const fillPct = computed(() => (r.value ? Math.min(100, Math.round((100 * r.value.counted) / r.value.quota)) : 0))
const notCounted = computed(() => (standing.value?.students ?? []).filter(s => !s.counted).length)

const modalOpen = ref(false)
const listOpen = ref(false)
async function submit(note: string) {
  if (await requestTrack(wanted.value, note)) modalOpen.value = false
}
const pupil = computed(() => (props.female ? 'طالبة' : 'طالب'))
</script>

<template>
  <section
    v-if="standing && r"
    class="card tt"
    aria-labelledby="tt-title"
  >
    <header class="tt-head">
      <span class="tt-ico"><UIcon
        name="i-lucide-route"
        class="size-5"
      /></span>
      <div class="tt-info">
        <h2 id="tt-title">
          مساري: {{ spec.label }}
        </h2>
        <p>نصابُه {{ spec.quota }} {{ pupil }} محتسَباً · أصلُ المكافأة {{ spec.amount }} شيكل</p>
      </div>
    </header>

    <div class="tt-meter">
      <div class="tt-line">
        <span>المحتسبون هذا الشهر حتى اليوم</span>
        <b class="num">{{ r.counted }} من {{ r.quota }}</b>
      </div>
      <span
        class="tt-bar"
        :class="{ ok: !r.missing }"
      ><i :style="{ width: `${fillPct}%` }" /></span>
      <p
        v-if="r.no_attendance"
        class="tt-note warn"
      >
        لم تُفتح أيامُ دوامٍ هذا الشهر بعد.
      </p>
      <p
        v-else-if="r.missing"
        class="tt-note warn"
      >
        {{ female ? 'ينقصكِ' : 'ينقصك' }} {{ r.missing }} — الخصمُ المتوقَّع {{ r.deduction }} شيكل
        ({{ r.consecutive ? `${TRACK_RATE_CONSECUTIVE} عن كلّ ناقص لشهرٍ متتالٍ` : `${TRACK_RATE_FIRST} عن كلّ ناقص` }})، فيصير الأصلُ {{ r.base }}.
      </p>
      <p
        v-else
        class="tt-note ok"
      >
        {{ female ? 'بلغتِ' : 'بلغتَ' }} النصاب — الأصلُ كاملاً {{ r.full }} شيكل.
      </p>
      <p class="tt-hint">
        المحتسَب من حضر أكثرَ من نصف أيام الدوام بعد طرح غيابه بعذر · أيامُ الدوام حتى اليوم {{ r.held_days }}.
      </p>
    </div>

    <div class="tt-next">
      <p v-if="standing.pending_request">
        {{ female ? 'طلبتِ' : 'طلبتَ' }} {{ TRACKS[standing.pending_request.track].label }} — قيد اعتماد المدير الإداري.
      </p>
      <p v-else-if="nextTrack !== standing.current_track">
        من <bdi dir="ltr">{{ termLabel }}</bdi>: {{ TRACKS[nextTrack].label }} (معتمَد).
      </p>
      <UButton
        v-if="standing.pending_request && !isReadOnly"
        label="سحب الطلب"
        color="neutral"
        variant="outline"
        :loading="busy"
        :ui="{ base: 'min-h-11 rounded-[13px]' }"
        @click="cancelRequest"
      />
      <UButton
        v-else-if="!isReadOnly"
        :label="`اطلب ${TRACKS[wanted].label}`"
        color="neutral"
        variant="outline"
        icon="i-lucide-signpost"
        :ui="{ base: 'min-h-11 rounded-[13px]' }"
        @click="modalOpen = true"
      />
    </div>

    <button
      type="button"
      class="tt-toggle"
      :aria-expanded="listOpen"
      @click="listOpen = !listOpen"
    >
      <span>حضورُ الطلاب هذا الشهر<template v-if="notCounted"> · غيرُ المحتسبين {{ notCounted }}</template></span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-5 tt-chev"
        :class="{ open: listOpen }"
      />
    </button>
    <ul
      v-if="listOpen"
      class="tt-list"
    >
      <li
        v-for="s in standing.students"
        :key="s.id"
      >
        <span class="tt-name">{{ s.name }}</span>
        <span class="tt-days num">حضر {{ s.attended }} من {{ s.member_days }}<template v-if="s.excused"> · بعذر {{ s.excused }}</template></span>
        <span
          class="tt-chip"
          :class="s.counted ? 'ok' : 'no'"
        >{{ s.counted ? 'محتسَب' : 'غيرُ محتسَب' }}</span>
      </li>
    </ul>

    <DashboardTrackRequestModal
      v-model:open="modalOpen"
      :track="wanted"
      :term-label="termLabel"
      :busy="busy"
      @submit="submit"
    />
  </section>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px 20px; }
.tt { display: flex; flex-direction: column; gap: 14px; }
.tt-head { display: flex; align-items: center; gap: 12px; }
.tt-ico { width: 42px; height: 42px; border-radius: 12px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: var(--blue-soft); color: var(--blue-ink); }
.tt-info h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.tt-info p { margin: 2px 0 0; font-size: 14px; color: var(--ink-2); }
.tt-meter { display: flex; flex-direction: column; gap: 8px; }
.tt-line { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; color: var(--ink-2); }
.tt-line b { color: var(--ink); font-size: 16px; }
.tt-bar { display: block; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
.tt-bar i { display: block; height: 100%; border-radius: inherit; background: var(--chip-warn-ink); }
.tt-bar.ok i { background: var(--green); }
.tt-note { margin: 0; font-size: 14.5px; font-weight: 600; line-height: 1.7; }
.tt-note.warn { color: var(--chip-warn-ink); }
.tt-note.ok { color: var(--green-ink); }
.tt-hint { margin: 0; font-size: 13px; color: var(--ink-3); line-height: 1.7; }
.tt-next { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--line); }
.tt-next p { margin: 0; font-size: 14.5px; color: var(--ink-2); flex: 1 1 200px; }
.tt-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; padding: 0; border: none; background: none; font: inherit; font-size: 15px; font-weight: 600; color: var(--ink); cursor: pointer; text-align: start; }
.tt-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); border-radius: 10px; }
.tt-chev { color: var(--ink-3); transition: transform .15s; }
.tt-chev.open { transform: rotate(180deg); }
.tt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.tt-list li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--line); }
.tt-name { flex: 1 1 160px; font-size: 15px; color: var(--ink); }
.tt-days { font-size: 13.5px; color: var(--ink-2); }
.tt-chip { font-size: 12.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.tt-chip.ok { background: var(--green-soft); color: var(--green-ink); }
.tt-chip.no { background: var(--chip-warn-bg); color: var(--chip-warn-ink); }
.num { font-variant-numeric: tabular-nums; }
</style>
