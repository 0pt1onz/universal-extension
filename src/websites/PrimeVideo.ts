import type { MediaContext } from "./types"

const PRIME_VIDEO_URL = /^https?:\/\/(www\.)?(primevideo\.com|amazon\.com\/.*\/gp\/video)\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Amazon Prime.*$/i, "")
    .replace(/\s*[-|]\s*Prime Video$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): { season: number | null; episode: number | null } {
  const sE = bodyText.match(/S(\d+)\s*[E:]\s*E?(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (sE) return { season: parseInt(sE[1], 10), episode: parseInt(sE[2], 10) }
  const long = bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (long) return { season: parseInt(long[1], 10), episode: parseInt(long[2], 10) }
  return { season: null, episode: null }
}

export function matchPrimeVideo(url: string): boolean {
  return PRIME_VIDEO_URL.test(url)
}

export function extractPrimeVideo(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const pathname = new URL(url, "https://primevideo.com").pathname
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const isTV = pathname.includes("/tv/") || season != null || episode != null
  const isMovie = pathname.includes("/movie/")

  return {
    title: title || "Prime Video",
    tmdb_id: null,
    type: isMovie ? "movie" : isTV ? "tv" : "movie",
    season: isTV ? season : null,
    episode: isTV ? episode : null,
    episode_id: null,
    currentTime
  };
}

