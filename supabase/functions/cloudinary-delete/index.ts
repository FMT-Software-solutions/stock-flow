// deno-lint-ignore-file no-explicit-any

const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")
const apiKey = Deno.env.get("CLOUDINARY_API_KEY")
const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "*"
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  try {
    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Cloudinary env not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const { public_id } = await req.json()
    if (!public_id) {
        return new Response(JSON.stringify({ error: "public_id missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const timestamp = Math.floor(Date.now() / 1000)

    // Build signature according to Cloudinary: sha1 of params string + api_secret
    const params: Record<string, string> = { 
        public_id: public_id,
        timestamp: String(timestamp) 
    }
    
    const paramString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&")
      
    const signature = await (async () => {
      const data = new TextEncoder().encode(paramString + apiSecret)
      const buf = await crypto.subtle.digest("SHA-1", data)
      const bytes = new Uint8Array(buf)
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
    })()

    const uploadForm = new FormData()
    uploadForm.append("public_id", public_id)
    uploadForm.append("api_key", apiKey)
    uploadForm.append("timestamp", String(timestamp))
    uploadForm.append("signature", signature)

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`
    const res = await fetch(url, { method: "POST", body: uploadForm })
    const out = await res.json()
    
    if (!res.ok) {
      // User said "silently with throwing errors" - well, we should probably return error to caller so caller can decide to ignore.
      // But the requirement was "If there are failures, it should just remove from the DB and continue without throwing error."
      // This logic is best handled in the client/caller. Here we report what happened.
      return new Response(JSON.stringify({ error: out?.error?.message ?? "delete failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
