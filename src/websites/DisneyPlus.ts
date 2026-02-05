import type { MediaContext } from "./types"

function cleanDisneyTitle(raw: string): string {
  return raw
    .replace(/\s*[-|]\s*Disney\+.*$/i, "")
    .replace(/\s*–\s*Disney\+.*$/i, "")
    .trim()
}

export function extractDisneyPlus(
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

  let title = og || tw || ""

  if (!title || title.toLowerCase().includes("disney+")) {
    const domMatch = document.body.innerText.match(/^(?:#\s*)?(.+?)(?:\s*\n|$)/)
    if (domMatch) title = domMatch[1]
  }

  title = cleanDisneyTitle(title)

  const sE =
    bodyText.match(/S(\d+)\s*E\s*(\d+)/i) ||
    bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  const season = sE ? parseInt(sE[1], 10) : null
  const episode = sE ? parseInt(sE[2], 10) : null

  const isTV = Boolean(season || episode)
  const isMovie = !isTV

  return {
    title: title || "Disney+",
    tmdb_id: null,
    type: isMovie ? "movie" : "tv",
    season: isTV ? season : null,
    episode: isTV ? episode : null,
    episode_id: null,
    currentTime
  }
}
