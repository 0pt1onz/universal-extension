import type { MediaContext } from "./types"

const PLEX_URL = /^https?:\/\/(app\.)?plex\.tv\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Plex$/i, "")
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

export function matchPlex(url: string): boolean {
  return PLEX_URL.test(url)
}

export function extractPlex(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const { href } = new URL(url, "https://app.plex.tv")
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const isVod =
    href.includes("tv.plex.provider.vod") || href.includes("/server/")
  const type: "tv" | "movie" =
    season != null || episode != null ? "tv" : "movie"

  return {
    title: title || "Plex",
    tmdb_id: null,
    type: isVod ? type : "movie",
    season,
    episode,
    episode_id: null,
    currentTime
  }
}
