import type { MediaContext } from "./types"

const PEACOCK_URL = /^https?:\/\/(www\.)?peacocktv\.com\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Peacock$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): {
  season: number | null
  episode: number | null
} {
  const sE =
    bodyText.match(/S(\d+)\s*[E:]\s*E?(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (sE) return { season: parseInt(sE[1], 10), episode: parseInt(sE[2], 10) }
  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long)
    return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }
  return { season: null, episode: null }
}

export function matchPeacock(url: string): boolean {
  return PEACOCK_URL.test(url)
}

export function extractPeacock(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const pathname = new URL(url, "https://peacocktv.com").pathname
  const isPlayback =
    pathname.includes("/watch/playback") || pathname.includes("/watch/asset")
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  return {
    title: title || "Peacock",
    tmdb_id: null,
    type: season != null || episode != null ? "tv" : "movie",
    season: isPlayback ? season : null,
    episode: isPlayback ? episode : null,
    episode_id: null,
    currentTime
  }
}
