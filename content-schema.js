/* =====================================================================
   CONTENT SCHEMA

   Single manifest of every editable text on the site, shared by
   index.html (rendering) and admin.html (the universal content editor).
   Adding a new editable text = adding one entry here; both pages pick it
   up automatically, with no further code changes.

   Resolution priority for a multilingual key (see resolveContentValue):
     1. siteContent.content_i18n[key][lang]   <- saved via admin.html
     2. legacy flat Supabase columns          <- pre-existing hero_/about_ fields
     3. defaults[lang] below                  <- built-in fallback text

   Non-multilingual entries (multilingual: false) are simple single-value
   fields (phone, telegram, instagram, location) stored directly as flat
   Supabase columns, unrelated to language switching.
===================================================================== */

var CONTENT_LANGS = ["ua", "ru", "en"];

var CONTENT_GROUPS = [
  { id: "hero", label: "🏠 Головний екран" },
  { id: "about", label: "👤 Про нас" },
  { id: "services", label: "🎬 Послуги" },
  { id: "portfolio", label: "📸 Портфоліо" },
  { id: "contact", label: "📞 Контакти" },
  { id: "booking", label: "📝 Форма замовлення" },
  { id: "ui", label: "🔘 Кнопки та інтерфейс" }
];

var CONTENT_SCHEMA = [

  /* ---------- HERO ---------- */

  {
    key: "hero_title",
    group: "hero",
    label: "Головний заголовок",
    type: "text",
    legacyFields: { ua: "hero_title_ua", ru: "hero_title_ru", en: "hero_title_en", base: "hero_title" },
    defaults: {
      ua: "Фото та відео, які продають",
      ru: "Фото и видео, которые продают",
      en: "Photo and video that sell"
    }
  },

  {
    key: "hero_text",
    group: "hero",
    label: "Опис під заголовком",
    type: "textarea",
    legacyFields: { ua: "hero_text_ua", ru: "hero_text_ru", en: "hero_text_en", base: "hero_text" },
    defaults: {
      ua: "Створюю стильний фото- та відеоконтент для брендів, бізнесу та соціальних мереж.",
      ru: "Создаю стильный фото- и видеоконтент для брендов, бизнеса и социальных сетей.",
      en: "I create stylish photo and video content for brands, businesses and social media."
    }
  },

  {
    key: "order_button",
    group: "hero",
    label: "Кнопка «Замовити зйомку»",
    type: "text",
    defaults: { ua: "Замовити зйомку", ru: "Заказать съёмку", en: "Book a shoot" }
  },

  {
    key: "portfolio_button_show",
    group: "hero",
    label: "Кнопка портфоліо (закрито)",
    type: "text",
    defaults: { ua: "Дивитися роботи", ru: "Смотреть работы", en: "View works" }
  },

  {
    key: "portfolio_button_hide",
    group: "hero",
    label: "Кнопка портфоліо (відкрито)",
    type: "text",
    defaults: { ua: "Сховати роботи", ru: "Скрыть работы", en: "Hide works" }
  },

  /* ---------- ABOUT ---------- */

  {
    key: "about_title",
    group: "about",
    label: "Заголовок",
    type: "text",
    legacyFields: { ua: "about_title_ua", ru: "about_title_ru", en: "about_title_en", base: "about_title" },
    defaults: { ua: "Що я роблю", ru: "Что я делаю", en: "What I do" }
  },

  {
    key: "about_text",
    group: "about",
    label: "Опис",
    type: "textarea",
    defaults: {
      ua: "Допомагаю бізнесу виглядати професійно в Instagram, TikTok та інших соціальних мережах.",
      ru: "Помогаю бизнесу выглядеть профессионально в Instagram, TikTok и других социальных сетях.",
      en: "I help businesses look professional on Instagram, TikTok and other social media."
    }
  },

  /* ---------- SERVICES ---------- */

  {
    key: "service1_title",
    group: "services",
    label: "Послуга 1 — заголовок",
    type: "text",
    defaults: { ua: "📸 Фото", ru: "📸 Фото", en: "📸 Photo" }
  },

  {
    key: "service1_text",
    group: "services",
    label: "Послуга 1 — опис",
    type: "textarea",
    defaults: {
      ua: "Предметна, lifestyle та контент-зйомка для вашого бренду.",
      ru: "Предметная, lifestyle и контент-съёмка для вашего бренда.",
      en: "Product, lifestyle and content photography for your brand."
    }
  },

  {
    key: "service2_title",
    group: "services",
    label: "Послуга 2 — заголовок",
    type: "text",
    defaults: { ua: "🎥 Відео", ru: "🎥 Видео", en: "🎥 Video" }
  },

  {
    key: "service2_text",
    group: "services",
    label: "Послуга 2 — опис",
    type: "textarea",
    defaults: {
      ua: "Короткі відео та Reels, які привертають увагу.",
      ru: "Короткие видео и Reels, которые привлекают внимание.",
      en: "Short videos and Reels that grab attention."
    }
  },

  {
    key: "service3_title",
    group: "services",
    label: "Послуга 3 — заголовок",
    type: "text",
    defaults: { ua: "📱 Контент", ru: "📱 Контент", en: "📱 Content" }
  },

  {
    key: "service3_text",
    group: "services",
    label: "Послуга 3 — опис",
    type: "textarea",
    defaults: {
      ua: "Готовий контент для Instagram, TikTok та реклами.",
      ru: "Готовый контент для Instagram, TikTok и рекламы.",
      en: "Ready-to-use content for Instagram, TikTok and ads."
    }
  },

  /* ---------- PORTFOLIO ---------- */

  {
    key: "portfolio_title",
    group: "portfolio",
    label: "Заголовок розділу",
    type: "text",
    defaults: { ua: "Портфоліо", ru: "Портфолио", en: "Portfolio" }
  },

  {
    key: "portfolio_text",
    group: "portfolio",
    label: "Опис розділу",
    type: "textarea",
    defaults: {
      ua: "Приклади робіт та візуального контенту.",
      ru: "Примеры работ и визуального контента.",
      en: "Examples of work and visual content."
    }
  },

  {
    key: "portfolio_toggle_show",
    group: "portfolio",
    label: "Кнопка «Показати роботи»",
    type: "text",
    defaults: { ua: "Показати роботи", ru: "Показать работы", en: "Show works" }
  },

  {
    key: "portfolio_placeholder",
    group: "portfolio",
    label: "Текст-заглушка",
    type: "textarea",
    defaults: {
      ua: "Тут можна розмістити твої фотографії, відео та Reels.",
      ru: "Здесь можно разместить твои фотографии, видео и Reels.",
      en: "Your photos, videos and Reels can go here."
    }
  },

  /* ---------- CONTACT ---------- */

  {
    key: "contact_title",
    group: "contact",
    label: "Заголовок розділу",
    type: "text",
    defaults: { ua: "Контакти", ru: "Контакты", en: "Contacts" }
  },

  {
    key: "contact_text",
    group: "contact",
    label: "Опис розділу",
    type: "textarea",
    defaults: {
      ua: "Зв'яжіться зі мною для обговорення зйомки.",
      ru: "Свяжитесь со мной для обсуждения съёмки.",
      en: "Get in touch to discuss your shoot."
    }
  },

  {
    key: "contact_error",
    group: "contact",
    label: "Помилка завантаження контактів",
    type: "text",
    defaults: {
      ua: "Контакти тимчасово недоступні.",
      ru: "Контакты временно недоступны.",
      en: "Contacts are temporarily unavailable."
    }
  },

  {
    key: "contact_empty",
    group: "contact",
    label: "Контакти ще не додані",
    type: "text",
    defaults: {
      ua: "Контактна інформація поки не додана.",
      ru: "Контактная информация пока не добавлена.",
      en: "Contact information hasn't been added yet."
    }
  },

  {
    key: "phone",
    group: "contact",
    label: "Телефон",
    type: "text",
    multilingual: false,
    flatField: "phone"
  },

  {
    key: "telegram",
    group: "contact",
    label: "Telegram",
    type: "text",
    multilingual: false,
    flatField: "telegram"
  },

  {
    key: "instagram",
    group: "contact",
    label: "Instagram",
    type: "text",
    multilingual: false,
    flatField: "instagram"
  },

  {
    key: "location",
    group: "contact",
    label: "Локація",
    type: "text",
    multilingual: false,
    flatField: "location"
  },

  /* ---------- BOOKING FORM ---------- */

  {
    key: "booking_modal_title",
    group: "booking",
    label: "Заголовок форми",
    type: "text",
    defaults: { ua: "Замовити зйомку", ru: "Заказать съёмку", en: "Book a shoot" }
  },

  {
    key: "form_label_name",
    group: "booking",
    label: "Підпис поля «Ім'я»",
    type: "text",
    defaults: { ua: "Ім'я", ru: "Имя", en: "Name" }
  },

  {
    key: "form_placeholder_name",
    group: "booking",
    label: "Placeholder поля «Ім'я»",
    type: "text",
    defaults: { ua: "Ваше ім'я", ru: "Ваше имя", en: "Your name" }
  },

  {
    key: "form_label_phone",
    group: "booking",
    label: "Підпис поля «Телефон»",
    type: "text",
    defaults: { ua: "Телефон", ru: "Телефон", en: "Phone" }
  },

  {
    key: "form_label_date",
    group: "booking",
    label: "Підпис поля «Дата»",
    type: "text",
    defaults: { ua: "Дата зйомки", ru: "Дата съёмки", en: "Shoot date" }
  },

  {
    key: "form_label_service",
    group: "booking",
    label: "Підпис поля «Послуга»",
    type: "text",
    defaults: { ua: "Послуга", ru: "Услуга", en: "Service" }
  },

  {
    key: "form_option_photo",
    group: "booking",
    label: "Опція «Фото»",
    type: "text",
    defaults: { ua: "Фото", ru: "Фото", en: "Photo" }
  },

  {
    key: "form_option_video",
    group: "booking",
    label: "Опція «Відео»",
    type: "text",
    defaults: { ua: "Відео", ru: "Видео", en: "Video" }
  },

  {
    key: "form_option_photo_video",
    group: "booking",
    label: "Опція «Фото + відео»",
    type: "text",
    defaults: { ua: "Фото + відео", ru: "Фото + видео", en: "Photo + video" }
  },

  {
    key: "form_option_content",
    group: "booking",
    label: "Опція «Контент для соцмереж»",
    type: "text",
    defaults: { ua: "Контент для соцмереж", ru: "Контент для соцсетей", en: "Social media content" }
  },

  {
    key: "form_label_comment",
    group: "booking",
    label: "Підпис поля «Коментар»",
    type: "text",
    defaults: { ua: "Коментар", ru: "Комментарий", en: "Comment" }
  },

  {
    key: "form_placeholder_comment",
    group: "booking",
    label: "Placeholder поля «Коментар»",
    type: "textarea",
    defaults: {
      ua: "Розкажіть коротко про вашу задачу...",
      ru: "Расскажите коротко о вашей задаче...",
      en: "Briefly describe what you need..."
    }
  },

  {
    key: "form_submit",
    group: "booking",
    label: "Кнопка відправки",
    type: "text",
    defaults: { ua: "Відправити заявку", ru: "Отправить заявку", en: "Send request" }
  },

  {
    key: "form_submitting",
    group: "booking",
    label: "Кнопка під час відправки",
    type: "text",
    defaults: { ua: "Відправляємо...", ru: "Отправляем...", en: "Sending..." }
  },

  {
    key: "form_error_required",
    group: "booking",
    label: "Помилка: не заповнені поля",
    type: "text",
    defaults: {
      ua: "❌ Вкажіть ім'я та телефон.",
      ru: "❌ Укажите имя и телефон.",
      en: "❌ Please enter your name and phone number."
    }
  },

  {
    key: "form_success",
    group: "booking",
    label: "Повідомлення про успіх",
    type: "textarea",
    defaults: {
      ua: "✅ Заявку успішно відправлено! Я зв'яжуся з вами.",
      ru: "✅ Заявка успешно отправлена! Я свяжусь с вами.",
      en: "✅ Request sent successfully! I'll be in touch."
    }
  },

  {
    key: "form_error_generic",
    group: "booking",
    label: "Загальна помилка відправки",
    type: "textarea",
    defaults: {
      ua: "❌ Не вдалося відправити заявку. Спробуйте ще раз.",
      ru: "❌ Не удалось отправить заявку. Попробуйте ещё раз.",
      en: "❌ Couldn't send the request. Please try again."
    }
  },

  /* ---------- UI / MISC ---------- */

  {
    key: "admin_button",
    group: "ui",
    label: "Кнопка адмін-панелі",
    type: "text",
    defaults: { ua: "⚙ Адмін", ru: "⚙ Админ", en: "⚙ Admin" }
  },

  {
    key: "admin_telegram_only_alert",
    group: "ui",
    label: "Попередження (адмінка поза Telegram)",
    type: "textarea",
    defaults: {
      ua: "Адмін-панель потрібно відкривати всередині Telegram.",
      ru: "Админ-панель нужно открывать внутри Telegram.",
      en: "The admin panel must be opened inside Telegram."
    }
  },

  {
    key: "footer_brand",
    group: "ui",
    label: "Назва бренду у футері",
    type: "text",
    defaults: { ua: "Мобілограф", ru: "Мобилограф", en: "Mobilographer" }
  }

];


/* =====================================================================
   RESOLUTION HELPERS

   Used by index.html to render the site and by admin.html to seed its
   editor with the value that is *currently actually shown on the site*
   for each language, before the admin changes anything.
===================================================================== */

function resolveContentValue(siteContent, schemaItem, lang) {

  siteContent = siteContent || {};

  var i18n = siteContent.content_i18n;

  if (
    i18n &&
    i18n[schemaItem.key] &&
    i18n[schemaItem.key][lang] !== null &&
    i18n[schemaItem.key][lang] !== undefined &&
    i18n[schemaItem.key][lang] !== ""
  ) {
    return i18n[schemaItem.key][lang];
  }

  var legacy = schemaItem.legacyFields;

  if (legacy) {

    var legacyKey = legacy[lang];

    if (legacyKey && siteContent[legacyKey]) {
      return siteContent[legacyKey];
    }

  }

  if (schemaItem.defaults && schemaItem.defaults[lang]) {
    return schemaItem.defaults[lang];
  }

  /* Base (non-suffixed) legacy field is the lowest-priority fallback for
     EVERY language, not just "ua" - otherwise a populated base field
     (e.g. hero_title) would shadow the correct ru/en default text
     whenever hero_title_ru/hero_title_en are not set in Supabase. */
  if (legacy && legacy.base && siteContent[legacy.base]) {
    return siteContent[legacy.base];
  }

  return "";

}


function getContentSchemaByKey(key) {

  for (var i = 0; i < CONTENT_SCHEMA.length; i++) {
    if (CONTENT_SCHEMA[i].key === key) {
      return CONTENT_SCHEMA[i];
    }
  }

  return null;

}


function getMultilingualContentSchema() {

  return CONTENT_SCHEMA.filter(function (item) {
    return item.multilingual !== false;
  });

}


function getFlatContentSchema() {

  return CONTENT_SCHEMA.filter(function (item) {
    return item.multilingual === false;
  });

}


/* =====================================================================
   MEDIA BLOCKS

   The real, existing visual sections of index.html that a background
   image/gif/video can be attached to - not every CONTENT_GROUPS entry
   qualifies: "booking" is a modal, not a page section, and "ui" is a
   floating button, so neither is a background candidate. "footer" has
   no text group of its own but is a real section, so it's added here.

   Media is language-independent (one upload serves UA/RU/EN) and is
   stored separately from text, at content_i18n.media.blocks.<id>, kept
   in sync by api/media-commit.js. Adding a 7th block later is one entry
   here, same pattern as CONTENT_SCHEMA.
===================================================================== */

var MEDIA_BLOCKS = [
  { id: "hero", label: "🏠 Головний екран" },
  { id: "about", label: "👤 Про нас" },
  { id: "services", label: "🎬 Послуги" },
  { id: "portfolio", label: "📸 Портфоліо" },
  { id: "contact", label: "📞 Контакти" },
  { id: "footer", label: "🔻 Footer" }
];


function getMediaBlockById(id) {

  for (var i = 0; i < MEDIA_BLOCKS.length; i++) {
    if (MEDIA_BLOCKS[i].id === id) {
      return MEDIA_BLOCKS[i];
    }
  }

  return null;

}


function resolveBlockMedia(siteContent, blockId) {

  var media = siteContent && siteContent.content_i18n && siteContent.content_i18n.media;
  var blocks = media && media.blocks;

  return (blocks && blocks[blockId]) || null;

}


/* Lets this same file be require()'d from serverless functions (so the
   block list has one source of truth instead of being duplicated
   server-side) while still working exactly as before as a plain
   <script> global in index.html/admin.html - browsers never define
   "module", so this block is a no-op there. */
if (typeof module !== "undefined" && module.exports) {

  module.exports = {
    CONTENT_LANGS: CONTENT_LANGS,
    CONTENT_GROUPS: CONTENT_GROUPS,
    CONTENT_SCHEMA: CONTENT_SCHEMA,
    MEDIA_BLOCKS: MEDIA_BLOCKS,
    resolveContentValue: resolveContentValue,
    getContentSchemaByKey: getContentSchemaByKey,
    getMultilingualContentSchema: getMultilingualContentSchema,
    getFlatContentSchema: getFlatContentSchema,
    getMediaBlockById: getMediaBlockById,
    resolveBlockMedia: resolveBlockMedia
  };

}
