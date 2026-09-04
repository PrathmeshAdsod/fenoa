import { expect, test } from "@playwright/test";

test("creator publishes a real world and a remix-of-remix path", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    testInfo.project.name === "mobile",
    "The stateful creator and social loop runs once on desktop Chromium.",
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Open local studio" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.goto("/create");
  await page.getByLabel("World name").fill("The Glass Orchard");
  await page
    .getByLabel("Premise")
    .fill(
      "Every fruit in the orchard contains one future, and harvesting it erases every other path.",
    );
  await page.getByLabel("Genre").fill("Mythic speculative fiction");
  await page.getByLabel("Tone").fill("Luminous, intimate, and irreversible");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Glass Orchard",
  );

  await page.getByRole("button", { name: "Add character" }).click();
  await page.getByRole("button", { name: "Add character" }).click();
  const cast = page.locator(".canvas-cast");
  await cast.getByRole("button", { name: "Edit" }).first().click();
  await cast.getByRole("button", { name: "Edit" }).first().click();
  const names = cast.getByLabel("Name", { exact: true });
  const roles = cast.getByLabel("Role in the world");
  await names.nth(0).fill("Iris Vale");
  await roles
    .nth(0)
    .fill("The orchard keeper who has never harvested a future");
  await names.nth(1).fill("Soren Vale");
  await roles
    .nth(1)
    .fill("Her brother, already fading from every possible path");
  await page.getByRole("button", { name: "Add connection" }).click();
  const connection = page.locator(".connection-item").last();
  await connection.locator("summary").click();
  await connection
    .getByLabel("What connects them")
    .fill(
      "Iris protects Soren by refusing the one future he wants her to choose.",
    );
  await page.getByRole("button", { name: "Add truth" }).click();
  const truth = page.locator(".truth-item").last();
  await truth.locator("summary").click();
  await truth
    .getByLabel("What stays true")
    .fill("Every harvested future permanently erases all alternatives.");
  await page
    .getByPlaceholder(/what kind of story might happen here/i)
    .fill(
      "Soren asks Iris to harvest the only future in which he survives, knowing it will erase the person she becomes in every other path.",
    );
  await page.getByRole("button", { name: "Save canvas" }).click();
  await expect(
    page.getByText("World Canvas · v2", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Publish revision" }).click();
  const worldLink = page.getByRole("link", { name: /view published world/i });
  await expect(worldLink).toBeVisible();
  await worldLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Glass Orchard",
  );

  await page.getByRole("button", { name: /remix this world/i }).click();
  await page.getByLabel("Branch title").fill("The Future Soren Burns");
  await page
    .getByLabel("Creative direction")
    .fill("Follow Soren as he destroys the future Iris would have chosen.");
  await page.getByRole("button", { name: "Open Remix Studio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Future Soren Burns",
  );
  await page.getByRole("button", { name: "Publish remix" }).click();
  const branchLink = page.getByRole("link", { name: /view branch/i });
  await expect(branchLink).toBeVisible();
  await branchLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Future Soren Burns",
  );
  await page.locator(".like-control button").click();
  await expect(page.locator(".like-control button")).toContainText("1");

  await page.getByRole("button", { name: /remix this branch/i }).click();
  await page.getByLabel("Branch title").fill("The Future Iris Remembers");
  await page
    .getByLabel("Creative direction")
    .fill(
      "Continue from Iris's point of view after Soren burns her chosen future.",
    );
  await page.getByRole("button", { name: "Open Remix Studio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Future Iris Remembers",
  );
  await expect(page.getByRole("region", { name: "Episodes" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Reference Story Context/ }),
  ).toBeVisible();

  await page.goto(
    `/u/${process.env.FENOA_SEED_CREATOR_UID || "playwright-user"}`,
  );
  const profileTotals = page.locator(".profile-totals");
  await expect(profileTotals).toContainText("likes received");
  const likes = Number(
    (await profileTotals.getByText(/likes received/).innerText()).match(
      /\d+/,
    )?.[0],
  );
  expect(likes).toBeGreaterThanOrEqual(1);
  await page.getByLabel("Display name").fill("Mara Voss Studio");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("link", { name: "Mara Voss Studio" }),
  ).toBeVisible();
});
