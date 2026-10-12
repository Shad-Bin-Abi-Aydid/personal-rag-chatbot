import { countTokens } from "./tokens.js";

export interface Chunk {
  id: string; // stable id, e.g. "cv-stackscribe-blog-platform"
  source: string; // file it came from, e.g. "cv.md"
  heading: string; // section path shown as the citation, e.g. "Projects › StackScribe – blog platform"
  text: string; // what gets embedded and later sent to the LLM
  tokenCount: number;
}

// A section longer than this is split into overlapping parts.
export const MAX_CHUNK_TOKENS = 500;

interface Section {
  path: string[]; // headings below the document title, e.g. ["Projects", "TutorNest – tutoring marketplace"]
  lines: string[];
}

// Strategy: one chunk per section (the text under the deepest heading).
// Each chunk starts with its full heading path, so it still makes sense
// when it is retrieved on its own, without the rest of the file.
export function chunkMarkdown(markdown: string, source: string): Chunk[] {
  const docId = slugify(source.replace(/\.md$/i, ""));
  const { title, sections } = parseSections(markdown);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const body = section.lines.join("\n").trim();
    if (!body) continue; // e.g. "## Projects" only groups the ### sections below it

    const lastHeading = section.path.at(-1);
    const baseId = lastHeading ? `${docId}-${slugify(lastHeading)}` : docId;
    const heading = section.path.join(" › ") || title;
    const header = [title, ...section.path].filter(Boolean).join(" › ");
    const parts = splitIntoParts(body, header);

    parts.forEach((part, index) => {
      const text = `${header}\n\n${part}`;
      chunks.push({
        id: parts.length > 1 ? `${baseId}-part-${index + 1}` : baseId,
        source,
        heading,
        text,
        tokenCount: countTokens(text),
      });
    });
  }

  assertUniqueIds(chunks, source);
  return chunks;
}

function parseSections(markdown: string): { title: string; sections: Section[] } {
  let title = "";
  const headings: string[] = []; // headings[0] is the current "##", headings[1] the current "###", ...
  let current: Section = { path: [], lines: [] }; // text before the first "##" belongs to the title
  const sections: Section[] = [current];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }

    const [, hashes = "", headingText = ""] = match;
    if (hashes.length === 1) {
      title = headingText.trim();
      continue;
    }

    // A new heading replaces any heading at the same or a deeper level.
    const depth = hashes.length - 2;
    headings.length = depth;
    headings[depth] = headingText.trim();

    current = { path: headings.filter(Boolean), lines: [] };
    sections.push(current);
  }

  return { title, sections };
}

// Packs paragraphs into parts that fit MAX_CHUNK_TOKENS. Each new part repeats
// the previous part's last paragraph (the overlap), so an idea is never cut off mid-thought.
function splitIntoParts(body: string, header: string): string[] {
  const fits = (paragraphs: string[]) =>
    countTokens(`${header}\n\n${paragraphs.join("\n\n")}`) <= MAX_CHUNK_TOKENS;

  const paragraphs = body.split(/\n\s*\n/);
  if (fits(paragraphs)) return [body];

  const parts: string[][] = [];
  let part: string[] = [];

  for (const paragraph of paragraphs) {
    if (part.length === 0 || fits([...part, paragraph])) {
      part.push(paragraph);
      continue;
    }
    parts.push(part);
    const overlap = part.at(-1);
    part = overlap && fits([overlap, paragraph]) ? [overlap, paragraph] : [paragraph];
  }
  parts.push(part);

  return parts.map((paragraphGroup) => paragraphGroup.join("\n\n"));
}

// Parentheses are dropped (they usually hold dates), so an id survives
// edits like "(July 2023 – present)" → "(July 2023 – March 2027)".
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertUniqueIds(chunks: Chunk[], source: string): void {
  const seen = new Set<string>();
  for (const { id } of chunks) {
    if (seen.has(id)) {
      throw new Error(`Duplicate chunk id "${id}" in ${source}. Give those sections different headings.`);
    }
    seen.add(id);
  }
}
