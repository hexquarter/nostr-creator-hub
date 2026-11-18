import { bytesToHex, sha256Bytes } from "@/lib/crypto";
import type { AppSigner } from "./signer";

const BLOSSOM_SERVER = "https://blossom.primal.net";

export type UploadResult = {
  url: string;
  sha256: string;
  size: number;
  type?: string;
};

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Upload bytes to a Blossom media server using a NIP-24242 authorization event.
 * Returns a permanent https URL that can be embedded in an `imeta` tag.
 */
export async function uploadBlob(
  bytes: Uint8Array,
  mime: string,
  signer: AppSigner,
): Promise<UploadResult> {
  const hash = bytesToHex(await sha256Bytes(bytes));
  const expiration = Math.floor(Date.now() / 1000) + 60 * 10;

  const auth = await signer.signEvent({
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    content: "Upload media to Blossom",
    tags: [
      ["t", "upload"],
      ["x", hash],
      ["expiration", String(expiration)],
    ],
  });

  const response = await fetch(`${BLOSSOM_SERVER}/upload`, {
    method: "PUT",
    headers: {
      Authorization: `Nostr ${base64Encode(new TextEncoder().encode(JSON.stringify(auth)))}`,
      "Content-Type": mime,
    },
    body: new Blob([bytes as BlobPart], { type: mime }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Media upload failed (${response.status}). ${detail.slice(0, 120)}`.trim());
  }

  const body = (await response.json()) as Partial<UploadResult> & { url?: string };
  const url = body.url ?? `${BLOSSOM_SERVER}/${hash}`;
  return {
    url,
    sha256: body.sha256 ?? hash,
    size: body.size ?? bytes.length,
    type: body.type ?? mime,
  };
}

export async function uploadFile(file: File, signer: AppSigner) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return uploadBlob(bytes, file.type || "application/octet-stream", signer);
}
