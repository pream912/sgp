// App-chrome i18n foundation. Genni's conversational language lives server-side
// (services/genni/languages.js); this only covers UI strings, so adding a full
// UI translation later is just a new locale file here.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';

i18n.use(initReactI18next).init({
  resources: { en: { common: en } },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
