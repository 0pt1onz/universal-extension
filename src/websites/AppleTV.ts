import type { MediaContext } from "./types"

const APPLE_TV_URL = /^https?:\/\/(tv\.apple\.com|www\.apple\.com\/apple-tv-plus)\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Apple TV.*$/i, "")
    .split(/[-|]/)[0]
    .trim()
}

function parseSubtitleForSeasonEpisode(bodyText: string): { season: number | null; episode: number | null } {
  const commaSep = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (commaSep) return { season: parseInt(commaSep[1], 10), episode: parseInt(commaSep[2], 10) }
  const sE = bodyText.match(/S(\d+)\s*[,\s]\s*E(\d+)/i) || bodyText.match(/S(\d+):E(\d+)/i)
  if (sE) return { season: parseInt(sE[1], 10), episode: parseInt(sE[2], 10) }
  return { season: null, episode: null }
}

export function matchAppleTV(url: string): boolean {
  return APPLE_TV_URL.test(url)
}

export function extractAppleTV(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const { season, episode } = parseSubtitleForSeasonEpisode(bodyText)
  return {
    title: title || "Apple TV+",
    tmdb_id: null,
    type: season != null || episode != null ? "tv" : "movie",
    season,
    episode,
    episode_id: null,
    currentTime
  }
}
