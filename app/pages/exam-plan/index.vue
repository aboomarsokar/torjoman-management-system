<script setup lang="ts">
/**
 * خطة الاختبارات المرحلية — تبويبان: «الخطة» (ثلاث مراحل × خمس دورات من `exam_cycles`، وحدودُ كلّ دورةٍ
 * من تقسيمة البرنامج) و«تقسيمة الأجزاء» (`program_juz`، 30 ← 1).
 * التعديل (من جزء، إلى جزء، وصف السور) وتعديلُ تقسيمة الأجزاء للمدير الإداري وحده (قرار 2026-10-22)؛ والحكمُ الأخير لقاعدة
 * البيانات: قيدُ الاحتواء (دورة 2 ⊇ 1، 4 ⊇ 3، 5 ⊇ 1–4 داخل المرحلة) تردّ رسالتَه العربيّة فتُعرض كما هي.
 */
import type { Database } from '~/types/database.types'
import { CYCLE_COLUMNS, CYCLE_LABELS, STAGE_LABELS, toExamCycle } from '~/utils/exams/cycles'
import type { ExamCycle } from '~/utils/exams/cycles'
import { examPlanStats } from '~/utils/pageStats'
import type { ProgramJuz } from '~/utils/quran/position'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'خطة الاختبارات — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()
/** التعديل للمدير الإداري وحده كما يسمح RLS؛ وغيرُه للاطّلاع (قرار 2026-10-22). */
const { isAdmin } = usePermissions()
const quran = useQuranReference()

const tab = ref<'plan' | 'juz'>('plan')
const tabs = [
  { value: 'plan' as const, label: 'الخطة' },
  { value: 'juz' as const, label: 'تقسيمة الأجزاء' }
]
const STAGES = [1, 2, 3]

// جلب غير حاجز: السكيلتون يغطّي الانتظار
const { data: cycles, refresh, pending } = useLazyAsyncData<ExamCycle[]>(
  'exam-cycles',
  async () => {
    const { data, error } = await supabase
      .from('exam_cycles')
      .select(CYCLE_COLUMNS)
      .order('stage_number')
      .order('cycle_number')
    if (error) {
      handle(error)
      return []
    }
    return (data ?? []).map(toExamCycle)
  },
  { server: false, default: () => [] }
)
// فشلُ مراجع القرآن (يُعرض خطؤه من useQuranReference) لا يُدوِّر الهيكلَ للأبد:
// الخطةُ تظهر بلا حدود السور، وتبويبُ التقسيمة يعرض حالةً فارغة
const quranTried = ref(false)
onMounted(async () => {
  await quran.load()
  quranTried.value = true
})

const byStage = (n: number) => (cycles.value ?? []).filter(c => c.stage_number === n)
const loading = computed(() => pending.value || (!quran.ready.value && !quranTried.value))

// ── تعديل جزءٍ من التقسيمة ──
const juzOpen = ref(false)
const juzEditing = ref<ProgramJuz | null>(null)
function openJuz(j: ProgramJuz) {
  juzEditing.value = j
  juzOpen.value = true
}

// ── تعديل دورة ──
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<ExamCycle | null>(null)
const form = reactive({ parts_from: '', parts_to: '', surahs_label: '' })

function openEdit(c: ExamCycle) {
  editing.value = c
  Object.assign(form, { parts_from: String(c.parts_from), parts_to: String(c.parts_to), surahs_label: c.surahs_label })
  modalOpen.value = true
}

/** يحوّل نصَّ الخانة إلى عددٍ صحيحٍ في 1–30، وإلا null — مصدرٌ واحدٌ للتحقّق وللحفظ. */
function toJuz(v: string): number | null {
  const n = v.trim() === '' ? Number.NaN : Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null
}

function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  const from = toJuz(s.parts_from)
  const to = toJuz(s.parts_to)
  if (from === null) errors.push({ name: 'parts_from', message: 'رقمٌ صحيحٌ من 1 إلى 30.' })
  if (to === null) errors.push({ name: 'parts_to', message: 'رقمٌ صحيحٌ من 1 إلى 30.' })
  else if (from !== null && from > to) errors.push({ name: 'parts_to', message: 'يجب ألّا يقلّ «إلى» عن «من».' })
  if (!s.surahs_label.trim()) errors.push({ name: 'surahs_label', message: 'وصف السور مطلوب.' })
  return errors
}

async function save() {
  if (!editing.value) return
  const from = toJuz(form.parts_from)
  const to = toJuz(form.parts_to)
  if (from === null || to === null || from > to) return
  saving.value = true
  try {
    const { data, error } = await supabase
      .from('exam_cycles')
      .update({ parts_from: from, parts_to: to, surahs_label: form.surahs_label.trim() })
      .eq('id', editing.value.id)
      .select('id')
    if (error) throw error
    // تحديثٌ لم يمسّ صفّاً (تصفيةُ RLS) ليس نجاحاً
    if (!data?.length) throw new Error('لم يُحفظ التعديل — قد لا تملك هذه الخطوة.')
    toast.add({ title: 'تم تحديث الدورة.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    // رسالةُ القاعدة العربيّة (قيد الاحتواء) تُعرض كما هي
    handle(err)
  } finally {
    saving.value = false
  }
}

const editTitle = computed(() => editing.value
  ? `تعديل ${CYCLE_LABELS[editing.value.cycle_number] ?? ''} — ${STAGE_LABELS[editing.value.stage_number] ?? ''}`
  : 'تعديل الدورة')
</script>

<template>
  <div class="plan">
    <UiPageHeader
      title="خطة الاختبارات"
      subtitle="ثلاث مراحل، لكلٍّ منها خمس دورات؛ والدورة الخامسة تجمع الأربع قبلها. حدودُ كلّ دورةٍ تُحسب من تقسيمة الأجزاء."
    />

    <UiFilterChips
      v-model="tab"
      :options="tabs"
      class="tabs"
    />

    <ClientOnly>
      <template v-if="loading">
        <UiSkeletonTable :columns="[{ key: 'a', label: 'الدورات' }, { key: 'b', label: 'عدد الأجزاء' }, { key: 'c', label: 'وصف السور' }]" />
      </template>
      <template v-else-if="tab === 'plan'">
        <UiStatStrip
          v-if="cycles?.length"
          :items="examPlanStats(cycles)"
          label="أرقام خطة الاختبارات"
        />
        <UiEmptyState
          v-if="!cycles?.length"
          icon="i-lucide-list-ordered"
          title="لا دورات بعد"
          description="لم تُحمَّل دوراتُ الاختبار."
        />
        <template v-else>
          <ExamsPlanStage
            v-for="n in STAGES"
            :key="n"
            :stage="n"
            :cycles="byStage(n)"
            :juz="quran.juz.value"
            :surah-name="quran.surahName"
            :can-edit="isAdmin"
            @edit="openEdit"
          />
          <p
            v-if="!isAdmin"
            class="note"
          >
            الخطةُ للاطّلاع؛ تعديلُها للمدير الإداري.
          </p>
        </template>
      </template>
      <UiEmptyState
        v-else-if="!quran.ready.value"
        icon="i-lucide-triangle-alert"
        title="تعذّر تحميل تقسيمة الأجزاء"
        description="أعد تحميل الصفحة للمحاولة مجدداً."
      />
      <ExamsJuzTable
        v-else
        :juz="quran.juz.value"
        :surah-name="quran.surahName"
        :can-edit="isAdmin"
        @edit="openJuz"
      />
    </ClientOnly>

    <ExamsJuzEditModal
      v-model:open="juzOpen"
      :juz="juzEditing"
      :surahs="quran.surahs.value"
      @saved="quran.reload"
    />

    <UModal
      v-model:open="modalOpen"
      :title="editTitle"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validate"
          class="form"
          @submit="save"
        >
          <div class="row">
            <UFormField
              label="من جزء"
              name="parts_from"
              class="f"
            >
              <UInput
                v-model="form.parts_from"
                type="number"
                min="1"
                max="30"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
            <UFormField
              label="إلى جزء"
              name="parts_to"
              class="f"
            >
              <UInput
                v-model="form.parts_to"
                type="number"
                min="1"
                max="30"
                dir="ltr"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField
            label="وصف السور"
            name="surahs_label"
            help="مثل: المجادلة – الناس"
          >
            <UInput
              v-model="form.surahs_label"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <p class="hint">
            عدّل الدورة الأوسع أوّلاً إن ضيّقت دورةً داخلها.
          </p>
          <div class="form-actions">
            <UButton
              label="إلغاء"
              color="neutral"
              variant="ghost"
              size="lg"
              :ui="{ base: 'rounded-[13px]' }"
              @click="modalOpen = false"
            />
            <UButton
              type="submit"
              label="حفظ التغييرات"
              color="primary"
              size="lg"
              :loading="saving"
              :ui="{ base: 'rounded-[13px] font-semibold' }"
            />
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.tabs { margin-bottom: 18px; }
.hint { margin: 0; font-size: 13.5px; color: var(--ink-2); }
.note { margin: 4px 0 0; font-size: 14px; color: var(--ink-2); }
.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row .f { flex: 1; min-width: 120px; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
