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
      clocks: [{ label: "P1165-CLOCK-SENTINEL" }],
      publicDocument: { documentTitle: "P1172-TITLE-SENTINEL" },
      public_snapshot: { url: "https://example.com/P1172-URL-SENTINEL" },
      shareToken: "P1172-SHARE-TOKEN-SENTINEL",
      token_hash: "P1172-TOKEN-HASH-SENTINEL",
      documentJson: { groups: ["P1172-DOCUMENT-SENTINEL"] }
    },
    type: "widget.regression"
  });

  expectEqual(event.metadata.widgetType, "notes.list", "audit should preserve safe widgetType metadata");
  expectEqual(event.metadata.note_text, "[redacted]", "audit should redact note text variants");
  expectEqual(event.metadata.clocks, "[redacted]", "audit should redact full clock config");
  expectEqual(event.metadata.publicDocument, "[redacted]", "audit should redact public document payloads");
  expectEqual(event.metadata.public_snapshot, "[redacted]", "audit should redact public snapshot payloads");
  expectEqual(event.metadata.shareToken, "[redacted]", "audit should redact share tokens");
  expectEqual(event.metadata.token_hash, "[redacted]", "audit should redact token hashes");
  expectEqual(event.metadata.documentJson, "[redacted]", "audit should redact serialized documents");

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
    timeZone: "Asia/Shanghai",
    documentTitle: "P1172-TITLE-SENTINEL",
    publicDocument: { groups: [] },
    publicSnapshot: "P1172-SNAPSHOT-SENTINEL",
    shareToken: "P1172-SHARE-TOKEN-SENTINEL",
    tokenHash: "P1172-TOKEN-HASH-SENTINEL"
  });

  expectEqual(properties.widgetType, "world-clock.list", "analytics should preserve allowlisted widgetType");
  expectAbsent(properties, "eventTitle", "analytics should reject countdown titles");
  expectAbsent(properties, "notes", "analytics should reject note content");
  expectAbsent(properties, "timeZone", "analytics should reject timezone config");
  expectAbsent(properties, "documentTitle", "analytics should reject document titles");
  expectAbsent(properties, "publicDocument", "analytics should reject public documents");
  expectAbsent(properties, "publicSnapshot", "analytics should reject public snapshots");
  expectAbsent(properties, "shareToken", "analytics should reject share tokens");
  expectAbsent(properties, "tokenHash", "analytics should reject token hashes");
}

function verifyErrorProperties(sanitizeClientErrorProperties) {
  const properties = sanitizeClientErrorProperties({
    source: "widget-panel",
    config: { notes: ["P1165-NOTE-SENTINEL"] },
    label: "P1165-CLOCK-SENTINEL",
    targetDate: "2026-12-31",
    documentTitle: "P1172-TITLE-SENTINEL",
    publicDocument: { groups: [] },
    publicSnapshot: "P1172-SNAPSHOT-SENTINEL",
    shareToken: "P1172-SHARE-TOKEN-SENTINEL",
    tokenHash: "P1172-TOKEN-HASH-SENTINEL"
  });

  expectEqual(properties.source, "widget-panel", "error monitoring should preserve allowlisted source");
  expectAbsent(properties, "config", "error monitoring should reject widget config");
  expectAbsent(properties, "label", "error monitoring should reject clock labels");
  expectAbsent(properties, "targetDate", "error monitoring should reject countdown dates");
  expectAbsent(properties, "documentTitle", "error monitoring should reject document titles");
  expectAbsent(properties, "publicDocument", "error monitoring should reject public documents");
  expectAbsent(properties, "publicSnapshot", "error monitoring should reject public snapshots");
  expectAbsent(properties, "shareToken", "error monitoring should reject share tokens");
  expectAbsent(properties, "tokenHash", "error monitoring should reject token hashes");
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
