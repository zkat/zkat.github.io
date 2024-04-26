import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

import { ICampaign, IJournalEntry } from "../_data/campaigns";

const FILE_NAME = "stargazerCampaigns.json";

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
    for (const entry of campaign.journal) {
      await cleanupJournalEntry(entry);
    }
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
  let figure = null;
  for (const el of dom.window.document.body.childNodes) {
    if (el instanceof dom.window.HTMLImageElement) {
      figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = el.src;
      figure.appendChild(img);
      newBody.appendChild(figure);
      continue;
    }
    const text = el.textContent
      .replaceAll(/(&nbsb;|\n|\r|<br>|<\/br>)/gm, "")
      .trim();
    if (text && figure && text.startsWith("((")) {
      const caption = document.createElement("figcaption");
      caption.innerHTML = text
        .replace(
          /^\(\((?:Credit:\s*)?([^)]+?)\s*\)\)/i,
          '<a target="_blank" href="$1">$1</a>'
        )
        .trim();
      figure.appendChild(caption);
      figure = null;
    } else if (text) {
      if (text.startsWith("———")) {
        const hr = document.createElement("hr");
        newBody.appendChild(hr);
      } else if (text.startsWith("[")) {
        if (!currentAction) {
          currentAction = document.createElement("div");
          currentAction.classList.add("action");
          newBody.appendChild(currentAction);
        }
        currentAction.appendChild(
          makeActionItem(document, text.replace(/^\[([^\]]+)\]/, "$1").trim())
        );
      } else {
        if (currentAction) {
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

function makeActionItem(
  document: Document,
  actionText: string
): HTMLDivElement {
  const actionItem = document.createElement("div");
  if (actionText.startsWith("Miss")) {
    actionItem.classList.add("roll", "miss");
  } else if (actionText.startsWith("Weak Hit")) {
    actionItem.classList.add("roll", "weak-hit");
  } else if (actionText.startsWith("Strong Hit")) {
    actionItem.classList.add("roll", "strong-hit");
  }
  if (actionText.toLowerCase().match("with a match")) {
    actionItem.classList.add("match");
  }
  actionItem.textContent = actionText;
  return actionItem;
}
