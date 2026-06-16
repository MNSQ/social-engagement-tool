import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_DATA_REFERENCE_TIME } from "./samplePosts";
import type { Post } from "./types";

const CSV_PATH = join(process.cwd(), "public", "test-data", "synthetic_tweets_1000.csv");

const CSV_COLUMNS = [
  "authorName",
  "handle",
  "text",
  "url",
  "createdAt",
  "views",
  "likes",
  "reposts",
  "replies",
  "followers",
] as const;

/** Parses CSV text into rows of string cells, handling quoted fields with embedded commas, newlines, and escaped `""` quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignore, handled by \n
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseNumber(value: string | undefined): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// Falls back to the sample data reference time so a missing/invalid CSV
// timestamp can't turn into NaN inside scoring's freshness calculation.
function parseCreatedAt(value: string | undefined): string {
  if (value && !Number.isNaN(new Date(value).getTime())) {
    return value;
  }
  return new Date(SAMPLE_DATA_REFERENCE_TIME).toISOString();
}

/** Converts CSV text (using the declared `CSV_COLUMNS` headers) into `Post[]`. */
export function parseCsvPosts(csvText: string): Post[] {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) return [];

  const header = rows[0].map((cell) => cell.trim());
  const indexOf = (column: (typeof CSV_COLUMNS)[number]) => header.indexOf(column);
  const columnIndices = Object.fromEntries(CSV_COLUMNS.map((column) => [column, indexOf(column)])) as Record<
    (typeof CSV_COLUMNS)[number],
    number
  >;

  return rows.slice(1).map((row, index) => ({
    id: `csv-${index}`,
    authorName: row[columnIndices.authorName] ?? "",
    handle: row[columnIndices.handle] ?? "",
    text: row[columnIndices.text] ?? "",
    url: row[columnIndices.url] ?? "",
    createdAt: parseCreatedAt(row[columnIndices.createdAt]),
    views: parseNumber(row[columnIndices.views]),
    likes: parseNumber(row[columnIndices.likes]),
    reposts: parseNumber(row[columnIndices.reposts]),
    replies: parseNumber(row[columnIndices.replies]),
    followers: parseOptionalNumber(row[columnIndices.followers]),
  }));
}

/**
 * Loads and parses the local test CSV (temporary local testing source).
 * Returns `null` if the file is missing, empty, or unreadable so callers
 * can fall back to `samplePosts`.
 */
export function loadCsvPosts(): Post[] | null {
  try {
    const csvText = readFileSync(CSV_PATH, "utf-8");
    const posts = parseCsvPosts(csvText);
    return posts.length > 0 ? posts : null;
  } catch {
    return null;
  }
}
