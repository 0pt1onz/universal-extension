import type { MediaContext } from "./types"
import { extractGeneric } from "./generic"
import { matchAppleTV, extractAppleTV } from "./AppleTV"
import { matchHBOMax, extractHBOMax } from "./HBOMax"
import { matchHDrezka, extractHDrezka } from "./HDrezka"
import { matchNetflix, extractNetflix } from "./Netflix"
import { matchParamountPlus, extractParamountPlus } from "./ParamountPlus"
import { matchPeacock, extractPeacock } from "./Peacock"
import { matchPlex, extractPlex } from "./Plex"
import { matchPrimeVideo, extractPrimeVideo } from "./PrimeVideo"

export type { MediaContext }

const SITE_EXTRACTORS: Array<{
  match: RegExp | ((url: string) => boolean)
  extract: (
    url: string,
    documentTitle: string,
    bodyText: string,
    currentTime?: number
  ) => MediaContext
}> = [
  { match: matchNetflix, extract: extractNetflix },
  { match: matchHBOMax, extract: extractHBOMax },
  { match: matchHDrezka, extract: extractHDrezka },
  { match: matchAppleTV, extract: extractAppleTV },
  { match: matchParamountPlus, extract: extractParamountPlus },
  { match: matchPeacock, extract: extractPeacock },
  { match: matchPlex, extract: extractPlex },
  { match: matchPrimeVideo, extract: extractPrimeVideo }
]

/**
 * Extract media context for the current page.
 * Uses a site-specific extractor if the URL matches one; otherwise uses the generic extractor.
 */
export function extractMediaContext(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const entry = SITE_EXTRACTORS.find((e) =>
    typeof e.match === "function" ? e.match(url) : e.match.test(url)
  )
  if (entry) return entry.extract(url, documentTitle, bodyText, currentTime)
  return extractGeneric(url, documentTitle, bodyText, currentTime)
}

export { extractGeneric } from "./generic"
