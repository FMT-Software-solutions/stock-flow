// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")
const apiKey = Deno.env.get("CLOUDINARY_API_KEY")
const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")
const defaultFolder = Deno.env.get("CLOUDINARY_FOLDER") ?? "product-images"

serve(async (req) => {
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

    const form = await req.formData()
    const file = form.get("file") as File | null
    const folder = (form.get("folder") as string | null) ?? defaultFolder
    if (!file) return new Response(JSON.stringify({ error: "file missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    const timestamp = Math.floor(Date.now() / 1000)

    // Build signature according to Cloudinary: sha1 of params string + api_secret
    const params: Record<string, string> = { timestamp: String(timestamp) }
    if (folder) params.folder = folder
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
    uploadForm.append("file", file)
    uploadForm.append("api_key", apiKey)
    uploadForm.append("timestamp", String(timestamp))
    uploadForm.append("signature", signature)
    if (folder) uploadForm.append("folder", folder)

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    const res = await fetch(url, { method: "POST", body: uploadForm })
    const out = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: out?.error?.message ?? "upload failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify(out), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
