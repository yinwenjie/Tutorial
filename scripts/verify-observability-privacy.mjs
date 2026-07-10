import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const failures = [];

const auditModule = loadTypeScriptModule(
  "src/infrastructure/local-audit-log-repository.ts"
);
const analyticsModule = loadTypeScriptModule("src/domain/product-analytics.ts");
const errorModule = loadTypeScriptModule("src/domain/error-monitoring.ts");

verifyAuditMetadata(auditModule.LocalAuditLogRepository);
verifyAnalyticsProperties(analyticsModule.sanitizeProductAnalyticsProperties);
verifyErrorProperties(errorModule.sanitizeClientErrorProperties);

if (failures.length > 0) {
  console.error("Observability privacy verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Observability privacy boundaries verified.");

function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    crypto: globalThis.crypto
  };

  vm.runInNewContext(transpiled, sandbox, { filename: relativePath });
  return sandbox.exports;
}

function verifyAuditMetadata(LocalAuditLogRepository) {
  const storage = createMemoryStorage();
  const repository = new LocalAuditLogRepository(storage);
  const event = repository.append({
    message: "Widget regression fixture saved.",
    metadata: {
      widgetType: "notes.list",
      note_text: "P1165-NOTE-SENTINEL",
      nested: {
        eventTitle: "P1165-COUNTDOWN-SENTINEL",
        time_zone: "Asia/Shanghai"
      },
      clocks: [{ label: "P1165-CLOCK-SENTINEL" }]
    },
    type: "widget.regression"
  });

  expectEqual(event.metadata.widgetType, "notes.list", "audit should preserve safe widgetType metadata");
  expectEqual(event.metadata.note_text, "[redacted]", "audit should redact note text variants");
  expectEqual(event.metadata.clocks, "[redacted]", "audit should redact full clock config");

  const nested = event.metadata.nested;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    failures.push("audit should preserve safe nested metadata structure");
    return;
  }

  expectEqual(nested.eventTitle, "[redacted]", "audit should redact countdown titles recursively");
  expectEqual(nested.time_zone, "[redacted]", "audit should redact timezone variants recursively");
}

function verifyAnalyticsProperties(sanitizeProductAnalyticsProperties) {
  const properties = sanitizeProductAnalyticsProperties({
    widgetType: "world-clock.list",
    eventTitle: "P1165-COUNTDOWN-SENTINEL",
    notes: ["P1165-NOTE-SENTINEL"],
    timeZone: "Asia/Shanghai"
  });

  expectEqual(properties.widgetType, "world-clock.list", "analytics should preserve allowlisted widgetType");
  expectAbsent(properties, "eventTitle", "analytics should reject countdown titles");
  expectAbsent(properties, "notes", "analytics should reject note content");
  expectAbsent(properties, "timeZone", "analytics should reject timezone config");
}

function verifyErrorProperties(sanitizeClientErrorProperties) {
  const properties = sanitizeClientErrorProperties({
    source: "widget-panel",
    config: { notes: ["P1165-NOTE-SENTINEL"] },
    label: "P1165-CLOCK-SENTINEL",
    targetDate: "2026-12-31"
  });

  expectEqual(properties.source, "widget-panel", "error monitoring should preserve allowlisted source");
  expectAbsent(properties, "config", "error monitoring should reject widget config");
  expectAbsent(properties, "label", "error monitoring should reject clock labels");
  expectAbsent(properties, "targetDate", "error monitoring should reject countdown dates");
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectAbsent(value, key, message) {
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    failures.push(`${message}: found ${key}`);
  }
}
