import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";
import slugify from "slugify";

import { ICampaign, IImage, IJournalEntry } from "../_data/campaigns";

const WRAP_WIDTH = 100;

const DIRNAME = dirname(fileURLToPath(import.meta.url));

await main();

async function main(): Promise<void> {
  const campaigns: ICampaign[] = (
    await import(join(DIRNAME, "..", "_data", "campaigns.cjs"))
  ).default;
  for (const campaign of campaigns) {
    const journalDir = join(
      DIRNAME,
      "..",
      "export",
      slugify(campaign.name),
      "journals"
    );
    await mkdir(journalDir, { recursive: true });
    for (const journal of campaign.journal) {
      const journalPath = join(journalDir, `${journal.title}.md`);
      await writeFile(journalPath, toMarkdown(journal));
    }
  }
}

function toMarkdown(journal: IJournalEntry): string {
  let md = "---\n";
  md += `title: ${JSON.stringify(journal.title.trim())}\n`;
  if (journal.slugline) {
    md += `slugline: ${JSON.stringify(journal.slugline.trim())}\n`;
  }
  if (journal.image) {
    md += "image:\n";
    md += `  src: ${JSON.stringify(imgSrc(journal.image))}\n`;
    if (journal.image.alt) {
      md += `  alt: ${JSON.stringify(journal.image.alt.trim())}\n`;
    }
    if (journal.image.attribution) {
      md += `  attribution: ${JSON.stringify(
        journal.image.attribution.trim()
      )}\n`;
    }
  }
  md += "---\n\n";
  if (journal.image) {
    md += `![[${imgSrc(journal.image)}|source: ${
      journal.image.attribution
    }]]\n\n`;
  }
  const dom = new JSDOM(journal.content);
  const body = dom.window.document.body;
  for (const child of body.children) {
    md += elementToMarkdown(child);
    md += "\n\n";
  }
  return md;
}

function elementToMarkdown(element: Element): string {
  if (match("hr")) {
    return "***";
  } else if (match("aside.action")) {
    return actionToMarkdown(element);
  } else if (match("p")) {
    return element.textContent.trim();
  }
  function match(selector: string): boolean {
    return element.matches(selector);
  }
}

function actionToMarkdown(element: Element): string {
  const header = element.querySelector(":scope > header");
  let kdl = "```mechanics\n";
  kdl += `move ${JSON.stringify(header.textContent.trim())} {\n`;
  const i = "  ";
  for (const el of element.querySelectorAll(":scope > dl, :scope > p")) {
    if (el.matches("dl.progress")) {
      const score = val(el, ".progress-score");
      const challengeDice = el.querySelectorAll(".challenge-die");
      kdl +=
        i +
        `progress-roll score=${score} vs1=${challengeDice[0].getAttribute(
          "data-value"
        )} vs2=${challengeDice[1].getAttribute("data-value")}\n`;
    } else if (el.matches("dl.roll")) {
      const actionDie = val(el, ".action-die");
      const stat = val(el, ".stat");
      const adds = val(el, ".add");
      const score = val(el, ".total");
      const challengeDice = el.querySelectorAll(".challenge-die");
      kdl +=
        i +
        `roll action=${actionDie} stat=${stat} adds=${adds} vs1=${challengeDice[0].getAttribute(
          "data-value"
        )} vs2=${challengeDice[1].getAttribute("data-value")}\n`;
    } else {
      kdl += i + `- ${JSON.stringify(el.textContent.trim())}\n`;
    }
  }
  kdl += "}\n```";
  return kdl;
  function val(el: Element, selector: string): string {
    return el.querySelector(selector).getAttribute("data-value");
  }
}

function imgSrc(img: IImage): string {
  return img.src.replace("/img/campaigns", "Images/Campaign");
}
