import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

/** A third-party source file: where it comes from and the MD5 it had when reviewed. */
export type SourceFile = { url: string; md5: string };

const cache = resolve(import.meta.dir, "../node_modules/.cache/habitta-cc0");

/**
 * A source file, from the local cache or downloaded into it. Generation stops
 * if its MD5 no longer matches the one recorded when it was reviewed.
 */
export async function download({ url, md5 }: SourceFile) {
  await mkdir(cache, { recursive: true });
  const path = resolve(cache, `${md5}-${url.split(/[/=]/).at(-1)!}`);
  let bytes = await readFile(path).catch(() => null);
  if (!bytes) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path, bytes);
  }
  const digest = createHash("md5").update(bytes).digest("hex");
  if (digest !== md5) throw new Error(`${url} changed upstream (MD5 ${digest}, expected ${md5}); review it before updating the record.`);
  return bytes;
}

/** One file from a ZIP archive, stored or deflated. */
export function unzip(archive: Buffer, name: string) {
  // The central directory's end record sits in the last 64 KiB.
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Not a ZIP archive.");
  let entry = archive.readUInt32LE(end + 16);
  for (let i = 0, count = archive.readUInt16LE(end + 10); i < count; i++) {
    const [method, size, nameLength, extraLength, commentLength, offset] = [
      archive.readUInt16LE(entry + 10), archive.readUInt32LE(entry + 20), archive.readUInt16LE(entry + 28),
      archive.readUInt16LE(entry + 30), archive.readUInt16LE(entry + 32), archive.readUInt32LE(entry + 42),
    ];
    if (archive.toString("utf8", entry + 46, entry + 46 + nameLength) === name) {
      const start = offset + 30 + archive.readUInt16LE(offset + 26) + archive.readUInt16LE(offset + 28);
      const data = archive.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }
    entry += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${name} is not in the archive.`);
}
