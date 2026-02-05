import type { MediaContext } from "./types"

const HDREZKA_URL =
  /^https?:\/\/(www\.)?(hdrezka\.ag|hdrezka\.co|rezka\.ag|.+rezka.+)\//i

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*HDrezka.*$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

function parseSeasonEpisodeFromBody(bodyText: string): {
  season: number | null
  episode: number | null
} {
  const short =
    bodyText.match(/S(\d+)\s*[E:]\s*E?(\d+)/i) || bodyText.match(/(\d+)x(\d+)/i)
  if (short)
    return { season: parseInt(short[1], 10), episode: parseInt(short[2], 10) }
  const seasonEp =
    bodyText.match(/Сезон\s+(\d+)[,\s]+(\d+)\s+[Сс]ери/i) ||
    bodyText.match(/Season\s+(\d+)[,\s]+Episode\s+(\d+)/i)
  if (seasonEp)
    return {
      season: parseInt(seasonEp[1], 10),
      episode: parseInt(seasonEp[2], 10)
    }
  return { season: null, episode: null }
}

export function matchHDrezka(url: string): boolean {
  return HDREZKA_URL.test(url)
}

export function extractHDrezka(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  const title = cleanTitle(documentTitle)
  const { season, episode } = parseSeasonEpisodeFromBody(bodyText)

  const pathname = new URL(url, "https://hdrezka.ag").pathname
  const isMediaPage = /\/(films|series|cartoons|animation)\/.+/.test(pathname)
  const pathSegments = pathname.split("/").filter(Boolean)
  const contentType = pathSegments[0]
  const type: "tv" | "movie" = ["series", "animation", "cartoons"].includes(
    contentType || ""
  )
    ? "tv"
    : "movie"

  return {
    title: title || "HDrezka",
    tmdb_id: null,
    type,
    season: isMediaPage && type === "tv" ? season : null,
    episode: isMediaPage && type === "tv" ? episode : null,
    episode_id: null,
    currentTime
  }
}
