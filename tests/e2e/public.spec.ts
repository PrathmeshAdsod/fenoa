import { expect, test } from "@playwright/test";

test("public discovery is cinematic and product-led", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "seventeen minutes disappear",
  );
  await expect(
    page.getByRole("link", { name: /enter the branch/i }),
  ).toBeVisible();
  await expect(page.getByText(/native WebMCP/i)).toBeVisible();
});
