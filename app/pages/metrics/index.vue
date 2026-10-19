<script setup lang="ts">
/**
 * دليل المؤشرات والمعادلات (§4.24) — مرجع شفّاف يوثّق كيف يحسب النظام كل رقم.
 * للمدير ومشرف الجودة. أربعة أقسام، كل بطاقة: تعريف + صيغة + كيف تُقرأ + مثال + المصدر.
 * الثوابت القابلة للضبط تُعرض بقيمها الحالية من app_settings.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'دليل المؤشرات — ترجمان' })

const supabase = useSupabaseClient<Database>()

// جلب غير حاجز: الصفحة تعرض قيماً افتراضية معقولة فوراً وتُحدَّث عند وصول الإعدادات
const { data: settings } = useLazyAsyncData('metrics-settings', async () => {
  const { data } = await supabase.from('app_settings').select('pass_mark, target_memorization_pages, default_attendance_days').eq('id', 1).single()
  return data
}, { server: false, default: () => null })

const targetPages = computed(() => settings.value?.target_memorization_pages ?? 30)
const attendanceDays = computed(() => settings.value?.default_attendance_days ?? 26)
const passMark = computed(() => settings.value?.pass_mark ?? 80)

type Card = { title: string, def: string, formula: string, read: string, example: string, source: string }
type Section = { key: string, title: string, icon: string, cards: Card[] }

const sections = computed<Section[]>(() => [
  {
    key: 'perf',
    title: 'أ) مقاييس الأداء',
    icon: 'i-lucide-gauge',
    cards: [
      {
        title: 'درجة الطالب (من 100)',
        def: 'الدرجة الكلّية للطالب في الشهر، مركّبة من مكوّنين.',
        formula: 'الدرجة = (الأكاديمي × 0.75) + (الانتظام × 0.25)\n• الأكاديمي = متوسط( نسبة الحفظ ، نسبة المراجعة )\n   نسبة الحفظ = صفحات الحفظ ÷ الهدف الشهري\n   نسبة المراجعة = صفحات المراجعة ÷ صفحات الحفظ\n• الانتظام = (أيام الدوام الفعلي − الغياب بدون عذر) ÷ أيام الدوام الفعلي',
        read: 'كلّما اقتربت من 100 كان أداء الطالب أعلى. الغياب بعذر لا يُخصم، ولا يُحاسَب على أيام لم تنعقد فيها الحلقة. (أُلغيت النقاط ووُزّع وزنها على المكوّنين.)',
        example: `حفظ ${targetPages.value} صفحة (هدف ${targetPages.value}) ومراجعة ${targetPages.value} ⇒ أكاديمي 100% · انتظام 100% ⇒ الدرجة = 100.`,
        source: 'التقرير الشهري للطالب (صفحات الحفظ/المراجعة، الغياب) + إعدادات المدير.'
      },
      {
        title: 'إنجاز الحلقة (شارة البطاقة)',
        def: 'مؤشّر جامع يقيس مخرجات الطلاب وتنفيذ المعلّم للبرنامج معاً.',
        formula: 'الإنجاز = (متوسط درجات الطلاب × 0.8) + (نسبة الأنشطة المنفّذة × 0.2)\nنسبة الأنشطة = الأنشطة المنفّذة ÷ إجمالي الأنشطة',
        read: 'يجمع جودة الطلاب (80%) مع التزام المعلّم بالأنشطة (20%) في رقم واحد يُبرز على بطاقة الحلقة.',
        example: 'متوسط الطلاب 90 وأنشطة 12/15 (80%) ⇒ الإنجاز = (90×0.8)+(80×0.2) = 88.',
        source: 'متوسط درجات طلاب الحلقة + جدول الأنشطة المصاحبة في التقرير.'
      },
      {
        title: 'نسبة الانتظام',
        def: 'انتظام حضور الطالب خلال الشهر.',
        formula: 'الانتظام = (أيام الدوام الفعلي − الغياب بدون عذر) ÷ أيام الدوام الفعلي × 100',
        read: 'الغياب بعذر لا يُخصم. أيام الدوام الفعلي مقام ثابت يضبطه المدير.',
        example: `${attendanceDays.value} يوم فعلي وغياب بدون عذر يومان ⇒ (${attendanceDays.value}−2)÷${attendanceDays.value} = ${Math.round((attendanceDays.value - 2) / attendanceDays.value * 100)}%.`,
        source: 'حقول الغياب في التقرير + «أيام الدوام الافتراضية» من إعدادات المدير.'
      },
      {
        title: 'التقدير اللفظي وعتباته',
        def: 'ترجمة الدرجة الرقمية إلى تقدير مفهوم.',
        formula: 'ممتاز ≥ 90 · جيد جداً 80–89 · جيد 70–79 · مقبول 60–69 · ضعيف < 60',
        read: 'تُطبَّق على درجة الطالب وعلى إنجاز الحلقة سواء.',
        example: 'درجة 88 ⇒ «جيد جداً». درجة 92 ⇒ «ممتاز».',
        source: 'مشتقّ من الدرجة المحسوبة.'
      },
      {
        title: 'ألوان شارة الإنجاز',
        def: 'لون يعكس مستوى الإنجاز بصريّاً على البطاقات.',
        formula: 'أخضر ≥ 85 · أزرق 70–84 · أحمر < 70',
        read: 'الأخضر إنجاز مرتفع، الأزرق متوسط، الأحمر يحتاج متابعة.',
        example: 'إنجاز 88 ⇒ أخضر. إنجاز 75 ⇒ أزرق. إنجاز 60 ⇒ أحمر.',
        source: 'مشتقّ من رقم الإنجاز.'
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
        formula: 'الشهر المعروض = الشهر الذي أدخله المعلّم في التقرير (آخر شهر معتمد)',
        read: 'لا يُعرض تاريخ اعتماد المشرف، بل الشهر الذي يخصّه التقرير.',
        example: 'تقرير شهر مايو اعتُمد في يونيو ⇒ البطاقة تعرض «مايو».',
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
      },
      {
        title: 'ترتيب لوحة التكريم',
        def: 'ترتيب أفضل الطلاب عبر كل الحلقات.',
        formula: 'الترتيب = تنازليّاً حسب درجة الطالب (نفس معادلة درجة الطالب)',
        read: 'يوحّد المقياس بين الطلاب من حلقات مختلفة.',
        example: 'طالب درجته 96 يسبق طالباً درجته 92.',
        source: 'درجات الطلاب المحسوبة من التقارير.'
      }
    ]
  },
  {
    key: 'consts',
    title: 'د) الثوابت القابلة للضبط',
    icon: 'i-lucide-sliders-horizontal',
    cards: [
      {
        title: 'صفحات الحفظ المستهدفة شهريّاً',
        def: 'الهدف الذي تُقاس عليه نسبة الحفظ.',
        formula: `القيمة الحالية = ${targetPages.value} صفحة (افتراضي 30)`,
        read: 'يضبطها المدير من لوحته؛ تظهر للمعلّم للقراءة فقط.',
        example: `حفظ 24 صفحة من هدف ${targetPages.value} ⇒ نسبة الحفظ = ${Math.round(24 / targetPages.value * 100)}%.`,
        source: 'app_settings.target_memorization_pages'
      },
      {
        title: 'أيام الدوام الافتراضية',
        def: 'مقام حساب نسبة الانتظام.',
        formula: `القيمة الحالية = ${attendanceDays.value} يوم`,
        read: 'ثابتة في كل التقارير؛ تظهر للمعلّم للقراءة فقط.',
        example: `غياب يومين من ${attendanceDays.value} ⇒ انتظام ${Math.round((attendanceDays.value - 2) / attendanceDays.value * 100)}%.`,
        source: 'app_settings.default_attendance_days'
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
