import { createServerFn } from "@tanstack/react-start";

export type InstagramPost = {
  shortcode: string;
  permalink: string;
  caption: string;
  author: string;
  authorUrl: string;
  thumbnail?: string;
  mediaId?: string;
};

const IG_APP_ID = "936619743392459";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function parseInstagramUrl(
  input: string,
): { shortcode: string; kind: "p" | "reel" | "tv" } | null {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/(?:instagram\.com\/(?:[^/]+\/)?)?(p|reel|tv)\/([A-Za-z0-9_-]{5,})/i);
  if (match) {
    return { kind: match[1].toLowerCase() as "p" | "reel" | "tv", shortcode: match[2] };
  }
  if (/^[A-Za-z0-9_-]{8,}$/.test(value)) return { kind: "p", shortcode: value };
  return null;
}

/** Fetch a public Instagram post's caption and cover image via Instagram's oEmbed endpoint. */
export const fetchInstagramPost = createServerFn({ method: "GET" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<InstagramPost> => {
    const parsed = parseInstagramUrl(data.url);
    if (!parsed) {
      throw new Error("Paste a public Instagram post link (instagram.com/p/…).");
    }
    const permalink = `https://www.instagram.com/${parsed.kind}/${parsed.shortcode}/`;
    const endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(permalink)}`;

    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": UA,
        "x-ig-app-id": IG_APP_ID,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        "Instagram didn't return that post. Make sure it's public, or import your data export instead.",
      );
    }
    const body = (await response.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
      media_id?: string;
    };
    if (!body.title && !body.thumbnail_url) {
      throw new Error(
        "That post is private or Instagram blocked the request. Use your data export instead.",
      );
    }

    return {
      shortcode: parsed.shortcode,
      permalink,
      caption: (body.title ?? "").trim(),
      author: body.author_name ?? "",
      authorUrl: body.author_url ?? "",
      thumbnail: body.thumbnail_url,
      mediaId: body.media_id,
    };
  });

/** Server-side proxy that returns remote image bytes as base64 (browser CORS blocks IG's CDN). */
export const fetchRemoteImage = createServerFn({ method: "GET" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<{ base64: string; mime: string }> => {
    if (!/^https?:\/\//i.test(data.url)) throw new Error("Invalid image URL.");
    const response = await fetch(data.url, { headers: { "User-Agent": UA } });
    if (!response.ok) throw new Error("Couldn't download that image.");
    const mime = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!mime.startsWith("image/")) throw new Error("That link isn't an image.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 15 * 1024 * 1024) throw new Error("That image is too large.");
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { base64: btoa(binary), mime };
  });

export type ImportedPost = {
  id: string;
  caption: string;
  permalink?: string;
  imageUrl?: string;
  /** Path inside the Instagram export ZIP (e.g. media/posts/202401/abc.jpg). */
  imagePath?: string;
  createdAt?: number;
  selected?: boolean;
};

type ExportMedia = {
  uri?: string;
  title?: string;
  creation_timestamp?: number;
};

type ExportEntry = {
  media?: ExportMedia[];
  title?: string;
  creation_timestamp?: number;
  uri?: string;
};

/**
 * Parse Instagram's "Download your information" JSON (posts_1.json, or the
 * content of your_instagram_activity/media/posts_1.json).
 */
export function parseInstagramExport(raw: string): ImportedPost[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON. Upload posts_1.json from your Instagram export.");
  }

  const entries: ExportEntry[] = [];
  if (Array.isArray(data)) entries.push(...(data as ExportEntry[]));
  else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const bucket = record.data ?? record.posts ?? record.media;
    if (Array.isArray(bucket)) entries.push(...(bucket as ExportEntry[]));
  }

  const posts: ImportedPost[] = [];
  entries.forEach((entry, index) => {
    const media = Array.isArray(entry.media) ? entry.media : [];
    const caption =
      media.find((item) => typeof item.title === "string" && item.title.trim())?.title?.trim() ??
      (typeof entry.title === "string" ? entry.title.trim() : "");
    const image = media.find((item) => typeof item.uri === "string")?.uri;
    const createdAt =
      entry.creation_timestamp ??
      media.find((item) => typeof item.creation_timestamp === "number")?.creation_timestamp;
    if (!caption && !image) return;
    posts.push({
      id: `export-${index}-${createdAt ?? ""}`,
      caption,
      imageUrl: image && /^https?:\/\//i.test(image) ? image : undefined,
      imagePath: image && !/^https?:\/\//i.test(image) ? image : undefined,
      createdAt,
      selected: true,
    });
  });

  if (posts.length === 0) {
    throw new Error("No posts with captions were found in that export file.");
  }
  return posts;
}
