import { expect, test } from "@playwright/test";

test("asks anonymous visitors to sign in before uploading documents", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in before adding your documents" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in securely" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("rejects anonymous document and chat API requests", async ({ request }) => {
  const documentResponse = await request.post("/api/documents/extract", { multipart: {} });
  expect(documentResponse.status()).toBe(401);
  await expect(documentResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/sign in/i) });

  const chatResponse = await request.post("/api/chat", { data: {} });
  expect(chatResponse.status()).toBe(401);
  await expect(chatResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/sign in/i) });
});
