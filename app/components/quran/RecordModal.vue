<script setup lang="ts">
/**
 * نافذةُ رصد شهرٍ لطالب: من سورة/آية (افتراضاً ما يلي آخرَ ما رُصد له) إلى سورة/آية بترتيب الحفظ
 * (من الناس إلى الفاتحة)، والصفحاتُ تُحسب من الموضعين عند كلّ تغيير ويعدّلها المعلم (0–604)،
 * وصفحاتُ المراجعة (اختيارية؛ في السجلّ الجديد تتبع المحفوظةَ حتى يعدّلها المعلم بيده — طلب المستخدم 2026-10-19) والملاحظات. «لم يحفظ جديداً» يُفرغ المواضع ويجعل الصفحاتِ صفراً.
 * البحثُ في السور عربيٌّ متسامح (`filterByLabel`، و«ياسين» لـ«يس»)، والتحقّقُ هنا تجربةٌ والحكمُ للقاعدة.
 * `readOnly`: عرضٌ بلا حفظ.
 */
import { MUSHAF_PAGES, monthlyJuzLabel } from '~/constants/quran'
import type { StudentMonthRow } from '~/utils/quran/month'
import { pagesMemorized } from '~/utils/quran/mushaf'
import { outcomeOf } from '~/utils/quran/plan'
import type { Position } from '~/utils/quran/position'
import type { RecordInput } from '~/utils/quran/screen'
import { NOTE_MAX, OUTCOME_COLORS, planBadge, recordFormError } from '~/utils/quran/screen'

const props = defineProps<{ row: StudentMonthRow | null, readOnly: boolean, saving?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [input: RecordInput] }>()

const { surahs, pages, ayahCountOf } = useQuranReference()

/** بدايةُ المسار لمن لا اقتراحَ له: الناس 1. */
const PATH_START: Position = { surah: 114, ayah: 1 }
const YASIN = 36

const state = reactive({
  none: false,
  fromSurah: PATH_START.surah,
  fromAyah: PATH_START.ayah as number | null,
  toSurah: PATH_START.surah,
  toAyah: PATH_START.ayah as number | null,
  pages: 0 as number | null,
  reviewed: null as number | null,
  notes: ''
})
const fromQuery = ref('')
const toQuery = ref('')
// الملءُ من السجلّ لا يُعيد حسابَ الصفحات (رقمُ المعلم المحفوظ يبقى كما سلّمه)
let hydrating = false
/** المراجعةُ تتبع المحفوظة في السجلّ الجديد، وتنفصل عنها حين يكتبها المعلم بيده. */
const reviewFollows = ref(false)

const from = computed<Position>(() => ({ surah: state.fromSurah, ayah: state.fromAyah ?? 0 }))
const to = computed<Position>(() => ({ surah: state.toSurah, ayah: state.toAyah ?? 0 }))
const autoPages = (a: Position, b: Position) => pagesMemorized(pages.value, a, b)

watch([open, () => props.row], ([isOpen, row]) => {
  if (!isOpen || !row) return
  hydrating = true
  const rec = row.record
  const start = rec?.from ?? row.suggestedFrom ?? PATH_START
  const end = rec?.to ?? start
  const pages = rec ? rec.pagesMemorized : row.suggestedFrom ? autoPages(start, end) ?? 0 : 0
  reviewFollows.value = !rec
  Object.assign(state, {
    none: rec ? rec.from === null : row.suggestedFrom === null,
    fromSurah: start.surah,
    fromAyah: start.ayah,
    toSurah: end.surah,
    toAyah: end.ayah,
    pages,
    reviewed: rec ? rec.pagesReviewed : pages || null,
    notes: rec?.notes ?? ''
  })
  fromQuery.value = ''
  toQuery.value = ''
  nextTick(() => {
    hydrating = false
  })
}, { immediate: true })

// تغييرُ السورة يقصّ الآيةَ على عددها، وكلُّ تغييرٍ في المواضع يُعيد حسابَ الصفحات
watch(() => [state.none, state.fromSurah, state.fromAyah, state.toSurah, state.toAyah], () => {
  if (hydrating || props.readOnly) return
  const fromMax = ayahCountOf(state.fromSurah)
  const toMax = ayahCountOf(state.toSurah)
  if (fromMax && (state.fromAyah ?? 0) > fromMax) state.fromAyah = fromMax
  if (toMax && (state.toAyah ?? 0) > toMax) state.toAyah = toMax
  state.pages = state.none ? 0 : autoPages(from.value, to.value) ?? state.pages
})

// «لم يحفظ جديداً» لا يُصفّر المراجعة: قد يراجع من لم يحفظ
watch(() => state.pages, (p) => {
  if (hydrating || props.readOnly || !reviewFollows.value || state.none) return
  state.reviewed = p || null
})
function onReviewedInput() {
  if (!hydrating) reviewFollows.value = false
}

const surahOptions = computed(() => [...surahs.value].reverse().map(s => ({
  label: `${s.number}. ${s.name}`,
  value: s.number,
  ...(s.number === YASIN ? { aliases: ['ياسين'] } : {})
})))
const fromItems = computed(() => filterByLabel(surahOptions.value, fromQuery.value))
const toItems = computed(() => filterByLabel(surahOptions.value, toQuery.value))

const formError = computed(() => recordFormError({
  none: state.none, from: from.value, to: to.value, pages: state.pages, reviewed: state.reviewed, notes: state.notes
}, ayahCountOf))
const juzText = computed(() => monthlyJuzLabel(state.pages ?? 0))
// آخرُ صفٍّ عُرض يبقى في النافذة أثناء حركة إغلاقها (الأبُ يُفرغ `row` فور الإغلاق)
const shown = ref<StudentMonthRow | null>(props.row)
watch(() => props.row, (r) => {
  if (r) shown.value = r
})
const liveOutcome = computed(() => shown.value ? outcomeOf(state.pages, shown.value.plan) : 'unrecorded')
/** مصدرُ البداية المقترحة لسجلٍّ جديد. */
const startHint = computed(() => {
  const r = shown.value
  if (!r || r.record || !r.suggestedFrom) return undefined
  return r.suggestedFromPrevious ? 'بعد آخر ما رُصد له' : 'بدايةُ ما بعد محفوظه'
})
const locked = computed(() => props.readOnly || !!props.saving)

function save() {
  if (formError.value || state.pages === null) return
  emit('save', {
    from: state.none ? null : from.value,
    to: state.none ? null : to.value,
    pagesMemorized: state.none ? 0 : state.pages,
    pagesReviewed: state.reviewed,
    notes: state.notes.trim() || null
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="shown ? `رصد ${shown.name}${shown.recordedElsewhere ? ' — رُصد في حلقته السابقة' : ''}` : ''"
    description="من الناس إلى الفاتحة: السورةُ تنازلياً والآيةُ داخلها تصاعدياً."
  >
    <template #body>
      <form
        v-if="shown"
        class="rec"
        @submit.prevent="save"
      >
        <USwitch
          v-model="state.none"
          size="lg"
          label="لم يحفظ جديداً هذا الشهر"
          :disabled="locked"
        />
        <div
          v-if="!state.none"
          class="range"
        >
          <UFormField
            label="من سورة"
            :hint="startHint"
          >
            <USelectMenu
              v-model="state.fromSurah"
              v-model:search-term="fromQuery"
              aria-label="اختر السورة — من"
              :items="fromItems"
              value-key="value"
              ignore-filter
              :search-input="{ placeholder: 'اكتب الاسم أو الرقم' }"
              :disabled="locked"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="من الآية">
            <UInputNumber
              v-model="state.fromAyah"
              :min="1"
              :max="ayahCountOf(state.fromSurah) || undefined"
              :disabled="locked"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="إلى سورة">
            <USelectMenu
              v-model="state.toSurah"
              v-model:search-term="toQuery"
              aria-label="اختر السورة — إلى"
              :items="toItems"
              value-key="value"
              ignore-filter
              :search-input="{ placeholder: 'اكتب الاسم أو الرقم' }"
              :disabled="locked"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="إلى الآية">
            <UInputNumber
              v-model="state.toAyah"
              :min="1"
              :max="ayahCountOf(state.toSurah) || undefined"
              :disabled="locked"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="range pair">
          <UFormField
            label="الصفحات المحفوظة"
            :hint="state.none ? undefined : 'محسوبةٌ من الموضعين'"
          >
            <UInputNumber
              v-model="state.pages"
              :min="0"
              :max="MUSHAF_PAGES"
              :disabled="locked || state.none"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="صفحات المراجعة"
            :hint="reviewFollows && !state.none ? 'مثل المحفوظة' : 'اختياري'"
          >
            <UInputNumber
              v-model="state.reviewed"
              :min="0"
              :max="MUSHAF_PAGES"
              :disabled="locked"
              size="lg"
              class="w-full"
              @update:model-value="onReviewedInput"
            />
          </UFormField>
        </div>
        <div class="badges">
          <UBadge
            v-if="juzText"
            color="primary"
            variant="soft"
            size="lg"
            :label="`= ${juzText}`"
          />
          <UBadge
            :color="OUTCOME_COLORS[liveOutcome]"
            variant="soft"
            size="lg"
            :label="planBadge({ plan: shown.plan, outcome: liveOutcome })"
          />
        </div>
        <UFormField
          label="ملاحظات"
          hint="اختياري"
        >
          <UTextarea
            v-model="state.notes"
            :rows="2"
            :maxlength="NOTE_MAX"
            :disabled="locked"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <p
          v-if="formError && !readOnly"
          class="err"
          role="alert"
        >
          {{ formError }}
        </p>
        <div class="actions">
          <UButton
            :label="readOnly ? 'إغلاق' : 'إلغاء'"
            color="neutral"
            variant="ghost"
            size="lg"
            :ui="{ base: 'rounded-[13px] min-h-11' }"
            @click="open = false"
          />
          <UButton
            v-if="!readOnly"
            type="submit"
            label="حفظ"
            icon="i-lucide-check"
            size="lg"
            :disabled="!!formError"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] min-h-11 font-semibold' }"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>

<style scoped>
.rec { display: flex; flex-direction: column; gap: 16px; }
/* المحاذاةُ من الأسفل: عنوانٌ بتلميحٍ ينكسر سطرين على الشاشة الضيّقة كان يُنزل مربّعَه عن جاره */
.range { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 12px; align-items: end; }
.range.pair { grid-template-columns: 1fr 1fr; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.err { margin: 0; padding: 10px 14px; border-radius: var(--r-control); background: var(--err-soft); color: var(--err); font-size: 14px; font-weight: 600; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
