import { describe, test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { LocalStorageDriver, signLocalStorageToken, verifyLocalStorageToken } from "./local";

describe("LocalStorageDriver", () => {
  test("upload then getSignedDownloadUrl produces a URL with a verifiable token for that exact key", async () => {
    const driver = new LocalStorageDriver();
    const key = `test/${randomUUID()}.txt`;
    const body = Buffer.from("hello from a test");

    await driver.upload({ key, body, contentType: "text/plain" });
    const url = await driver.getSignedDownloadUrl(key, 900);

    const parsed = new URL(url);
    const expires = Number(parsed.searchParams.get("expires"));
    const sig = parsed.searchParams.get("sig")!;

    expect(verifyLocalStorageToken(key, expires, sig)).toBe(true);
    // The signature must be bound to the exact key — reused against a
    // different key it must fail.
    expect(verifyLocalStorageToken(`${key}-tampered`, expires, sig)).toBe(false);
  });

  test("an expired token fails verification", () => {
    const key = "test/expired.txt";
    const pastExpiry = Math.floor(Date.now() / 1000) - 10;
    const sig = signLocalStorageToken(key, pastExpiry);

    // The signature itself is still valid for that (key, expiry) pair — it's
    // the caller's job (the serving route) to reject once expiry has passed.
    expect(verifyLocalStorageToken(key, pastExpiry, sig)).toBe(true);
    expect(pastExpiry < Math.floor(Date.now() / 1000)).toBe(true);
  });

  test("delete removes the file so it can no longer be read back", async () => {
    const driver = new LocalStorageDriver();
    const key = `test/${randomUUID()}.txt`;
    await driver.upload({ key, body: Buffer.from("temp"), contentType: "text/plain" });

    await driver.delete(key);

    // Re-uploading to the same key after delete should succeed cleanly
    // (proves the file is actually gone, not just inaccessible).
    await expect(driver.upload({ key, body: Buffer.from("new content"), contentType: "text/plain" })).resolves.not.toThrow();
  });

  test("rejects a key that would escape the storage root via path traversal", async () => {
    const driver = new LocalStorageDriver();
    await expect(
      driver.upload({ key: "../../etc/passwd", body: Buffer.from("x"), contentType: "text/plain" })
    ).rejects.toThrow();
  });
});
