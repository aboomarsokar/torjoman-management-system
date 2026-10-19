<script setup lang="ts">
/**
 * دليل المؤشرات والمعادلات (§4.24) — مرجع شفّاف يوثّق كيف يحسب النظام كل رقم.
 * للمدير ومشرف المشروع. أربعة أقسام، كل بطاقة: تعريف + صيغة + كيف تُقرأ + مثال + المصدر.
 * الثوابت القابلة للضبط تُعرض بقيمها الحالية من app_settings.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'دليل المؤشرات — ترجمان' })

const supabase = useSupabaseClient<Database>()

// جلب غير حاجز: الصفحة تعرض قيماً افتراضية معقولة فوراً وتُحدَّث عند وصول الإعدادات
const { data: settings } = useLazyAsyncData('metrics-settings', async () => {
  const { data } = await supabase.from('app_settings').select('pass_mark, target_memorization_pages').eq('id', 1).single()
  return data
}, { server: false, default: () => null })

const targetPages = computed(() => settings.value?.target_memorization_pages ?? 30)
const passMark = computed(() => settings.value?.pass_mark ?? 80)

type Card = { title: string, def: string, formula: string, read: string, example: string, source: string }
type Section = { key: string, title: string, icon: string, cards: Card[] }

const sections = computed<Section[]>(() => [
  {
    key: 'perf',
    title: 'أ) الإنجاز القرآني',
    icon: 'i-lucide-gauge',
    cards: [
      {
        title: 'المطلوب المقسَّط بالحضور',
        def: 'ما يُطالَب به الطالب في الشهر بعد مراعاة الأيام التي حضرها من أيام حلقته.',
        formula: 'المطلوب = max(1، تقريب( المطلوب الشهريّ × حضر ÷ أيام الحلقة ))\n• أيام الحلقة = الأيام التي انعقدت منذ التحاق الطالب\n• حضر = أيام الحلقة − أيام غيابه (بعذرٍ أو بلا)\n• من لم يحضر يوماً: لا مطلوب عليه\n• من حضر الأيام كلّها: المطلوب كاملاً\n• حلقةٌ لم يُسجَّل لها يومٌ في الشهر: المطلوب كاملاً\n• الشهر 10-2026 وما قبله: المطلوب كاملاً للجميع (رصدُ الحضور بدأ في 19-10-2026)',
        read: 'من حضر ولو يوماً يُطالَب بصفحةٍ على الأقلّ. أيامٌ لم تنعقد فيها الحلقة لا تُحتسب لا له ولا عليه.',
        example: `مطلوب ${targetPages.value} صفحة، وأيام الحلقة 20، وحضر 15 ⇒ المطلوب = ${Math.max(1, Math.round(targetPages.value * 15 / 20))} صفحة.`,
        source: 'app_settings.target_memorization_pages + attendance_days + attendance_absences.'
      },
      {
        title: 'التصنيف (أنجز / مقصّر / لا يُقاس / لم يُرصد)',
        def: 'حكمُ الشهر على الطالب بمقارنة ما حفظه بمطلوبه المقسَّط.',
        formula: 'لم يُرصد: لا سجلَّ له في الشهر\nلا يُقاس: له سجلٌّ ولا مطلوب عليه (لم يحضر يوماً، أو التحق بعد أيام الحلقة في الشهر)\nأنجز: صفحات الحفظ ≥ المطلوب المقسَّط\nمقصّر: صفحات الحفظ < المطلوب المقسَّط',
        read: 'المراجعةُ تُرصد وتُعرض لكنها لا تدخل في الحكم. «لا يُقاس» ليس تقصيراً ولا إنجازاً.',
        example: 'المطلوب المقسَّط 23 وحفظ 25 ⇒ «أنجز»؛ وحفظ 20 ⇒ «مقصّر».',
        source: 'سجلّ الطالب في الشهر (quran_records) + المطلوب المقسَّط.'
      },
      {
        title: 'الأجزاء بتقسيمة البرنامج',
        def: 'عددُ الأجزاء التي أتمّها الطالب بحسب تقسيمة برنامج الحفظ لا تقسيمة المصحف.',
        formula: 'الحفظ من الناس إلى الفاتحة؛ 30 جزءاً على حدود السور مرقّمةً بترتيب الحفظ 30 ← 1\nوصل N من 30 = عدد الأجزاء التي نهايتها ≤ آخر موضعٍ معتمَد\n(الأعلى من ذلك وما كان يحفظه عند التحاقه)\nويُعبَّر عن إنجاز الشهر بالأجزاء على أنّ الجزء عشرون صفحة',
        read: 'يُحتسب المعتمَدُ وحده؛ شهرٌ مسوّدةٌ أو مُرسَلٌ لا يرفع الأجزاء. موضعُ الحفظ يُعرض «اسم السورة آية».',
        example: 'آخر نهايةٍ معتمَدة تتجاوز نهاية الجزء 28 ولا تبلغ نهاية 27 ⇒ «وصل 3 من 30 جزءاً».',
        source: 'program_juz + نهايات quran_records المعتمَدة + الأجزاء المثبتة عند الالتحاق.'
      }
    ]
  },
  {
    key: 'time',
    title: 'ب) الزمن والمنطق',
    icon: 'i-lucide-clock',
    cards: [
      {
        title: 'شهر بطاقة الحلقة',
        def: 'أيّ شهر يمثّله رقم الحلقة المعروض.',
        formula: 'الشهر المعروض = الشهر الذي يخصّه الرصد (آخر شهر معتمد)',
        read: 'لا يُعرض تاريخ اعتماد المشرف، بل الشهر الذي يخصّه التقرير.',
        example: 'رصد شهر 05-2026 اعتُمد في 06-2026 ⇒ البطاقة تعرض «05-2026».',
        source: 'حقل الشهر/السنة في التقرير الشهري.'
      },
      {
        title: 'التقدّم الزمني للطالب',
        def: 'هل الطالب متقدّم/في المسار/متأخّر مقارنةً بالخطة.',
        formula: 'يُقارَن حفظ الطالب الفعلي بالمتوقّع زمنيّاً منذ الالتحاق (مع إيقاف العدّاد أيام الغياب بعذر)',
        read: 'متقدّم = أسرع من المتوقّع · في المسار = مطابق · متأخّر = أبطأ.',
        example: 'متوقّع 10 أجزاء وحفظ 12 ⇒ «متقدّم».',
        source: 'تاريخ الالتحاق + الأجزاء المثبتة + الغياب بعذر.'
      },
      {
        title: 'التزام المشرف بالزيارات',
        def: 'مدى تنفيذ المشرف لزياراته في وقتها.',
        formula: 'الالتزام = (زيارات تمّت في وقتها) ÷ (في وقتها + متأخرة + لم تتم) × 100',
        read: 'المجدولة التي لم يحِن موعدها لا تُحتسب. يُحسب آليّاً من سجلّ زيارات المشرف.',
        example: '6 في وقتها من أصل 8 مستحقّة ⇒ 75%.',
        source: 'جدول الزيارات الإشرافية (الحالة + المواعيد).'
      }
    ]
  },
  {
    key: 'finance',
    title: 'ج) المالية والترتيب',
    icon: 'i-lucide-wallet',
    cards: [
      {
        title: 'الرصيد المتبقّي',
        def: 'رصيد الحساب بعد حركات الشهر.',
        formula: 'الرصيد المتبقّي = الرصيد السابق + الوارد − الصادر',
        read: 'يتراكم شهريّاً؛ كل حركة تعدّل الرصيد التالي.',
        example: 'سابق 1000 + وارد 500 − صادر 300 = 1200.',
        source: 'حركات الملف المالي.'
      }
    ]
  },
  {
    key: 'consts',
    title: 'د) الثوابت القابلة للضبط',
    icon: 'i-lucide-sliders-horizontal',
    cards: [
      {
        title: 'المطلوب الشهريّ (صفحات)',
        def: 'ما يُطالَب به كلُّ طالبٍ حفظاً في الشهر قبل التقسيط بالحضور.',
        formula: `القيمة الحالية = ${targetPages.value} صفحة (افتراضي 30)`,
        read: 'يضبطه المدير من لوحته؛ ويُلتقط عند إنشاء رأس رصد الشهر (أول سجلّ يُحفظ فيه) لا عند الإرسال، فلا يتأثّر شهرٌ بدأ رصدُه بتغييره لاحقاً.',
        example: `حضر الأيام كلّها وحفظ 24 صفحة من مطلوب ${targetPages.value} ⇒ ${24 >= targetPages.value ? '«أنجز»' : '«مقصّر»'}.`,
        source: 'app_settings.target_memorization_pages'
      },
      {
        title: 'علامة اجتياز الاختبار',
        def: 'الحدّ الأدنى لاجتياز اختبار الطالب.',
        formula: `القيمة الحالية = ${passMark.value} من 100`,
        read: 'تُلتقط لقطةً وقت رصد كل اختبار فلا تتأثّر بتغييرها لاحقاً.',
        example: `طالب نال ${passMark.value} ⇒ ناجح؛ أقل ⇒ يعيد.`,
        source: 'app_settings.pass_mark (+ لقطة في كل اختبار)'
      }
    ]
  }
])
</script>

<template>
  <div class="metrics">
    <UiPageHeader
      title="دليل المؤشرات والمعادلات"
      subtitle="مرجع شفّاف يوثّق كيف يحسب النظام كل رقم يعرضه — لرفع الثقة بالأرقام وتوحيد تفسيرها."
    />

    <ClientOnly>
      <section
        v-for="sec in sections"
        :key="sec.key"
        class="section"
      >
        <h2 class="sec-title">
          <UIcon
            :name="sec.icon"
            class="size-5"
          />
          {{ sec.title }}
        </h2>
        <div class="cards">
          <article
            v-for="c in sec.cards"
            :key="c.title"
            class="card metric-card"
          >
            <h3>{{ c.title }}</h3>
            <p class="def">
              {{ c.def }}
            </p>
            <pre class="formula">{{ c.formula }}</pre>
            <div class="kv">
              <span class="k">كيف تُقرأ</span>
              <span class="v">{{ c.read }}</span>
            </div>
            <div class="kv">
              <span class="k">مثال محسوب</span>
              <span class="v">{{ c.example }}</span>
            </div>
            <div class="src">
              <UIcon
                name="i-lucide-database"
                class="size-[13px]"
              />
              {{ c.source }}
            </div>
          </article>
        </div>
      </section>
    </ClientOnly>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }

.section { margin-bottom: 30px; }
.sec-title { display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 700; color: var(--ink); margin: 0 0 16px; }

.cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
.metric-card { padding: 20px 22px; display: flex; flex-direction: column; }
.metric-card h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--ink); }
.def { margin: 8px 0 14px; font-size: 14px; color: var(--ink-2); line-height: 1.7; }

.formula { margin: 0 0 14px; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; line-height: 1.9; color: var(--ink); white-space: pre-wrap; word-break: break-word; direction: rtl; }

.kv { display: flex; flex-direction: column; gap: 3px; margin-bottom: 11px; }
.kv .k { font-size: 12px; font-weight: 700; color: var(--ink-3); }
.kv .v { font-size: 14px; color: var(--ink-2); line-height: 1.7; }

.src { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-3); }

@media (max-width: 820px) { .cards { grid-template-columns: 1fr; } }
</style>
