import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type * as Datasworn from "@datasworn/core/dist/Datasworn";

import { JSDOM } from "jsdom";

import { ICampaign, IJournalEntry, ILoreEntry } from "../_data/campaigns";

const FILE_NAME = "stargazerCampaigns.json";

const STARFORGED: Datasworn.RulesPackage = JSON.parse(
  await readFile(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "node_modules",
      "@datasworn/starforged/json/starforged.json"
    ),
    "utf-8"
  )
);

if (process.argv.length < 2) {
  console.error("Usage: tsx stargazer.ts dump [filter]");
  console.error("  dump: path to the Stargazer JSON dump to import from");
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

async function main(dumpPath: string, filter?: RegExp): Promise<void> {
  const campaigns: ICampaign[] = JSON.parse(await readFile(dumpPath, "utf-8"));
  for (const campaign of campaigns) {
    const finalJournal: IJournalEntry[] = [];
    const finalLore: ILoreEntry[] = [];
    for (const entry of campaign.journal) {
      await cleanupJournalEntry(entry);
      if (entry.title.startsWith("00 Lore")) {
        finalLore.push({
          title: entry.title.replace(/^00 Lore\s*-\s*/, ""),
          content: entry.content,
          image: entry.image,
          tags: [],
        });
      } else {
        finalJournal.push(entry);
      }
    }
    campaign.journal = finalJournal;
    campaign.lore = finalLore;
  }

  const destination = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "_data",
    FILE_NAME
  );

  await writeFile(destination, JSON.stringify(campaigns));
}

async function cleanupJournalEntry(entry: IJournalEntry): Promise<void> {
  const dom = new JSDOM(entry.content);
  const newDom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
  const document = newDom.window.document;
  const newBody = newDom.window.document.body;
  let currentAction = null;
  let currentActionName = null;
  for (const el of dom.window.document.body.childNodes) {
    if (el instanceof dom.window.HTMLImageElement) {
      entry.image = {
        src: el.src
      };
      continue;
    }
    const text = el.textContent
      .replaceAll(/(&nbsb;|\n|\r|<br>|<\/br>)/gm, "")
      .trim();
    if (text && entry.image && text.startsWith("((")) {
      const attribution = text
        .replace(/^\(\((?:Credit:\s*)?([^)]+?)\s*\)\)/i, "$1")
        .trim();
      entry.image.attribution = attribution;
    } else if (text) {
      if (text.startsWith("———")) {
        const hr = document.createElement("hr");
        newBody.appendChild(hr);
      } else if (text.startsWith("[")) {
        const actionText = text.replace(/^\[([^\]]+)\]/, "$1").trim();
        const detectedActionName = isMove(actionText) || isAsset(actionText);
        if (
          !currentAction ||
          (detectedActionName &&
            !currentActionName.match(new RegExp(`^${detectedActionName}`, "i")))
        ) {
          currentAction = document.createElement("aside");
          currentActionName = detectedActionName;
          currentAction.classList.add("action");
          newBody.appendChild(currentAction);
          const newItem = makeActionHeader(document, actionText);
          currentAction.appendChild(newItem);
          continue;
        }
        const newItem = makeActionItem(
          document,
          actionText.replace(new RegExp(`^${currentActionName}:?\s*`, "i"), "")
        );
        currentAction.appendChild(newItem);
      } else {
        if (currentAction) {
          currentActionName = null;
          currentAction = null;
        }
        const note = document.createElement("p");
        note.innerHTML =
          el instanceof dom.window.HTMLElement ? el.innerHTML : el.textContent;
        newBody.appendChild(note);
      }
    }
  }
  entry.content = newBody.innerHTML;
}

function makeActionHeader(document: Document, actionText: string): HTMLElement {
  const actionHeader = document.createElement("header");
  actionHeader.textContent = actionText;
  return actionHeader;
}

function makeActionItem(
  document: Document,
  actionText: string
): HTMLDivElement {
  const actionItem = document.createElement("div");
  actionItem.textContent = actionText;
  if (actionText.match(/Miss/i)) {
    actionItem.classList.add("roll", "miss");
  } else if (actionText.match(/Weak Hit/i)) {
    actionItem.classList.add("roll", "weak-hit");
  } else if (actionText.match(/Strong Hit/i)) {
    actionItem.classList.add("roll", "strong-hit");
  }
  if (actionText.match(/with a match/i)) {
    actionItem.classList.add("match");
  }
  return actionItem;
}

function isMove(text: string): string | undefined {
  text = text.toLowerCase();
  for (const category of Object.values(STARFORGED.moves)) {
    for (const move of Object.values(category.contents ?? {})) {
      const name = (move.canonical_name ?? move.name).toLowerCase();
      if (text.startsWith(name)) {
        return name;
      }
    }
  }
}

function isAsset(text: string): string | undefined {
  text = text.toLowerCase();
  for (const collection of Object.values(STARFORGED.assets)) {
    for (const asset of Object.values(collection.contents ?? {})) {
      const name = (asset.canonical_name ?? asset.name).toLowerCase();
      if (text.startsWith(name)) {
        return name;
      }
    }
  }
}
