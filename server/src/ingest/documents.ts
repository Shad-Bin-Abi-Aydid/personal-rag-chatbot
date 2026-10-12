import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// The knowledge base lives in <repo>/data, two levels above server/src/ingest.
export const DATA_DIR = resolve(import.meta.dirname, "../../../data");

export interface SourceDocument {
  source: string; // file name, e.g. "cv.md"
  markdown: string;
}

// Loads every .md file directly inside the data folder (data/raw/ is skipped).
export async function loadDocuments(dir = DATA_DIR): Promise<SourceDocument[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    fileNames.map(async (source) => ({
      source,
      markdown: await readFile(join(dir, source), "utf8"),
    })),
  );
}
