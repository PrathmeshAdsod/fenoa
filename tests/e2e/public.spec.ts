import { expect, test } from "@playwright/test";

test("public discovery is cinematic and product-led", async ({ page }) => {
  await page.goto("/");
  const featuredHeading = page.getByRole("heading", { level: 1 });
  await expect(featuredHeading).toBeVisible();
  await expect(page.locator(".discovery-hero")).toHaveClass(/has-image/);
  await expect(page.locator(".discovery-hero")).toHaveCSS(
    "background-image",
    /nightfall-cover\.webp/,
  );
  const featuredTitle = (await featuredHeading.innerText()).trim();
  expect(featuredTitle.length).toBeGreaterThan(0);
  await expect(
    page.getByRole("link", { name: /enter this world/i }),
  ).toBeVisible();
  await expect(page.getByText(/ranked by real likes/i)).toBeVisible();
  await page.getByRole("link", { name: /enter this world/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    featuredTitle,
  );
  await expect(page.getByText("People carrying the tension")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /remix this world/i }),
  ).toBeVisible();
});
