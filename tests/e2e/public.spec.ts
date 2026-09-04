import { expect, test } from "@playwright/test";

test("landing is editorial and discovery remains artwork-led", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /create worlds\. let stories branch\./i,
    }),
  ).toBeVisible();
  await expect(page.locator(".world-card")).toHaveCount(0);
  await page.getByRole("link", { name: "Explore Fenoa" }).click();
  await expect(page).toHaveURL(/\?view=discover$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /worlds to enter\. stories to continue\./i,
    }),
  ).toBeVisible();
  const nightfallLink = page.getByRole("link", { name: /Nightfall/ }).first();
  await expect(nightfallLink.locator(".world-card-art")).toHaveClass(
    /has-image/,
  );
  await expect(nightfallLink.locator(".world-card-art")).toHaveCSS(
    "background-image",
    /nightfall-cover\.webp/,
  );
  await expect(page.getByText(/ranked by real likes/i)).toBeVisible();
  await nightfallLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nightfall");
  await expect(page.getByText("People carrying the tension")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /remix this world/i }),
  ).toBeVisible();
});
