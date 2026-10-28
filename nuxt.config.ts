// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@pinia/nuxt', '@nuxtjs/supabase', '@vite-pwa/nuxt'],

  devtools: {
    enabled: true
  },

  // عربي + RTL بالكامل (مبدأ حاكم في البريف §2)
  app: {
    // انتقال سلس بين الشاشات (تلاشٍ + انزياح خفيف) — أنماط .page-* في main.css
    pageTransition: { name: 'page' },
    head: {
      htmlAttrs: {
        lang: 'ar',
        dir: 'rtl'
      },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // أيقونة PNG مربّعة 192×192 (مضاعف لـ 48px) — شرط جوجل لعرض الأيقونة في نتائج البحث
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        // رابط المانيفست: @vite-pwa/nuxt يولّده لكنه لا يحقن الرابط، فنضيفه هنا ليكتشفه Chrome
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ],
      meta: [
        { name: 'theme-color', content: '#094064' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // النطاق العامّ للموقع (canonical / og:url / sitemap / robots).
  // اضبطه عند معرفة النطاق عبر متغيّر البيئة NUXT_PUBLIC_SITE_URL على Vercel.
  runtimeConfig: {
    // حسابُ رسائل SMS عند MTC — خادميٌّ فقط (NUXT_MTC_SMS_USERNAME / _PASSWORD / _SENDER على Vercel)
    mtcSmsUsername: '',
    mtcSmsPassword: '',
    mtcSmsSender: '',
    // إعادةُ صياغة الرسائل بالذكاء الاصطناعي — خادميٌّ فقط (NUXT_ANTHROPIC_API_KEY على Vercel)
    anthropicApiKey: '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://turjuman.vercel.app'
    }
  },

  routeRules: {
    '/': { prerender: true },
    // حضورُ المعلّم بلا إنترنت (البند 14 — نمطُ الصحابة): يُصيَّر في المتصفّح ويُولَّد مسبقاً ملفّاً يخزّنه عاملُ الخدمة،
    // فيُفتح بلا شبكة (والهيكلُ بلا بيانات — لا يُخبَّأ فيه اسمُ معلّمٍ ولا طلابُه)
    '/t': { ssr: false, prerender: true },
    // والإنجازُ القرآنيّ ولوحةُ المعلّم بلا إنترنت كذلك (2026-10-27)
    '/t/quran': { ssr: false, prerender: true },
    '/t/home': { ssr: false, prerender: true },
    '/t/students': { ssr: false, prerender: true },
    '/t/students/view': { ssr: false, prerender: true },
    // الدفعةُ الأولى من شاشات المعلّم بلا إنترنت (2026-10-27): مشتركةٌ مع الأدوار الأخرى فتُصيَّر في المتصفّح لهم جميعاً
    // (قرار المستخدم)، والبياناتُ من نسخة الجهاز للمعلّم (`useOfflineCopy`)
    '/exam-plan': { ssr: false, prerender: true },
    '/programs': { ssr: false, prerender: true },
    '/visits': { ssr: false, prerender: true },
    '/quality': { ssr: false, prerender: true },
    '/alerts': { ssr: false, prerender: true },
    '/messages': { ssr: false, prerender: true },
    '/profile/me': { ssr: false, prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // الخطوط: في وضع التطوير نعطّل المزوّدات الشبكية ليعمل الخادم دون إنترنت
  // (يتجنّب انهيار vite-node عند انقطاع الشبكة). الإنتاج يبقى كامل المزوّدات.
  fonts: process.env.NODE_ENV !== 'production'
    ? { providers: { google: false, bunny: false, fontshare: false, googleicons: false } }
    : {},

  // أيقوناتُ الوضع في حزمة العميل (2026-10-22): حين تُجلب «moon-star» و«monitor» في طلبٍ واحد يبني @nuxt/icon 2.2.2
  // قاعدةَ الأولى بصورة الثانية فيظهر القمرُ شاشة — والمضمَّنةُ لا تُجلب أصلاً.
  // وكلُّ أيقونات التطبيق في الحزمة منذ 2026-10-26 (الحضورُ بلا إنترنت — بلاغُ المستخدم بلقطة: الأسهمُ والأيقوناتُ
  // غائبةٌ بلا اتصال): كانت تُجلب من الخادم عند العرض فتسقط حين لا شبكة. المسحُ يجمع ما في الشيفرة (نمطُ الصحابة).
  icon: {
    clientBundle: {
      icons: ['lucide:sun', 'lucide:moon-star', 'lucide:monitor'],
      scan: { globInclude: ['app/**/*.{vue,ts}'] },
      sizeLimitKb: 512
    }
  },

  // PWA: التطبيق قابل للتثبيت (مانيفست + service worker لهيكل التطبيق فقط).
  // لا يخزّن استدعاءات Supabase — البيانات تبقى حيّة. النصوص عربية RTL.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'ترجمان',
      short_name: 'ترجمان',
      lang: 'ar',
      dir: 'rtl',
      display: 'standalone',
      // التطبيقُ المثبَّت يُقلع على لوحة المعلّم مباشرةً (طلب المستخدم 2026-10-27؛ وكان على الحضور منذ 2026-10-26)
      // — وهي تعمل بلا اتصال، وغيرُ المعلّم متّصلاً يُحوَّل منها إلى لوحته. `id` ثابتٌ كي يبقى التطبيقُ المثبَّت نفسَه
      id: '/',
      start_url: '/t/home',
      scope: '/',
      theme_color: '#094064',
      background_color: '#FFFFFF',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    // التنقّلُ من الشبكة دائماً إلا `/t`: كانت كلُّ صفحةٍ تُقدَّم من هيكل «/» المحفوظ فيرى المستخدمُ الشاشةَ القديمة
    // بعد كلّ نشر (Hydration mismatch). فالسقوطُ إلى المخزَّن لشاشة حضور المعلّم وحدها (البند 14 — تُصيَّر في
    // المتصفّح فلا هيكلَ خادمٍ يتقادم)، وغيرُها من الشبكة كما كان.
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
      navigateFallback: '/t/home',
      navigateFallbackAllowlist: [
        /^\/t(\/home|\/quran|\/students|\/students\/view)?$/,
        /^\/(exam-plan|programs|visits|quality|alerts|messages|profile\/me)$/
      ],
      // الشاشاتُ المخزَّنة تُطابَق بلا استعلام الرابط (`/quality?y=…&m=…`، `/programs?tab=units`): هياكلُ تُصيَّر في
      // المتصفّح، والاستعلامُ يقرؤه الموجِّه لا الخادم
      ignoreURLParametersMatching: [/.*/],
      // المستخدمُ يفتح الدخولَ واللوحة والحضور: بلا اتصالٍ وحده تُقدَّم شاشةُ المعلّم المخزَّنة بدل صفحة «لا يتوفر
      // اتصال» — ومتّصلاً لا يتغيّر شيء (NetworkOnly)
      runtimeCaching: [
        {
          urlPattern: ({ request, url }: { request: Request, url: URL }) =>
            request.mode === 'navigate' && ['/login', '/dashboard'].includes(url.pathname),
          handler: 'NetworkOnly',
          options: { precacheFallback: { fallbackURL: '/t/home' } }
        },
        {
          urlPattern: ({ request, url }: { request: Request, url: URL }) => request.mode === 'navigate' && url.pathname === '/attendance',
          handler: 'NetworkOnly',
          options: { precacheFallback: { fallbackURL: '/t' } }
        },
        // «الإنجاز القرآني» بلا اتصال: شاشةُ المعلّم المخزَّنة (`/t/quran` نفسُها في الخبيئة فتُقدَّم منها مباشرةً)
        {
          urlPattern: ({ request, url }: { request: Request, url: URL }) => request.mode === 'navigate' && url.pathname === '/reports',
          handler: 'NetworkOnly',
          options: { precacheFallback: { fallbackURL: '/t/quran' } }
        }
      ]
    },
    // فحصُ نسخةٍ جديدة كلَّ ساعة (وعند العودة إلى التبويب — plugins/pwa-update.client.ts)، و autoUpdate يعيد التحميل
    client: {
      periodicSyncForUpdates: 3600
    }
  },

  // Supabase: المفاتيح من .env (SUPABASE_URL / SUPABASE_KEY).
  // redirect معطّل الآن — سنبني حماية المسارات حسب الدور كـ middleware خاص بنا (المهمة 7).
  supabase: {
    redirect: false
  }
})
