import { extractAppleTV, matchAppleTV } from "./AppleTV"
import { extractGeneric } from "./generic"
import { extractHBOMax, matchHBOMax } from "./HBOMax"
import { extractHDrezka, matchHDrezka } from "./HDrezka"
import { extractNetflix, matchNetflix } from "./Netflix"
import { extractParamountPlus, matchParamountPlus } from "./ParamountPlus"
import { extractPeacock, matchPeacock } from "./Peacock"
import { extractPlex, matchPlex } from "./Plex"
import { extractPrimeVideo, matchPrimeVideo } from "./PrimeVideo"
import type { MediaContext } from "./types"

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
