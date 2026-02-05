import type { MediaContext } from "./types"

const SKYSHOWTIME_URL =
  /^https?:\/\/(www\.)?skyshowtime\.com\/[a-z]{2}\/(stream|watch)\/(tv|movie)\/[a-z0-9-]+/i

export function matchSkyShowtime(url: string): boolean {
  return SKYSHOWTIME_URL.test(url)
}

function cleanSkyShowtimeTitle(raw: string): string {
  return raw.replace(/\s*[-|~]\s*SkyShowtime.*$/i, "").trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): {
  season: number | null
  episode: number | null
} {
  const sE1 = bodyText.match(/S(\d+)\s*E\s*(\d+)/i)
  if (sE1)
    return { season: parseInt(sE1[1], 10), episode: parseInt(sE1[2], 10) }

  const sE2 = bodyText.match(/(\d+)x(\d+)/i)
  if (sE2)
    return { season: parseInt(sE2[1], 10), episode: parseInt(sE2[2], 10) }

  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long)
    return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }

  return { season: null, episode: null }
}

export function extractSkyShowtime(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const og = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
  const tw = document
    .querySelector('meta[name="twitter:title"]')
    ?.getAttribute("content")

  let title = og || tw || documentTitle || ""

  const lower = title.toLowerCase()
  if (!title || lower.includes("skyshowtime")) {
    const domMatch = document.body.innerText.match(/^(?:#\s*)?(.+?)(?:\s*\n|$)/)
    if (domMatch) title = domMatch[1].trim()
  }

  title = cleanSkyShowtimeTitle(title)

  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const isTV = Boolean(season || episode)
  const isMovie = !isTV

  return {
    title: title || "SkyShowtime",
    tmdb_id: null,
    type: isMovie ? "movie" : "tv",
    season: isTV ? season : null,
    episode: isTV ? episode : null,
    episode_id: null,
    currentTime
  }
}
