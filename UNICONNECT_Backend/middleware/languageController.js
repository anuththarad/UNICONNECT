const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ta', 'pt', 'si'],
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/translation.json')
    },
    detection: { order: ['cookie', 'querystring'], caches: ['cookie'] },
    interpolation: { escapeValue: false }
  });

const applyLocale = (req, res, next) => {
  const locale = req.user?.locale || req.cookies?.locale || 'en';
  req.locale = locale;
  req.t = i18next.getFixedT(locale);
  next();
};

module.exports = { i18nextMiddleware: middleware.handle(i18next), applyLocale };