import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import slugify from "slugify";

import type * as Datasworn from "@datasworn/core/dist/Datasworn";

import type { ReadableStream } from "node:stream/web";

import { JSDOM } from "jsdom";

import {
  ICampaign,
  IFaction,
  IJournalEntry,
  ILoreEntry,
  IRoll,
} from "../_data/campaigns";

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
    for (const faction of campaign.factions) {
      finalLore.push(await loreFromFaction(faction));
    }
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
  for (const child of dom.window.document.body.childNodes) {
    const nodes =
      [...child.textContent.matchAll(/\[/g)].length > 1
        ? child.childNodes
        : [child];
    for (const el of nodes) {
      if (el instanceof dom.window.HTMLImageElement) {
        entry.image = {
          src: await imageToFile(entry.title, el.src),
        };
        continue;
      }
      const text = el.textContent
        .replaceAll(/(&nbsp;|\n|\r|<br>|<\/br>)/gm, "")
        .trim();
      if (text && entry.image && text.startsWith("((")) {
        const attribution = text
          .replace(/^\(\((?:Credit:\s*)?([^)]+?)\s*\)\).*/i, "$1")
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
              !currentActionName.match(
                new RegExp(`^${detectedActionName}`, "i")
              ))
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
            actionText.replace(
              new RegExp(`^${currentActionName}:?\s*`, "i"),
              ""
            )
          );
          currentAction.appendChild(newItem);
        } else {
          if (currentAction) {
            currentActionName = null;
            currentAction = null;
          }
          const note = document.createElement("p");
          note.innerHTML =
            el instanceof dom.window.HTMLElement
              ? el.innerHTML
              : el.textContent;
          newBody.appendChild(note);
        }
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
): HTMLParagraphElement | HTMLDListElement {
  const roll = parseRoll(actionText);
  if (roll) {
    const actionItem = document.createElement("dl");
    actionItem.classList.add("roll");
    let outcome;
    const actionScore = roll.action + roll.stat + roll.add;
    if (actionScore > roll.challenge1 && actionScore > roll.challenge2) {
      actionItem.classList.add("strong-hit");
      outcome = "Strong Hit";
    } else if (actionScore > roll.challenge1 || actionScore > roll.challenge2) {
      actionItem.classList.add("weak-hit");
      outcome = "Weak Hit";
    } else {
      actionItem.classList.add("miss");
      outcome = "Miss";
    }
    if (roll.challenge1 === roll.challenge2) {
      actionItem.classList.add("match");
      outcome += " With a Match";
    }
    actionItem.innerHTML = `
      <dt>Action</dt>
      <dd class="action-die" data-value="${roll.action}">${roll.action}</dd>
      <dt>Stat</dt>
      <dd class="stat" data-value="${roll.stat}">${roll.stat}</dd>
      <dt>Add</dt>
      <dd class="add" data-value="${roll.add}">${roll.add}</dd>
      <dt>Total</dt>
      <dd class="total" data-value="${roll.action + roll.stat + roll.add}">${roll.action + roll.stat + roll.add}</dd>
      <dt>Challenge Die 1</dt>
      <dd class="challenge-die" data-value="${roll.challenge1}">${roll.challenge1}</dd>
      <dt>Challenge Die 2</dt>
      <dd class="challenge-die" data-value="${roll.challenge2}">${roll.challenge2}</dd>
      <dt>Outcome</dt>
      <dd class="outcome">${outcome}</dd>
    `;
    return actionItem;
  } else {
    const actionItem = document.createElement("p");
    actionItem.classList.add("action-item");
    actionItem.textContent = actionText;
    return actionItem;
  }
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

async function loreFromFaction(faction: IFaction): Promise<ILoreEntry> {
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
  const doc = dom.window.document;
  const table = doc.createElement("table");
  table.classList.add("faction-traits");
  doc.body.appendChild(table);
  const rows = [
    ["Type", faction.type],
    ["Influence", faction.influence],
    ["Leadership", faction.leadership],
    ["Sphere", faction.sphere],
    ["Projects", faction.projects],
    ["Relationships", faction.relationships],
    ["Quirks", faction.quirks],
    ["Rumors", faction.rumors],
  ];
  for (const [label, content] of rows) {
    if (!content) {
      continue;
    }
    const row = doc.createElement("tr");
    const labelCell = doc.createElement("td");
    labelCell.textContent = label;
    const contentCell = doc.createElement("td");
    contentCell.textContent = content;
    row.appendChild(labelCell);
    row.appendChild(contentCell);
    table.appendChild(row);
  }
  const notes = doc.createElement("article");
  notes.classList.add("faction-notes");
  doc.body.appendChild(notes);
  let img: string | undefined;
  let credit: string | undefined;
  for (const paragraph of faction.notes
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => !!p)) {
    if (paragraph.match(/^\(\(image:/i)) {
      img = paragraph.replace(/^\(\(Image:\s*([^)]+?)\s*\)\).*/i, "$1").trim();
    } else if (paragraph.match(/\(\(credit:/i)) {
      credit = paragraph
        .replace(/^\(\(Credit:\s*([^)]+?)\s*\)\).*/i, "$1")
        .trim();
    } else {
      const notesParagraph = doc.createElement("p");
      notesParagraph.textContent = paragraph;
      notes.appendChild(notesParagraph);
    }
  }
  return {
    title: `Faction: ${faction.name}`,
    content: dom.window.document.body.innerHTML,
    tags: ["faction"],
    image: img && {
      src: await imageToFile(faction.name, img),
      attribution: credit,
    },
  };
}

async function imageToFile(name: string, imgUri: string): Promise<string> {
  if (imgUri.startsWith("data:")) {
    const [base, data] = imgUri.split(",");
    const ext = base.replace(/.*?image\/([a-zA-Z0-9]+).*/, ".$1");
    const newUri = join("img", "campaigns", `${slug(name)}${ext}`);
    const imgPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "content",
      newUri
    );
    await mkdir(dirname(imgPath), { recursive: true });
    await writeFile(imgPath, Buffer.from(data, "base64"));
    return join("/", newUri);
  } else {
    const filename = basename(imgUri);
    const newUri = join("img", "campaigns", filename);
    const imgPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "content",
      newUri
    );
    await mkdir(dirname(imgPath), { recursive: true });
    const req = await fetch(imgUri);
    const fileStream = createWriteStream(imgPath);
    await finished(
      Readable.fromWeb(req.body as ReadableStream<any>).pipe(fileStream)
    );
    return join("/", newUri);
  }
}

function slug(text: string): string {
  return slugify(text, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
}

function parseRoll(text: string): IRoll | undefined {
  const match = text.match(
    /^\s*(?:miss|weak hit|strong hit).*?: (\d+) \+ (\d+) \+ (\d+) = \d+ vs (\d+) \| (\d+)\s*$/i
  );
  if (match) {
    return {
      action: parseInt(match[1]),
      stat: parseInt(match[2]),
      add: parseInt(match[3]),
      challenge1: parseInt(match[4]),
      challenge2: parseInt(match[5]),
    };
  }
}
