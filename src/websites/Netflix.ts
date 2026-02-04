import type { MediaContext } from "./types"

const NETFLIX_URL = /^https?:\/\/(www\.)?netflix\.com\//i

function cleanTitle(title: string): string {
  return title
    .replace(/[\s-]*Netflix$/i, "")
    .replace(/^Watch\s+/i, "")
    .split(/[-|\u2013\u2014]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): { season: number | null; episode: number | null } {
  const short = bodyText.match(/S(\d+)\s*[E:]\s*E?(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (short) {
    return { season: parseInt(short[1], 10), episode: parseInt(short[2], 10) }
  }
  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long) {
    return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }
  }
  return { season: null, episode: null }
}

export function matchNetflix(url: string): boolean {
  return NETFLIX_URL.test(url)
}

export function extractNetflix(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const type: "tv" | "movie" = season != null || episode != null ? "tv" : "movie"
  const tmdb_id: number | null = null

  return {
    title: title || "Netflix",
    tmdb_id,
    type,
    season,
    episode,
    episode_id: null,
    currentTime
  };
}

