Deno.test("Phase 1.18 Edge Function test runtime is available", () => {
  if (typeof fetch !== "function" || typeof crypto?.randomUUID !== "function") {
    throw new Error("Expected Deno Web APIs are unavailable.");
  }
});
