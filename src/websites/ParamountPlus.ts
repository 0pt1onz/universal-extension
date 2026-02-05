import type { MediaContext } from "./types"

const PARAMOUNT_URL = /^https?:\/\/(www\.)?paramountplus\.com\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Paramount\+?$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): {
  season: number | null
  episode: number | null
} {
  const sE =
    bodyText.match(/S(\d+)\s*:\s*E(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (sE) return { season: parseInt(sE[1], 10), episode: parseInt(sE[2], 10) }
  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long)
    return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }
  return { season: null, episode: null }
}

export function matchParamountPlus(url: string): boolean {
  return PARAMOUNT_URL.test(url)
}

export function extractParamountPlus(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const pathname = new URL(url, "https://paramountplus.com").pathname
  const isShowsVideo = /\/shows\/.+\/video\//i.test(pathname)
  const isMovies = /\/movies\//i.test(pathname)
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  return {
    title: title || "Paramount+",
    tmdb_id: null,
    type: isMovies ? "movie" : "tv",
    season: isShowsVideo ? season : null,
    episode: isShowsVideo ? episode : null,
    episode_id: null,
    currentTime
  }
}
