import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.E2E_AUTH_STORAGE, "Set E2E_AUTH_STORAGE to a saved Clerk test session to run signed-in coach flows.");

const resumePath = path.resolve("samples/sample-java-developer-resume.txt");
const jobPath = path.resolve("samples/sample-senior-java-developer-job-description.txt");

async function openCoaches(page: Page) {
  await page.route("**/api/ai/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: true, available: true, model: "test-model", provider: "test-provider" }),
  }));
  await page.goto("/");
  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(resumePath);
  await expect(page.getByText(/readable characters/).first()).toBeVisible();
  await fileInputs.nth(0).setInputFiles(jobPath);
  await expect(page.getByRole("button", { name: "Continue to coaches" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue to coaches" }).click();
  await expect(page.getByText("test-provider connected · test-model")).toBeVisible();
}

test("uploads documents and keeps the two coach histories separate", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body: "## Spring Boot layers\n\n1. **Controller** handles requests.\n2. **Service** contains business logic.\n\nUse `@RestController`.\n\n```java\nreturn service.find();\n```",
  }));
  await openCoaches(page);

  const skillsCoach = page.getByTestId("skills-coach");
  await skillsCoach.getByPlaceholder("Ask a question…").fill("Explain Spring Boot layers");
  await skillsCoach.getByRole("button", { name: "Send" }).click();

  await expect(skillsCoach.getByRole("heading", { name: "Spring Boot layers" })).toBeVisible();
  await expect(skillsCoach.getByRole("list")).toBeVisible();
  await expect(skillsCoach.locator("strong").first()).toHaveText("Controller");
  await expect(skillsCoach.locator("pre code")).toContainText("return service.find();");
  await expect(page.getByTestId("resume-coach").getByText("Spring Boot layers")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await skillsCoach.getByRole("button", { name: "Clear chat" }).click();
  await expect(skillsCoach.getByRole("heading", { name: "Spring Boot layers" })).toHaveCount(0);
  await expect(skillsCoach.getByText("0/12 history messages retained")).toBeVisible();
});

test("stops generation and offers a retry", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.fulfill({ status: 200, contentType: "text/plain", body: "Late answer" }).catch(() => undefined);
  });
  await openCoaches(page);

  const skillsCoach = page.getByTestId("skills-coach");
  await skillsCoach.getByPlaceholder("Ask a question…").fill("Generate a long answer");
  await skillsCoach.getByRole("button", { name: "Send" }).click();
  await expect(skillsCoach.getByRole("button", { name: "Stop" })).toBeVisible();
  await skillsCoach.getByRole("button", { name: "Stop" }).click();
  await expect(skillsCoach.getByText("Generation stopped.")).toBeVisible();
  await expect(skillsCoach.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("start over removes both documents and conversations", async ({ page }) => {
  await openCoaches(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("heading", { name: "Resume", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to coaches" })).toBeDisabled();
});
