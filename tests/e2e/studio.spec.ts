import { expect, test } from "@playwright/test";

test("human and native WebMCP surfaces share the live branch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "The stateful shared-surface scenario runs once on desktop Chromium.",
  );
  await page.addInitScript(() => {
    const tools = new Map<string, unknown>();
    Object.defineProperty(window, "__fenoaTools", { value: tools });
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        async registerTool(
          tool: { name: string },
          options?: { signal?: AbortSignal },
        ) {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener(
            "abort",
            () => tools.delete(tool.name),
            { once: true },
          );
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open local studio" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.goto("/studio/nightfall-fragments");
  await expect(
    page.getByRole("heading", { name: "The Fragments We Keep" }),
  ).toBeVisible();
  await expect(page.locator(".episode-card")).toHaveCount(7);

  await page.locator(".episode-card").nth(1).click();
  await expect(page.getByLabel("Episode hook")).toHaveValue(
    "John finds seventeen missing minutes in every camera on Mercer Street.",
  );
  await page.locator(".episode-card").first().click();
  await expect(page.getByLabel("Episode hook")).toHaveValue(
    "Emma wakes beside a stopped clock with rain inside her coat.",
  );

  const registeredNames = await page.evaluate(() =>
    Array.from(
      (
        window as typeof window & {
          __fenoaTools: Map<string, unknown>;
        }
      ).__fenoaTools.keys(),
    ).sort(),
  );
  expect(registeredNames).toEqual([
    "get_branch_state",
    "get_episode",
    "set_story_constraint",
    "update_episode",
  ]);

  const episode = await page.evaluate(async () => {
    const tool = (
      window as typeof window & {
        __fenoaTools: Map<
          string,
          {
            execute(input: Record<string, unknown>): Promise<{
              content: Array<{ text: string }>;
            }>;
          }
        >;
      }
    ).__fenoaTools.get("get_episode")!;
    const result = await tool.execute({ episodeId: "episode-5" });
    return JSON.parse(result.content[0]!.text) as {
      episode: {
        version: number;
        effects: Record<string, unknown>;
      };
    };
  });

  await page.evaluate(async (currentEpisode) => {
    const tool = (
      window as typeof window & {
        __fenoaTools: Map<
          string,
          { execute(input: Record<string, unknown>): Promise<unknown> }
        >;
      }
    ).__fenoaTools.get("update_episode")!;
    await tool.execute({
      episodeId: "episode-5",
      expectedEpisodeVersion: currentEpisode.version,
      patch: {
        hook: "Emma finds a frame that should not have survived 2:17.",
        effects: currentEpisode.effects,
      },
    });
  }, episode.episode);
  await expect(
    page.getByText("Emma finds a frame that should not have survived 2:17."),
  ).toBeVisible();
  await expect(page.getByText("Agent changed")).toBeVisible();

  const violation = await page.evaluate(async () => {
    const tools = (
      window as typeof window & {
        __fenoaTools: Map<
          string,
          {
            execute(input: Record<string, unknown>): Promise<{
              content: Array<{ text: string }>;
            }>;
          }
        >;
      }
    ).__fenoaTools;
    const readResult = await tools
      .get("get_episode")!
      .execute({ episodeId: "episode-1" });
    const current = JSON.parse(readResult.content[0]!.text) as {
      episode: { version: number; effects: Record<string, unknown> };
    };
    try {
      await tools.get("update_episode")!.execute({
        episodeId: "episode-1",
        expectedEpisodeVersion: current.episode.version,
        patch: {
          effects: {
            ...current.episode.effects,
            participantIds: ["lena"],
          },
        },
      });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : "unknown error";
    }
  });
  expect(violation).toContain("Lena cannot appear before Episode 7");

  await page.locator(".episode-card").first().click();
  await page
    .getByLabel("Episode hook")
    .fill("Emma wakes with rain folded into the lining of her coat.");
  await page.getByRole("button", { name: "Save to branch" }).click();
  await expect(page.locator(".episode-card").first()).toContainText(
    "Emma wakes with rain folded into the lining of her coat.",
  );
  await page.reload();
  await expect(page.locator(".episode-card").first()).toContainText(
    "Emma wakes with rain folded into the lining of her coat.",
  );
});
