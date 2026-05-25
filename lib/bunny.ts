/**
 * Bunny.net Edge Storage adapter.
 *
 * Required env vars:
 *   BUNNY_STORAGE_ZONE       — storage zone name (from Bunny dashboard)
 *   BUNNY_STORAGE_API_KEY    — storage zone password / FTP password
 *   BUNNY_CDN_URL            — pull-zone URL, e.g. https://symport.b-cdn.net
 *
 * Optional env vars:
 *   BUNNY_STORAGE_HOSTNAME   — storage endpoint hostname.
 *                              Default: storage.bunnynet.com (Falkenstein)
 *                              Other regions: ny.storage.bunnynet.com,
 *                              uk.storage.bunnynet.com, la.storage.bunnynet.com,
 *                              sg.storage.bunnynet.com, syd.storage.bunnynet.com
 */

const ZONE = process.env.BUNNY_STORAGE_ZONE;
const API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const CDN_URL = process.env.BUNNY_CDN_URL;
const HOSTNAME =
  process.env.BUNNY_STORAGE_HOSTNAME ?? "storage.bunnynet.com";

function assertEnv(): void {
  if (!ZONE || !API_KEY || !CDN_URL) {
    throw new Error(
      "Missing Bunny config. Set BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, and BUNNY_CDN_URL."
    );
  }
}

function storageUrl(filename: string): string {
  return `https://${HOSTNAME}/${ZONE}/${filename}`;
}

/** Upload a buffer to Bunny Storage. */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  assertEnv();
  const url = storageUrl(filename);
  let res: Response;
  try {
    // Use Blob to avoid detached ArrayBuffer issues in Lambda environments
    // Copy bytes into a fresh Uint8Array so we don't share the detached ArrayBuffer
    const copy = new Uint8Array(buffer.length);
    buffer.copy(copy);
    const blob = new Blob([copy], { type: contentType });
    res = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: API_KEY!,
        "Content-Type": contentType,
      },
      body: blob,
    });
  } catch (err) {
    const cause = (err as NodeJS.ErrnoException).cause ?? err;
    throw new Error(`Bunny fetch error uploading to ${url}: ${cause}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }
}

/** Download a file from Bunny Storage as a Buffer. */
export async function downloadFile(filename: string): Promise<Buffer> {
  assertEnv();
  const res = await fetch(storageUrl(filename), {
    headers: { AccessKey: API_KEY! },
  });
  if (!res.ok) {
    throw new Error(`Bunny download failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Delete a file from Bunny Storage. Silently ignores missing files. */
export async function deleteFile(filename: string): Promise<void> {
  assertEnv();
  await fetch(storageUrl(filename), {
    method: "DELETE",
    headers: { AccessKey: API_KEY! },
  });
}

/** Return the public CDN URL for a stored file. */
export function getFileUrl(filename: string): string {
  if (!CDN_URL) {
    throw new Error("BUNNY_CDN_URL is not set");
  }
  return `${CDN_URL.replace(/\/$/, "")}/${filename}`;
}
