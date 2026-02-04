import type { MediaContext } from "./types"

const MAX_URL = /^https?:\/\/(www\.)?(max\.com|hbomax\.com)\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*(Max|HBO Max)$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): { season: number | null; episode: number | null } {
  const short = bodyText.match(/S(\d+)\s*[E:]\s*E?(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (short) return { season: parseInt(short[1], 10), episode: parseInt(short[2], 10) }
  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long) return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }
  return { season: null, episode: null }
}

export function matchHBOMax(url: string): boolean {
  return MAX_URL.test(url)
}

export function extractHBOMax(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const pageTitle = cleanTitle(documentTitle)
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const pathParts = new URL(url, "https://max.com").pathname.split("/").filter(Boolean)
  const section = pathParts[0]
  const isVideo = section === "video"
  const type: "tv" | "movie" = section === "movie" ? "movie" : "tv"

  return {
    title: pageTitle || "Max",
    tmdb_id: null,
    type,
    season: isVideo ? season : null,
    episode: isVideo ? episode : null,
    episode_id: null,
    currentTime
  };
}
