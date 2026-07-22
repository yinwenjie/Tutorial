#!/usr/bin/env node

const publicShareEntries = [
  "https://personalhomepge.pages.dev/share/",
  "https://mylinker.net/share/",
  "https://yinwenjie.github.io/PersonalHomepge/share/"
];

const failures = [];

for (const url of publicShareEntries) {
  await verifyPublicShareEntry(url);
}

if (failures.length > 0) {
  console.error("Public home share deployment verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public home share deployment entries verified.");

async function verifyPublicShareEntry(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "mylinker-public-share-deployment-verify"
      },
      redirect: "follow"
    });
  } catch (error) {
    failures.push(`${url} could not be fetched: ${formatError(error)}`);
    return;
  }

  if (response.status !== 200) {
    failures.push(`${url} expected HTTP 200, got HTTP ${response.status}`);
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    failures.push(`${url} expected text/html, got ${contentType || "empty content-type"}`);
    return;
  }

  const body = await response.text();
  for (const directive of ["noindex", "nofollow", "noarchive"]) {
    if (!body.includes(directive)) {
      failures.push(`${url} should include robots directive ${directive}`);
    }
  }

  if (body.includes("#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    || body.includes("p_token")
    || body.includes("token_hash")) {
    failures.push(`${url} should not contain test tokens or database token fields`);
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
