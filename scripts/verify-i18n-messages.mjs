import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const require = createRequire(import.meta.url);
const messagesPath = path.join(rootDir, "src/i18n/messages.ts");
const source =
  fs.readFileSync(messagesPath, "utf8") +
  "\nexport const __I18N_VERIFY__ = { DEFAULT_MESSAGES, LOCALE_MESSAGES };\n";

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const sandbox = {
  module: { exports: {} },
  exports: {},
  require,
  console
};

vm.runInNewContext(transpiled, sandbox, { filename: "messages.js" });

const exported = sandbox.exports.__I18N_VERIFY__;
const defaults = exported.DEFAULT_MESSAGES;
const localeMessages = exported.LOCALE_MESSAGES;

const criticalPrefixes = [
  "settings.document.class.",
  "settings.sync.",
  "settings.import.",
  "settings.error.",
  "settings.audit.",
  "settings.device.",
  "settings.analytics."
];

const criticalLocales = ["fr-FR", "es-ES", "ja-JP", "ko-KR", "it-IT"];
const placeholderPattern = /\{([a-zA-Z0-9_]+)\}/g;
const failures = [];

function extractPlaceholders(message) {
  return [...message.matchAll(placeholderPattern)].map((match) => match[1]).sort();
}

function samePlaceholders(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

for (const [locale, dictionary] of Object.entries(localeMessages)) {
  for (const [key, message] of Object.entries(dictionary)) {
    const defaultMessage = defaults[key];
    if (!defaultMessage) {
      failures.push(`[${locale}] unknown key override: ${key}`);
      continue;
    }

    const expected = extractPlaceholders(defaultMessage);
    const actual = extractPlaceholders(message);
    if (!samePlaceholders(expected, actual)) {
      failures.push(
        `[${locale}] placeholder mismatch for ${key}: expected {${expected.join(",")}} got {${actual.join(",")}}`
      );
    }
  }
}

const englishMessages = localeMessages["en-US"] ?? {};
for (const locale of criticalLocales) {
  const dictionary = localeMessages[locale] ?? {};
  for (const key of Object.keys(defaults)) {
    if (!criticalPrefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    if (!(key in dictionary)) {
      failures.push(`[${locale}] missing critical translation: ${key}`);
      continue;
    }

    if (dictionary[key] === englishMessages[key]) {
      failures.push(`[${locale}] critical key still falls back to English: ${key}`);
    }
  }
}

if (failures.length > 0) {
  console.error("i18n verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("i18n messages verified.");
