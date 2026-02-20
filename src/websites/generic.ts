import type { MediaContext } from "./types"

export function extractGeneric(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  let tmdb_id: number | null = null
  let season: number | null = null
  let episode: number | null = null

  const watchPattern = url.match(/\/watch\/(\d+)(?:\/(\d+))?(?:\/(\d+))?/i)
  if (watchPattern) {
    tmdb_id = parseInt(watchPattern[1], 10)
    if (watchPattern[2]) season = parseInt(watchPattern[2], 10)
    if (watchPattern[3]) episode = parseInt(watchPattern[3], 10)
  }

  const isTV =
    season !== null || /\/tv\//i.test(url) || /tmdb-tv-\d+/i.test(url)

  if (!tmdb_id) {
    const genericTv = url.match(/\/(tv|movie)\/(\d+)/i)
    const tmdbMatch = url.match(/tmdb[/-](\d+)/i)
    const idMatch = genericTv || tmdbMatch
    tmdb_id = idMatch ? parseInt(idMatch[idMatch.length - 1], 10) : null
  }

  const yearMatch =
    documentTitle.match(/\((19|20)\d{2}\)/) ||
    bodyText.match(/\b(19|20)\d{2}\b/)
  const extractedYear = yearMatch
    ? yearMatch[0].replace(/[()]/g, "")
    : undefined

  const cleanTitle = documentTitle
    .replace(/XPrime|Cineby|Watching|Online|Free|HD|1080p/gi, "")
    .split(/[-|–|—]/)[0]
    .trim()

  return {
    title: cleanTitle,
    tmdb_id,
    type: isTV ? "tv" : "movie",
    season: season || (isTV ? 1 : null),
    episode: episode || (isTV ? 1 : null),
    episode_id: null,
    currentTime,
    year: extractedYear
  }
}
