<script setup lang="ts">
/**
 * صفحة Landing العامّة (§4.0) — الواجهة التعريفية للزوّار قبل الدخول.
 * تعريفية فقط: لا تسجيل ذاتي. مبنيّة بمكوّنات Nuxt UI (UButton/UBadge) حيث يطابق
 * التصميم، وبتخطيط مخصّص للأقسام البصرية الفريدة (Hero/البطاقات) بالتوكنز + RTL.
 * قسم الأخبار يجلب أحدث ٦ أخبار منشورة من وحدة الأخبار (§4.26)؛ السلايدر يعرض
 * ٣ بطاقات في الشاشة الواحدة والباقي بالتمرير (`components/landing/NewsSlider.vue`).
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: false })

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const site = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
const seoTitle = 'ترجمان — حفظ وفهم وعمل'
const seoDesc = 'برنامج قرآني من مؤسسة المرقاة للتعليم والتدريب يجمع بين حفظ كتاب الله وفهمه وتدبّره والعمل به، ويرافق الطالب في رحلته القرآنية عبر حلقات تحفيظ القرآن والبرامج المصاحبة.'

useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogType: 'website',
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: site + '/',
  ogImage: site + '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogSiteName: 'ترجمان',
  ogLocale: 'ar_AR',
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDesc,
  twitterImage: site + '/og-image.png'
})

// canonical + بيانات منظّمة (JSON-LD) تربط الاسم بالعلامة وتفعّل روابط الموقع في نتائج Google
useHead({
  link: [{ rel: 'canonical', href: site + '/' }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOrganization',
          '@id': site + '/#org',
          'name': 'برنامج تُرجمان القرآني',
          'alternateName': ['ترجمان', 'برنامج ترجمان', 'ترجمان القرآني', 'مشروع ترجمان', 'مشروع ترجمان القرآني'],
          'url': site + '/',
          'logo': site + '/icon-512.png',
          'description': seoDesc,
          'parentOrganization': { '@type': 'Organization', 'name': 'مؤسسة المرقاة للتعليم والتدريب' },
          'sameAs': [
            'https://www.facebook.com/Torjomanmrq',
            'https://www.instagram.com/torjomanmrq/',
            'https://x.com/Torjomanmrq',
            'https://t.me/Torjomanmrq'
          ]
        },
        {
          '@type': 'WebSite',
          '@id': site + '/#website',
          'name': 'ترجمان',
          'url': site + '/',
          'inLanguage': 'ar',
          'publisher': { '@id': site + '/#org' }
        }
      ]
    })
  }]
})

/** ركائز المشروع الثلاث. */
const pillars = [
  {
    icon: 'i-lucide-book-open',
    title: 'حِفظ',
    text: 'حفظ متقن لكتاب الله بمتابعة يومية ومراجعة أسبوعية تُثبّت المحفوظ وتصونه.',
    tone: 'neutral'
  },
  {
    icon: 'i-lucide-lightbulb',
    title: 'فَهم',
    text: 'تدبّر المعاني وفهم المقاصد عبر اللقاءات التدبّرية والمقرر التربوي المصاحب.',
    tone: 'blue'
  },
  {
    icon: 'i-lucide-sprout',
    title: 'عَمَل',
    text: 'ترجمة العلم إلى سلوك وقيم تربوية تُعاش في حياة الطالب اليومية.',
    tone: 'green'
  }
]

/** ما يقدّمه المشروع. */
const features = [
  {
    icon: 'i-lucide-users',
    title: 'إدارة الحلقات',
    text: 'حلقة لكل معلم بوقت يومي ثابت، ومتابعة كاملة لطلابها وبرامجها.',
    tone: 'blue'
  },
  {
    icon: 'i-lucide-trending-up',
    title: 'متابعة الطلاب',
    text: 'تتبّع تقدّم كل طالب في الحفظ والمراجعة ونتائج الاختبارات عبر الزمن.',
    tone: 'green'
  },
  {
    icon: 'i-lucide-clipboard-check',
    title: 'الزيارات الإشرافية',
    text: 'جدولة شهرية للزيارات ورفع نتائجها ومتابعة الالتزام بمواعيدها.',
    tone: 'blue'
  },
  {
    icon: 'i-lucide-square-check-big',
    title: 'الاختبار حسب الخطة',
    text: 'يستحقّ الطالب الاختبار عند بلوغ محطته في الخطة، فيرشّحه المعلم، ويُقاس الحفظ والفهم والتدبّر من 100.',
    tone: 'green'
  },
  {
    icon: 'i-lucide-file-text',
    title: 'التقارير الشهرية',
    text: 'رصدٌ شهريٌّ لكل حلقة: ما حفظه كل طالب بالسورة والآية وما راجعه، مقيساً بمطلوبٍ يُقسَّط بحضوره، ثم يُعتمد.',
    tone: 'blue'
  },
  {
    icon: 'i-lucide-heart',
    title: 'البرامج المصاحبة',
    text: 'لقاءات تدبّرية ومراجعة ومقرر تربوي ومحاضرات تُثري رحلة الطالب.',
    tone: 'green'
  }
]

/** أحدث الأخبار المنشورة (§4.26) — قراءة عامّة (RLS يسمح للزوّار بالمنشور). */
const supabase = useSupabaseClient<Database>()
const { data: news } = await useAsyncData('landing-news', async () => {
  const { data } = await supabase
    .from('news')
    .select('id, title, body, category, image_url, news_date')
    .eq('published', true)
    .order('news_date', { ascending: false })
    .limit(6)
  return (data ?? []).map(n => ({
    id: n.id,
    cat: n.category || 'عام',
    date: new Date(n.news_date).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }),
    title: n.title,
    excerpt: n.body || '',
    image: n.image_url
  }))
}, { server: false, default: () => [] })

/** استدارة موحّدة لأزرار الصفحة (لتطابق نظام التصميم). */
const btnUi = { base: 'rounded-[14px] font-semibold' }
</script>

<template>
  <div class="lp">
    <!-- NAV -->
    <header class="nav">
      <div class="nav-in">
        <a
          href="#top"
          class="nav-logo"
        ><img
          src="/brand/turjuman-full.svg"
          alt="ترجمان"
        ></a>
        <nav class="nav-links">
          <a href="#news">الأخبار</a>
          <a href="#about">عن المشروع</a>
          <a href="#pillars">حفظ وفهم وعمل</a>
          <a href="#offer">ماذا يقدّم</a>
          <a href="#contact">تواصل</a>
        </nav>
        <div class="nav-actions">
          <UButton
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            color="neutral"
            variant="subtle"
            size="lg"
            square
            aria-label="تبديل الوضع"
            :ui="{ base: 'rounded-xl' }"
            @click="toggleTheme"
          />
          <UButton
            to="/login"
            label="تسجيل الدخول"
            color="primary"
            size="lg"
            :ui="{ base: 'rounded-xl font-semibold' }"
          />
        </div>
      </div>
    </header>

    <!-- HERO -->
    <section
      id="top"
      class="hero"
    >
      <div class="hero-in">
        <div class="badge">
          <span class="dot" />برنامج قرآني · مؤسسة المرقاة
        </div>
        <img
          src="/brand/turjuman-mark.png"
          alt="شعار ترجمان"
          class="hero-mark"
        >
        <h1 class="hero-title">
          ترجمان
        </h1>
        <div class="hero-pillars">
          <span class="ink">حِفظ</span><span class="sep">·</span>
          <span class="blue">فَهم</span><span class="sep">·</span>
          <span class="green">عَمَل</span>
        </div>
        <p class="hero-sub">
          منظومة تربوية متكاملة تدير حلقات تحفيظ القرآن وترافق الطالب في
          رحلته القرآنية — من حفظ كتاب الله إلى فهمه وتدبّره والعمل به.
        </p>
        <div class="hero-cta">
          <UButton
            to="/login"
            label="تسجيل الدخول"
            color="primary"
            size="xl"
            trailing-icon="i-lucide-chevron-left"
            :ui="btnUi"
          />
          <UButton
            to="#about"
            label="تعرّف على المشروع"
            color="neutral"
            variant="outline"
            size="xl"
            :ui="btnUi"
          />
        </div>
      </div>
    </section>

    <!-- NEWS -->
    <section
      id="news"
      class="band-sec"
    >
      <div class="wrap">
        <div class="sec-head">
          <span class="eyebrow">آخر المستجدّات</span>
          <h2 class="sec-title">
            أخبار ترجمان
          </h2>
        </div>
        <p
          v-if="!news || !news.length"
          class="news-empty"
        >
          لا أخبار منشورة حالياً.
        </p>
        <LandingNewsSlider
          v-else
          :news="news"
        />
      </div>
    </section>

    <!-- ABOUT -->
    <section
      id="about"
      class="wrap about"
    >
      <div>
        <span class="eyebrow">فكرة المشروع</span>
        <h2 class="sec-title big">
          القرآن حفظاً في الصدر، وفهماً في العقل، وعملاً في الحياة
        </h2>
      </div>
      <div>
        <p class="about-text">
          ترجمان مشروع قرآني واقعي يجمع بين حفظ القرآن وفهمه وتدبّره في وحدة
          واحدة لا تنفصل. فالحفظ في الصدر يفتح الباب إلى الفهم في العقل،
          والفهم يثمر تدبّراً يترجم إلى عملٍ وسلوكٍ في الحياة.
        </p>
        <p class="about-text">
          لذلك يرافق ترجمان الطالب عبر برامج مصاحبة طوال رحلته، فلا يكون الحفظ
          غايةً مجرّدة، بل بذرةً تُثمر فهماً وعملاً.
        </p>
        <div class="tags">
          <span class="tag">لقاءات تدبّرية</span><span class="tag">مراجعة أسبوعية</span>
          <span class="tag">مقرر تربوي</span><span class="tag">متابعة القيم</span>
          <span class="tag">مخيمات قرآنية</span>
        </div>
      </div>
    </section>

    <!-- PILLARS -->
    <section
      id="pillars"
      class="band-sec"
    >
      <div class="wrap">
        <div class="sec-head center">
          <span class="eyebrow">ركائز ترجمان الثلاث</span>
          <h2 class="sec-title">
            حفظ وفهم وعمل
          </h2>
        </div>
        <div class="grid3">
          <div
            v-for="p in pillars"
            :key="p.title"
            class="card pillar"
          >
            <div
              class="ico"
              :class="`ico-${p.tone}`"
            >
              <UIcon
                :name="p.icon"
                class="size-7"
              />
            </div>
            <h3 class="card-title">
              {{ p.title }}
            </h3>
            <p class="card-text">
              {{ p.text }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- OFFER -->
    <section
      id="offer"
      class="wrap offer"
    >
      <div class="sec-head center">
        <span class="eyebrow">في خدمة الرحلة</span>
        <h2 class="sec-title">
          كل أداة في خدمة الحفظ والفهم والعمل
        </h2>
        <p class="sec-lede">
          يرعى ترجمان رحلة الطالب من حفظه إلى فهمه إلى عمله، وكل ما فيه من أدوات
          يصبّ في خدمة هذا المعنى.
        </p>
      </div>
      <div class="grid3 features">
        <div
          v-for="f in features"
          :key="f.title"
          class="card feat"
        >
          <div
            class="ico"
            :class="`ico-${f.tone}`"
          >
            <UIcon
              :name="f.icon"
              class="size-[26px]"
            />
          </div>
          <h3 class="card-title sm">
            {{ f.title }}
          </h3>
          <p class="card-text">
            {{ f.text }}
          </p>
        </div>
      </div>
      <div class="roles">
        <div class="roles-label">
          صُمّم ترجمان لكل دور في المنظومة
        </div>
        <div class="roles-chips">
          <span class="role-chip">المدير</span><span class="role-chip">مشرف الجودة</span>
          <span class="role-chip">المشرف</span><span class="role-chip">المعلم</span><span class="role-chip">الطالب</span>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="wrap cta-wrap">
      <div class="cta">
        <img
          src="/brand/turjuman-mark.png"
          alt=""
          class="cta-mark"
        >
        <h2 class="cta-title">
          ابدأ رحلتك مع ترجمان
        </h2>
        <p class="cta-sub">
          سجّل دخولك للوصول إلى لوحتك. الحسابات تُنشأ من قِبل الإدارة — لا تسجيل
          ذاتي.
        </p>
        <UButton
          to="/login"
          label="تسجيل الدخول"
          size="xl"
          color="neutral"
          :ui="{
            base: 'rounded-[14px] font-semibold bg-white text-[#094064] hover:bg-white/90'
          }"
        />
      </div>
    </section>

    <!-- FOOTER -->
    <footer
      id="contact"
      class="footer"
    >
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">
              <img
                src="/brand/turjuman-mark.png"
                alt="ترجمان"
              ><span>ترجمان</span>
            </div>
            <p class="footer-about">
              برنامج قرآني من مؤسسة المرقاة للتعليم والتدريب — حفظ وفهم وعمل.
            </p>
            <div class="footer-parent">
              <span>برعاية</span>
              <img
                src="/brand/morqah-logo.png"
                alt="مؤسسة المرقاة للتعليم والتدريب"
              >
            </div>
          </div>
          <div>
            <div class="footer-h">
              روابط
            </div>
            <div class="footer-links">
              <a href="#about">عن المشروع</a><a href="#pillars">حفظ وفهم وعمل</a>
              <a href="#offer">ماذا يقدّم</a><NuxtLink to="/login">تسجيل الدخول</NuxtLink>
            </div>
          </div>
          <div>
            <div class="footer-h">
              تواصل
            </div>
            <div class="footer-links">
              <span>البريد: torjoman.official@gmail.com</span>
              <span>واتساب: <bdi dir="ltr">+970 594 646 042</bdi></span>
              <span>فلسطين — غزة</span>
            </div>
            <div class="footer-social">
              <a
                href="mailto:torjoman.official@gmail.com"
                target="_blank"
                aria-label="البريد الإلكتروني لترجمان"
              ><UIcon name="i-lucide-mail" /></a>
              <a
                href="https://wa.me/970594646042"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="واتساب ترجمان"
              ><UIcon name="i-simple-icons-whatsapp" /></a>
              <a
                href="https://www.facebook.com/Torjomanmrq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="فيسبوك ترجمان"
              ><UIcon name="i-lucide-facebook" /></a>
              <a
                href="https://www.instagram.com/torjomanmrq/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="إنستغرام ترجمان"
              ><UIcon name="i-lucide-instagram" /></a>
              <a
                href="https://x.com/Torjomanmrq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="حساب ترجمان على إكس"
              ><UIcon name="i-lucide-x" /></a>
              <a
                href="https://t.me/Torjomanmrq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="قناة ترجمان على تيليجرام"
              ><UIcon name="i-simple-icons-telegram" /></a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 ترجمان القرآني — مؤسسة المرقاة للتعليم والتدريب. جميع الحقوق محفوظة.</span>
          <span>حفظ وفهم وعمل</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.lp {
  background: var(--bg);
  color: var(--ink);
}
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding-inline: 28px;
}

/* NAV */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.nav-in {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.nav-logo img {
  height: 54px;
  width: auto;
  filter: var(--logo-filter);
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 30px;
  font-size: 16px;
  font-weight: 500;
  color: var(--ink-2);
}
.nav-links a:hover {
  color: var(--ink);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* HERO */
.hero {
  background: radial-gradient(
    820px 480px at 50% -4%,
    var(--blue-soft),
    transparent 72%
  );
  overflow: hidden;
}
.hero-in {
  max-width: 880px;
  margin: 0 auto;
  padding: 84px 28px 92px;
  text-align: center;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--blue-ink);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow);
}
.badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--green);
}
.hero-mark {
  height: 128px;
  width: auto;
  margin: 30px auto 22px;
  display: block;
  filter: var(--logo-filter);
}
.hero-title {
  margin: 0;
  font-size: clamp(46px, 7vw, 82px);
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.05;
  color: var(--ink);
}
.hero-pillars {
  margin-top: 20px;
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  font-size: clamp(22px, 2.8vw, 32px);
  font-weight: 700;
  flex-wrap: wrap;
}
.hero-pillars .ink {
  color: var(--ink);
}
.hero-pillars .blue {
  color: var(--blue-ink);
}
.hero-pillars .green {
  color: var(--green-ink);
}
.hero-pillars .sep {
  color: var(--ink-3);
  font-weight: 400;
}
.hero-sub {
  margin: 26px auto 0;
  max-width: 620px;
  font-size: clamp(18px, 2vw, 21px);
  line-height: 1.95;
  font-weight: 300;
  color: var(--ink-2);
}
.hero-cta {
  margin-top: 36px;
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

/* أقسام عامّة */
.band-sec {
  background: var(--surface-2);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 80px 0;
}
.eyebrow {
  font-size: 14px;
  font-weight: 600;
  color: var(--blue-ink);
}
.sec-head {
  margin-bottom: 40px;
}
.sec-head.center {
  text-align: center;
  max-width: 640px;
  margin-inline: auto;
}
.sec-title {
  margin: 12px 0 0;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 700;
  color: var(--ink);
}
.sec-title.big {
  line-height: 1.2;
}
.sec-lede {
  margin: 14px 0 0;
  font-size: 19px;
  line-height: 1.9;
  color: var(--ink-2);
  font-weight: 300;
}

/* NEWS */
.news-empty { text-align: center; color: var(--ink-3); font-size: 15px; padding: 20px 0; }

/* ABOUT */
.about {
  padding: 96px 28px;
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 56px;
  align-items: start;
}
.about-text {
  margin: 0;
  font-size: 20px;
  line-height: 2.05;
  color: var(--ink-2);
  font-weight: 300;
}
.about-text + .about-text {
  margin-top: 18px;
}
.tags {
  margin-top: 30px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.tag {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 15px;
  font-weight: 500;
  color: var(--ink-2);
}

/* CARDS / GRID */
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 36px 30px;
  box-shadow: var(--shadow);
}
.card.feat {
  padding: 32px;
  transition: all 0.2s;
}
.card.feat:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--blue-soft);
}
.ico {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
}
.card.feat .ico {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  margin-bottom: 20px;
}
.ico-neutral {
  background: var(--surface-3);
  color: var(--ink);
}
.ico-blue {
  background: var(--blue-soft);
  color: var(--blue-ink);
}
.ico-green {
  background: var(--green-soft);
  color: var(--green-ink);
}
.card-title {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
}
.card-title.sm {
  font-size: 21px;
  margin-bottom: 9px;
}
.card-text {
  margin: 0;
  font-size: 17px;
  line-height: 1.9;
  color: var(--ink-2);
  font-weight: 300;
}
.card.feat .card-text {
  font-size: 16px;
  line-height: 1.85;
}

/* OFFER */
.offer {
  padding: 96px 28px;
}
.roles {
  margin-top: 56px;
  padding: 32px;
  border-radius: 22px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.roles-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}
.roles-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.role-chip {
  height: 38px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line-2);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-2);
}

/* CTA */
.cta-wrap {
  padding: 0 28px 96px;
}
.cta {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  background: var(--band);
  padding: 64px 40px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}
.cta-mark {
  height: 70px;
  width: auto;
  margin: 0 auto 20px;
  display: block;
  filter: brightness(0) invert(1);
  opacity: 0.96;
}
.cta-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  color: var(--band-ink);
}
.cta-sub {
  margin: 16px auto 0;
  max-width: 520px;
  font-size: 18px;
  line-height: 1.9;
  color: var(--band-sub);
  font-weight: 300;
}
.cta :deep(button),
.cta :deep(a) {
  margin-top: 30px;
}

/* FOOTER */
.footer {
  background: var(--surface);
  border-top: 1px solid var(--line);
  padding: 64px 0 28px;
}
.footer-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 48px;
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.footer-brand img {
  height: 46px;
  width: auto;
  filter: var(--logo-filter);
}
.footer-brand span {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
}
.footer-about {
  margin: 0;
  max-width: 340px;
  font-size: 16px;
  line-height: 1.9;
  color: var(--ink-2);
  font-weight: 300;
}
.footer-parent {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--ink-3);
}
.footer-parent img {
  height: 34px;
  width: auto;
  filter: var(--logo-filter);
}
.footer-h {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-3);
  margin-bottom: 18px;
}
.footer-links {
  display: flex;
  flex-direction: column;
  gap: 13px;
  font-size: 16px;
  color: var(--ink-2);
}
.footer-links a:hover {
  color: var(--ink);
}
.footer-social {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}
.footer-social a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--ink-2);
  font-size: 18px;
  transition: all 0.2s;
}
.footer-social a:hover {
  color: var(--blue-ink);
  border-color: var(--blue-soft);
}
.footer-bottom {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--ink-3);
}

/* RESPONSIVE */
@media (max-width: 1024px) {
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 980px) {
  .about {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .grid3 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 860px) {
  .nav-links {
    display: none;
  }
  .footer-grid {
    grid-template-columns: 1fr;
    gap: 34px;
  }
}
@media (max-width: 620px) {
  .features {
    grid-template-columns: 1fr;
  }
  .hero-in {
    padding: 60px 20px 64px;
  }
  .about,
  .offer {
    padding: 64px 22px;
  }
}
</style>
