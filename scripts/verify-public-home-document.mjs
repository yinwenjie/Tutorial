import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const rootDir = process.cwd();
const nodeRequire = createRequire(import.meta.url);
const moduleCache = new Map();
const failures = [];

const homeModule = loadTypeScriptModule("src/domain/home-document.ts");
const publicModule = loadTypeScriptModule("src/domain/public-home-document.ts");

verifyProjection(homeModule, publicModule);
verifyStrictParsing(homeModule, publicModule);
verifyLimits(homeModule, publicModule);

if (failures.length > 0) {
  console.error("Public home document verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public home document projection and validation verified.");

function verifyProjection(home, publicDocument) {
  const source = createFixture(home);
  const result = publicDocument.createPublicHomeDocument(source);
  expectSuccess(result, "complete HomeDocumentV2 should project successfully");
  if (!result.ok) {
    return;
  }

  expectEqual(result.document.version, 1, "public document should use version 1");
  expectEqual(result.document.groups.length, 1, "empty groups should be omitted");
  expectEqual(result.document.groups[0]?.id, "group-1", "internal group id should be replaced");
  expectEqual(result.document.groups[0]?.sites[0]?.id, "site-1-1", "internal site id should be replaced");
  expectEqual(result.document.groups[0]?.sites[0]?.url, "https://example.com/docs?view=public", "site URL should be canonical");
  expectEqual(result.byteSize, new TextEncoder().encode(result.serialized).byteLength, "payload size should use UTF-8 bytes");
  expectTrue(result.byteSize > result.serialized.length, "UTF-8 fixture should be larger in bytes than code units");

  const forbiddenSentinels = [
    "P1172-DOCUMENT-ID-SENTINEL",
    "P1172-GROUP-ID-SENTINEL",
    "P1172-SITE-ID-SENTINEL",
    "P1172-GROUP-KEYWORDS-SENTINEL",
    "P1172-SITE-KEYWORDS-SENTINEL",
    "P1172-WIDGET-SENTINEL",
    "P1172-SYNC-SENTINEL",
    "P1172-ASSET-SENTINEL",
    "P1172-BILLING-SENTINEL"
  ];
  for (const sentinel of forbiddenSentinels) {
    expectFalse(result.serialized.includes(sentinel), `serialized payload should not contain ${sentinel}`);
  }

  const parsed = publicDocument.parsePublicHomeDocument(JSON.parse(result.serialized));
  expectSuccess(parsed, "serialized public document should parse");
  if (parsed.ok) {
    expectEqual(parsed.serialized, result.serialized, "parse and reserialize should be deterministic");
    expectTrue(publicDocument.isPublicHomeDocumentV1(parsed.document), "type guard should accept canonical payload");
  }

  const reordered = {
    groups: result.document.groups.map((group) => ({
      sites: group.sites.map((site) => ({
        order: site.order,
        mark: site.mark,
        url: site.url,
        name: site.name,
        id: site.id
      })),
      order: group.order,
      title: group.title,
      id: group.id
    })),
    theme: {
      accent: result.document.theme.accent,
      presetId: result.document.theme.presetId
    },
    documentTitle: result.document.documentTitle,
    version: result.document.version
  };
  const reorderedResult = publicDocument.parsePublicHomeDocument(reordered);
  expectSuccess(reorderedResult, "property order should not affect parsing");
  if (reorderedResult.ok) {
    expectEqual(reorderedResult.serialized, result.serialized, "property order should not affect canonical serialization");
  }
}

function verifyStrictParsing(home, publicDocument) {
  const projected = publicDocument.createPublicHomeDocument(createFixture(home));
  if (!projected.ok) {
    failures.push("strict parsing fixture could not be projected");
    return;
  }

  const withUnknownField = clone(projected.document);
  withUnknownField.secret = "P1172-UNKNOWN-FIELD";
  expectFailure(
    publicDocument.parsePublicHomeDocument(withUnknownField),
    "invalid-source",
    "unknown document fields should fail"
  );

  const unsupported = clone(projected.document);
  unsupported.version = 2;
  expectFailure(
    publicDocument.parsePublicHomeDocument(unsupported),
    "unsupported-version",
    "unsupported versions should fail"
  );

  const nonCanonicalOrder = clone(projected.document);
  nonCanonicalOrder.groups[0].order = 2;
  expectFailure(
    publicDocument.parsePublicHomeDocument(nonCanonicalOrder),
    "invalid-source",
    "non-contiguous order should fail"
  );

  const nonCanonicalUrl = clone(projected.document);
  nonCanonicalUrl.groups[0].sites[0].url = "https://example.com";
  expectFailure(
    publicDocument.parsePublicHomeDocument(nonCanonicalUrl),
    "invalid-source",
    "non-canonical URLs should fail"
  );

  const unsafeSource = createFixture(home);
  unsafeSource.groups[0].sites[0].url = "https://user:password@example.com/private";
  expectFailure(
    publicDocument.createPublicHomeDocument(unsafeSource),
    "unsafe-url",
    "credential-bearing URLs should fail projection"
  );

  const partiallyInvalidSource = createFixture(home);
  partiallyInvalidSource.groups[0].sites.push({
    id: "internal-invalid-site",
    name: "Invalid site",
    url: "javascript:alert(1)",
    keywords: "",
    mark: "I",
    order: 2
  });
  expectFailure(
    publicDocument.createPublicHomeDocument(partiallyInvalidSource),
    "unsafe-url",
    "invalid sites should block publication instead of being silently filtered"
  );
}

function verifyLimits(home, publicDocument) {
  const emptySource = createFixture(home);
  emptySource.groups = [];
  expectFailure(
    publicDocument.createPublicHomeDocument(emptySource),
    "empty-content",
    "documents without public sites should fail"
  );

  const longNameSource = createFixture(home);
  longNameSource.groups[0].sites[0].name = "n".repeat(81);
  expectFailure(
    publicDocument.createPublicHomeDocument(longNameSource),
    "field-limit-exceeded",
    "overlong site names should fail"
  );

  const tooManyGroupsSource = createFixture(home);
  tooManyGroupsSource.groups = Array.from({ length: 61 }, (_, groupIndex) => createGroup(groupIndex, 1));
  expectFailure(
    publicDocument.createPublicHomeDocument(tooManyGroupsSource),
    "group-limit-exceeded",
    "more than 60 public groups should fail"
  );

  const tooManySitesSource = createFixture(home);
  tooManySitesSource.groups = [createGroup(0, 101)];
  expectFailure(
    publicDocument.createPublicHomeDocument(tooManySitesSource),
    "site-limit-exceeded",
    "more than 100 sites in one group should fail"
  );

  const tooManyTotalSitesSource = createFixture(home);
  tooManyTotalSitesSource.groups = Array.from({ length: 21 }, (_, groupIndex) => createGroup(groupIndex, 100));
  expectFailure(
    publicDocument.createPublicHomeDocument(tooManyTotalSitesSource),
    "site-limit-exceeded",
    "more than 2000 total sites should fail"
  );

  const oversizedPayloadSource = createFixture(home);
  oversizedPayloadSource.groups = Array.from({ length: 20 }, (_, groupIndex) => createGroup(groupIndex, 100, 420));
  expectFailure(
    publicDocument.createPublicHomeDocument(oversizedPayloadSource),
    "payload-too-large",
    "payloads larger than 256 KiB should fail"
  );
}

function createFixture(home) {
  const source = home.createDefaultHomeDocument();
  source.documentId = "P1172-DOCUMENT-ID-SENTINEL";
  source.documentTitle = "公开导航测试";
  source.groups = [{
    id: "P1172-GROUP-ID-SENTINEL",
    title: "公开分组",
    keywords: "P1172-GROUP-KEYWORDS-SENTINEL",
    order: 1,
    sites: [{
      id: "P1172-SITE-ID-SENTINEL",
      name: "公开站点",
      url: "https://example.com/docs?view=public",
      keywords: "P1172-SITE-KEYWORDS-SENTINEL",
      mark: "公",
      order: 1
    }]
  }];
  source.widgets = [{
    id: "widget-public-verification",
    type: "notes.list",
    title: "P1172-WIDGET-SENTINEL",
    order: 1,
    layout: { collapsed: false },
    config: {
      notes: [{
        id: "note-public-verification",
        text: "P1172-WIDGET-SENTINEL",
        order: 1,
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z"
      }]
    }
  }];
  source.theme = {
    ...source.theme,
    bannerUrl: "https://example.com/P1172-ASSET-SENTINEL",
    backgroundUrl: "https://example.com/P1172-ASSET-SENTINEL",
    bannerAsset: {
      source: "external",
      bucket: null,
      path: null,
      url: "https://example.com/P1172-ASSET-SENTINEL",
      contentType: "image/png",
      width: 1200,
      height: 300,
      updatedAt: "2026-07-12T00:00:00.000Z"
    }
  };
  source.syncMeta = {
    mode: "sync-code",
    status: "synced",
    provider: "supabase",
    spaceId: "P1172-SYNC-SENTINEL",
    remoteRevision: 7,
    lastSyncedAt: "2026-07-12T00:00:00.000Z"
  };
  source.billing = {
    plan: "free",
    stripeCustomerId: "P1172-BILLING-SENTINEL"
  };
  return source;
}

function createGroup(groupIndex, siteCount, pathLength = 0) {
  return {
    id: `internal-group-${groupIndex}`,
    title: `Group ${groupIndex + 1}`,
    keywords: "private group keywords",
    order: groupIndex + 1,
    sites: Array.from({ length: siteCount }, (_, siteIndex) => ({
      id: `internal-site-${groupIndex}-${siteIndex}`,
      name: `Site ${siteIndex + 1}`,
      url: `https://example.com/${"p".repeat(pathLength)}${groupIndex}-${siteIndex}`,
      keywords: "private site keywords",
      mark: "S",
      order: siteIndex + 1
    }))
  };
}

function loadTypeScriptModule(relativePath) {
  const normalizedPath = path.normalize(relativePath);
  if (moduleCache.has(normalizedPath)) {
    return moduleCache.get(normalizedPath).exports;
  }

  const source = fs.readFileSync(path.join(rootDir, normalizedPath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const loadedModule = { exports: {} };
  moduleCache.set(normalizedPath, loadedModule);
  const directory = path.dirname(normalizedPath);

  function localRequire(specifier) {
    if (specifier.startsWith("@/")) {
      return loadTypeScriptModule(`src/${specifier.slice(2)}.ts`);
    }

    if (specifier.startsWith(".")) {
      const resolved = path.normalize(path.join(directory, specifier));
      return loadTypeScriptModule(resolved.endsWith(".ts") ? resolved : `${resolved}.ts`);
    }

    return nodeRequire(specifier);
  }

  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require: localRequire,
    console,
    crypto: globalThis.crypto,
    TextEncoder,
    URL
  };

  vm.runInNewContext(transpiled, sandbox, { filename: normalizedPath });
  return loadedModule.exports;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectSuccess(result, message) {
  if (!result?.ok) {
    failures.push(`${message}: got ${formatResult(result)}`);
  }
}

function expectFailure(result, code, message) {
  if (result?.ok || result?.code !== code) {
    failures.push(`${message}: expected ${code}, got ${formatResult(result)}`);
  }
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectTrue(value, message) {
  if (!value) {
    failures.push(message);
  }
}

function expectFalse(value, message) {
  if (value) {
    failures.push(message);
  }
}

function formatResult(result) {
  return JSON.stringify(result?.ok ? { ok: true, byteSize: result.byteSize } : result);
}
