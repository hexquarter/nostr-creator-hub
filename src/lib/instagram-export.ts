import { strFromU8, unzipSync } from "fflate";
import { parseInstagramExport, type ImportedPost } from "./instagram";

export type ExportMediaReader = (path: string) => { bytes: Uint8Array; mime: string } | null;

export type InstagramExport = {
  posts: ImportedPost[];
  readMedia: ExportMediaReader;
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

function mimeFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

/** Read posts_1.json and its media from an Instagram data export ZIP (or raw JSON). */
export async function readInstagramExportFile(file: File): Promise<InstagramExport> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    return {
      posts: parseInstagramExport(await file.text()),
      readMedia: () => null,
    };
  }
  if (!name.endsWith(".zip")) {
    throw new Error("Upload posts_1.json or the .zip from your Instagram data export.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(bytes);
  const candidates = Object.keys(entries)
    .filter((path) => /posts_1\.json$/i.test(path))
    .sort((a, b) => a.length - b.length);
  if (candidates.length === 0) {
    throw new Error(
      "That ZIP doesn't contain posts_1.json. In your export, include “Posts” under Instagram activity.",
    );
  }

  const posts = parseInstagramExport(strFromU8(entries[candidates[0]]));
  const paths = Object.keys(entries);

  const readMedia: ExportMediaReader = (rawPath) => {
    const path = rawPath.replace(/^\.\//, "");
    const match =
      paths.find((candidate) => candidate === path) ??
      paths.find((candidate) => candidate.endsWith(`/${path}`)) ??
      paths.find((candidate) => candidate.endsWith(path));
    if (!match) return null;
    return { bytes: entries[match], mime: mimeFor(match) };
  };

  return { posts, readMedia };
}
