import { readAuthorizedLocalSchoolImport } from "@/lib/school/local-import-server"
import { isLoopbackHost, localSchoolCookieToken, LOCAL_SCHOOL_SESSION_COOKIE } from "@/lib/school/local-import-model"

export async function POST(request: Request) {
  const host = request.headers.get("host")
  const origin = request.headers.get("origin")
  const deny = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
  if (!isLoopbackHost(host) || request.headers.get("sec-fetch-site") === "cross-site") return deny()
  try { if (origin && (new URL(origin).host !== host || new URL(origin).origin !== new URL(request.url).origin)) return deny() } catch { return deny() }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "")
  const token = bearer ?? localSchoolCookieToken(request.headers.get("cookie"))
  const bundle = await readAuthorizedLocalSchoolImport(host, token)
  if (!bundle) return deny()
  const response = Response.json(bundle, { headers: { "Cache-Control": "no-store, private", "Vary": "Authorization, Cookie", "X-Content-Type-Options": "nosniff" } })
  if (bearer) response.headers.append("Set-Cookie", `${LOCAL_SCHOOL_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=259200${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`)
  return response
}
