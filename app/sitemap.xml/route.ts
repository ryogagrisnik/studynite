import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/urls";

const PAGES = [
  "/",
  "/practice",
  "/pricing",
  "/qotd",
  "/dashboard",
  "/missed",
  "/multiplayer-quiz",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/study-group-quiz",
  "/privacy",
  "/terms",
];

export async function GET() {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const now = new Date().toISOString();
  const urls = PAGES.map((p) => `  <url>\n    <loc>${base}${p}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly<\/changefreq>\n    <priority>${p === "/" ? "1.0" : "0.6"}<\/priority>\n  <\/url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n<\/urlset>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
