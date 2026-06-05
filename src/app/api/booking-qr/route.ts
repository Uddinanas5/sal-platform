import QRCode from "qrcode"
import { NextResponse } from "next/server"

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/i

function getBaseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get("slug")?.trim()

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "Valid business slug is required" }, { status: 400 })
  }

  const bookingUrl = `${getBaseUrl(req)}/book/${encodeURIComponent(slug)}`
  const dark = url.searchParams.get("color") || "#111827"
  const light = url.searchParams.get("background") || "#ffffff"

  const png = await QRCode.toBuffer(bookingUrl, {
    type: "png",
    width: 768,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark, light },
  })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Disposition": `inline; filename="sal-${slug}-booking-qr.png"`,
    },
  })
}
