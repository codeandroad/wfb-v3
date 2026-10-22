import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { createHash, timingSafeEqual } from "node:crypto"
import { isLoopbackHost, validateLocalSchoolImport } from "./local-import-model"

// Fixed private file: never accept a request-controlled filesystem path, import
// it into a JS bundle, or serve it through public/. Production returns no data.
async function readPreparedBundle(host: string | null) {
  if (process.env.NODE_ENV !== "development" || !isLoopbackHost(host)) return null
  const file = path.join(process.cwd(), ".local-artifacts", "private-school-import", "current.json")
  try { return validateLocalSchoolImport(JSON.parse(await readFile(file, "utf8"))) }
  catch { return null } // Do not log source records or JSON parser excerpts.
}

export async function readLocalSchoolImportMetadata(host: string | null) {
  const bundle = await readPreparedBundle(host)
  return bundle ? { batchId: bundle.batchId, summary: bundle.summary } : null
}

export async function readAuthorizedLocalSchoolImport(host: string | null, token: string) {
  if (process.env.NODE_ENV !== "development" || !isLoopbackHost(host) || !/^[a-f0-9]{64}$/.test(token)) return null
  try {
    const capability = JSON.parse(await readFile(path.join(process.cwd(), ".local-artifacts", "private-school-import", "capability.json"), "utf8"))
    if (typeof capability.expiresAt !== "number" || capability.expiresAt <= Date.now() / 1000 || !/^[a-f0-9]{64}$/.test(capability.digest)) return null
    const digest = createHash("sha256").update(token).digest()
    if (!timingSafeEqual(digest, Buffer.from(capability.digest, "hex"))) return null
    const bundle = await readPreparedBundle(host)
    return bundle?.batchId === capability.batchId ? bundle : null
  } catch { return null }
}
