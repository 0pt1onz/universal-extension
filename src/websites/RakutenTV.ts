import type { MediaContext } from "./types"

const RAKUTEN_TV_PLAYER_URL =
  /^https?:\/\/(www\.)?rakuten\.tv\/[a-z]{2}\/player\/(movies|series)\/stream\/[a-z0-9-]+/i

export function matchRakutenTVPlayer(url: string): boolean {
  return RAKUTEN_TV_PLAYER_URL.test(url)
}

function cleanRakutenTitle(raw: string): string {
  return raw.replace(/\s*[-|~]\s*Rakuten TV.*$/i, "").trim()
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

export function extractRakutenTVPlayer(
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
  if (!title || lower.includes("rakuten")) {
    const domMatch = document.body.innerText.match(/^(?:#\s*)?(.+?)(?:\s*\n|$)/)
    if (domMatch) title = domMatch[1].trim()
  }

  title = cleanRakutenTitle(title)

  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const isTV = Boolean(season || episode)
  const isMovie = !isTV

  return {
    title: title || "Rakuten TV",
    tmdb_id: null,
    type: isMovie ? "movie" : "tv",
    season: isTV ? season : null,
    episode: isTV ? episode : null,
    episode_id: null,
    currentTime
  }
}
