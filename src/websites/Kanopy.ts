import type { MediaContext } from "./types"
import {
  extractJsonLd,
  extractMetaTitle,
  extractTitleFromJsonLd
} from "./utils"

const KANOPY_URL = /^https?:\/\/([a-zA-Z0-9-]+\.)?kanopy\.com\//i

export function matchKanopy(url: string): boolean {
  return KANOPY_URL.test(url)
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|–]\s*Kanopy$/i, "")
    .replace(/\s*[-|–]\s*(Stream|Watch)\s+(Free|Online)\s*$/i, "")
    .trim()
}

export async function extractKanopy(
  url: string,
  documentTitle: string,
  _bodyText: string,
  currentTime = 0
): Promise<MediaContext> {
  let title: string | undefined

  // 1. Try JSON-LD
  const jsonLd = extractJsonLd()
  if (jsonLd) {
    const jsonTitle = extractTitleFromJsonLd(jsonLd)
    if (jsonTitle) title = jsonTitle
  }

  // 2. Try meta tags
  if (!title) {
    title = extractMetaTitle()
  }

  // 3. Clean document title as last resort
  if (!title) {
    title = cleanTitle(documentTitle)
  }

  // Kanopy uses product IDs — everything is a "product" (movie or single series page)
  const isProduct = /\/product\//i.test(url)

  return {
    title: title || "Kanopy",
    tmdb_id: null,
    type: "movie",
    season: null,
    episode: null,
    episode_id: null,
    currentTime
  }
}
