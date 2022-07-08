import fallbackLangData from "./locales/en.json";
import percentages from "./locales/percentages.json";
import { ENV } from "./constants";

const COMPLETION_THRESHOLD = 85;

export interface Language {
  code: string;
  label: string;
  rtl?: boolean;
}

export const defaultLang = { code: "en", label: "English" };

const allLanguages: Language[] = [
  { code: "ar-SA", label: "العربية", rtl: true },
  { code: "bg-BG", label: "Български" },
  { code: "ca-ES", label: "Català" },
  { code: "cs-CZ", label: "Česky" },
  { code: "de-DE", label: "Deutsch" },
  { code: "el-GR", label: "Ελληνικά" },
  { code: "es-ES", label: "Español" },
  { code: "eu-ES", label: "Euskara" },
  { code: "fa-IR", label: "فارسی", rtl: true },
  { code: "fi-FI", label: "Suomi" },
  { code: "fr-FR", label: "Français" },
  { code: "he-IL", label: "עברית", rtl: true },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "hu-HU", label: "Magyar" },
  { code: "id-ID", label: "Bahasa Indonesia" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "kab-KAB", label: "Taqbaylit" },
  { code: "kk-KZ", label: "Қазақ тілі" },
  { code: "ko-KR", label: "한국어" },
  { code: "lt-LT", label: "Lietuvių" },
  { code: "lv-LV", label: "Latviešu" },
  { code: "my-MM", label: "Burmese" },
  { code: "nb-NO", label: "Norsk bokmål" },
  { code: "nl-NL", label: "Nederlands" },
  { code: "nn-NO", label: "Norsk nynorsk" },
  { code: "oc-FR", label: "Occitan" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { code: "pl-PL", label: "Polski" },
  { code: "pt-BR", label: "Português Brasileiro" },
  { code: "pt-PT", label: "Português" },
  { code: "ro-RO", label: "Română" },
  { code: "ru-RU", label: "Русский" },
  { code: "sk-SK", label: "Slovenčina" },
  { code: "sv-SE", label: "Svenska" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "uk-UA", label: "Українська" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
].concat([defaultLang]);

export const languages: Language[] = allLanguages
  .sort((left, right) => (left.label > right.label ? 1 : -1))
  .filter(
    (lang) =>
      (percentages as Record<string, number>)[lang.code] >=
      COMPLETION_THRESHOLD,
  );

const TEST_LANG_CODE = "__test__";
if (process.env.NODE_ENV === ENV.DEVELOPMENT) {
  languages.unshift(
    { code: TEST_LANG_CODE, label: "test language" },
    {
      code: `${TEST_LANG_CODE}.rtl`,
      label: "\u{202a}test language (rtl)\u{202c}",
      rtl: true,
    },
  );
}

let currentLang: Language = defaultLang;
let currentLangData = {};

const auxLangDataRoots = Array<string>();
const auxCurrentLangData = Array<Object>();
const auxFallbackLangData = Array<Object>();

export const registerAuxLangData = (root: string) => {
  if (auxLangDataRoots.includes(root)) {
    return;
  }
  auxLangDataRoots.push(root);
  // Assume root contains a fallback locale file
  auxFallbackLangData.push(
    require(/* webpackChunkName: "locales/[request]" */ `${root}/locales/en.json`),
  );
};

export const setLanguage = async (lang: Language) => {
  currentLang = lang;
  document.documentElement.dir = currentLang.rtl ? "rtl" : "ltr";
  document.documentElement.lang = currentLang.code;

  if (lang.code.startsWith(TEST_LANG_CODE)) {
    currentLangData = {};
  } else {
    currentLangData = await import(
      /* webpackChunkName: "locales/[request]" */ `./locales/${currentLang.code}.json`
    );
    // Empty the auxCurrentLangData array
    while (auxCurrentLangData.length > 0) {
      auxCurrentLangData.pop();
    }
    // Fill the auxCurrentLangData array with each locale file found in auxLangDataRoots for this language
    auxLangDataRoots.forEach(async (dataRoot) => {
      // Do not assume auxLangDataRoots[i] contains a locale file for this language
      try {
        const condData = await import(
          /* webpackChunkName: "locales/[request]" */ `${dataRoot}/locales/${currentLang.code}.json`
        );
        if (condData) {
          auxCurrentLangData.push(condData);
        }
      } catch (e) {}
    });
  }
};

export const getLanguage = () => currentLang;

const findPartsForData = (data: any, parts: string[]) => {
  for (let index = 0; index < parts.length; ++index) {
    const part = parts[index];
    if (data[part] === undefined) {
      return undefined;
    }
    data = data[part];
  }
  if (typeof data !== "string") {
    return undefined;
  }
  return data;
};

export const t = (
  path: string,
  replacement?: { [key: string]: string | number },
) => {
  if (currentLang.code.startsWith(TEST_LANG_CODE)) {
    const name = replacement
      ? `${path}(${JSON.stringify(replacement).slice(1, -1)})`
      : path;
    return `\u{202a}[[${name}]]\u{202c}`;
  }

  const parts = path.split(".");
  let translation =
    findPartsForData(currentLangData, parts) ||
    findPartsForData(fallbackLangData, parts);
  const auxData = Array<Object>().concat(
    auxCurrentLangData,
    auxFallbackLangData,
  );
  for (let i = 0; i < auxData.length; i++) {
    translation = translation || findPartsForData(auxData[i], parts);
  }
  if (translation === undefined) {
    throw new Error(`Can't find translation for ${path}`);
  }

  if (replacement) {
    for (const key in replacement) {
      translation = translation.replace(`{{${key}}}`, String(replacement[key]));
    }
  }
  return translation;
};
