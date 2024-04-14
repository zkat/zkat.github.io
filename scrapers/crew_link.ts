import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as playwright from "playwright";
import inquirer from "inquirer";

import { ICampaign, ICharacter } from "./campaigns";

const FILE_NAME = "crewLinkCampaigns.json";
const CREW_LINK_URL = "https://starforged-crew-link.scottbenton.dev";

if (process.argv.length < 2) {
  console.error("Usage: node crew_link.js email [filter]");
  console.error("  email: crew link email for your account");
  console.error(
    "  filter: Optional regular expression to filter campaigns by name."
  );
  process.exit(1);
} else {
  await main(
    process.argv[2],
    process.argv[3] ? new RegExp(process.argv[3]) : undefined
  );
}

async function main(email: string, filter?: RegExp): Promise<void> {
  const browser = await playwright.firefox.launch({
    headless: false,
    slowMo: 1000,
  });
  const context = await browser.newContext();

  const page = await logIn(context, email);

  const campaigns = await scrapeCampaigns(page, filter);

  await browser.close();

  const destination = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "_data",
    FILE_NAME
  );

  await writeFile(destination, JSON.stringify(campaigns));

  console.error("Wrote campaigns to", destination);
}

async function logIn(
  context: playwright.BrowserContext,
  email: string
): Promise<playwright.Page> {
  const page = await context.newPage();

  await page.goto(CREW_LINK_URL + "/login");

  await page.fill("input[type='email']", email);
  await (await page.$("main .MuiDivider-root ~ .MuiStack-root button")).click();

  const { loginUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "loginUrl",
      message: "Enter the login URL received at the provided email address",
    },
  ]);

  await page.goto(loginUrl);
  await page.waitForURL("**/characters");

  return page;
}

/// Scrapes all campaigns from the crew link site.
async function scrapeCampaigns(
  page: playwright.Page,
  filter?: RegExp
): Promise<ICampaign[]> {
  await page.goto(CREW_LINK_URL + "/campaigns");
  await page.waitForURL("**/campaigns");
  const campaigns: ICampaign[] = [];
  await page.locator("a[href^='/campaigns/']").nth(0).waitFor();
  const campaignLinks = await page.locator("a[href^='/campaigns/']").all();
  for (const campaignLink of campaignLinks) {
    if (
      !filter ||
      filter.test(await campaignLink.locator("p:first-child").textContent())
    ) {
      await page.goto(CREW_LINK_URL + "/campaigns");
      await page.waitForURL("**/campaigns");
      const cpn = await scrapeCampaign(page, campaignLink);
      if (cpn) {
        campaigns.push(cpn);
      }
    }
  }
  return campaigns;
}

/// Scrapes a single campaign from the crew link site.
async function scrapeCampaign(
  page: playwright.Page,
  campaignLink: playwright.Locator
): Promise<ICampaign> {
  const campaign: ICampaign = {
    id: "",
    name: "",
    characters: [],
    journal: [],
    lore: [],
  };

  const campaignUrl = await campaignLink.getAttribute("href");
  campaign.id = campaignUrl.split("/").pop()!;
  campaign.name = await (
    await campaignLink.locator("p:first-child")
  ).textContent();

  await scrapeCharacters(page, campaign);

  return campaign;
}

async function scrapeCharacters(
  page: playwright.Page,
  campaign: ICampaign
): Promise<void> {
  page.goto(
    CREW_LINK_URL + "/campaigns/" + campaign.id + "/gm-screen?tab=characters"
  );
  page.waitForURL("**/gm-screen?tab=characters");
  await page.waitForSelector("h6:has(~ h6):first-child");
  await page.waitForTimeout(5000);

  const characterNames = await page
    .locator("h6:has(~ h6)")
    .evaluateAll((chars) => chars.map((c) => c.textContent));

  for (const c of characterNames) {
    campaign.characters.push({
      name: c,
    });
  }
  console.log("found characters:", campaign.characters);

  page.goto(
    CREW_LINK_URL + "/campaigns/" + campaign.id + "/gm-screen?tab=tracks"
  );
  await page.waitForTimeout(10000);

  const tracksSelector =
    "div:not([class]) > div:not([class]):has(.MuiBox-root h6)";
  const tracks = await page.locator(tracksSelector).all();

  for (const track of tracks) {
    const name = (await track.locator("h6").textContent())
      .replace(/(.*?)'s Vows/, "$1")
      .trim();

    const vows = [];

    const vowDifficulties = await track
      .locator(
        "> .MuiStack-root > .MuiBox-root > :nth-child(1) > :nth-child(1)"
      )
      .evaluateAll((difficulties) => difficulties.map((d) => d.textContent));

    const vowTitles = await track
      .locator(
        "> .MuiStack-root > .MuiBox-root > :nth-child(1) > :nth-child(2)"
      )
      .evaluateAll((titles) => titles.map((t) => t.textContent));

    const vowDescriptions = await track
      .locator(
        "> .MuiStack-root > .MuiBox-root > :nth-child(1) > :nth-child(3)"
      )
      .evaluateAll((descs) => descs.map((d) => d.textContent));

    for (let i = 0; i < vowTitles.length; i++) {
      vows.push({
        name: `${vowTitles[i]}: ${vowDescriptions[i]}`,
        title: vowTitles[i],
        description: vowDescriptions[i],
        difficulty: vowDifficulties[i],
      });
    }

    console.log("setting vows for", name);
    campaign.characters.find((c) => c.name === name)!.vows = vows;
  }
}
