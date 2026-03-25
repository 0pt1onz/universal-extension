import type { MediaContext } from "./types"

function cleanTitle(title: string, domain: string): string {
  return title
    .replace(/\s*\(\d{4}\)\s*/g, "") // Remove year in parentheses
    .replace(/\s*\b(19|20)\d{2}\b\s*/g, "") // Remove standalone year
    .replace(new RegExp(domain.replace(/\./g, "\\."), "gi"), "")
    .replace(new RegExp(domain.split(".")[0], "gi"), "")
    .replace(/Watching|Online|Free|HD|1080p|720p|4K|Stream/gi, "")
    .replace(/\s*[-|–|—:]\s*(Watch|Stream|Full|Movie|TV\s*Show|Series).*$/i, "")
    .split(/[-|–|—]/)[0]
    .trim()
}

export async function extractGeneric(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): Promise<MediaContext> {
  let tmdb_id: number | null = null
  let imdb_id: string | null = null
  let season: number | null = null
  let episode: number | null = null

  // 1. Extract TMDB ID from URL
  const tmdbTvMatch = url.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/i)
  if (tmdbTvMatch) {
    tmdb_id = parseInt(tmdbTvMatch[1], 10)
    season = parseInt(tmdbTvMatch[2], 10)
    episode = parseInt(tmdbTvMatch[3], 10)
  } else {
    const watchMatch = url.match(/\/watch\/(\d+)(?:\/(\d+))?(?:\/(\d+))?/i)
    if (watchMatch) {
      tmdb_id = parseInt(watchMatch[1], 10)
      if (watchMatch[2]) season = parseInt(watchMatch[2], 10)
      if (watchMatch[3]) episode = parseInt(watchMatch[3], 10)
    }
  }

  if (!tmdb_id) {
    const genericMatch = url.match(/\/(tv|movie)\/(\d+)/i)
    const tmdbUrlMatch = url.match(/tmdb[/-](\d+)/i)
    const idMatch = genericMatch || tmdbUrlMatch
    if (idMatch) {
      tmdb_id = parseInt(idMatch[idMatch.length - 1], 10)
    }
  }

  // 2. Extract IMDb ID from URL if TMDB ID not found
  if (!tmdb_id) {
    const decodedUrl = decodeURIComponent(url)
    const imdbMatch = decodedUrl.match(/\/(tt\d+)/i)
    if (imdbMatch) {
      imdb_id = imdbMatch[1]
    }
    const seriesMatch = decodedUrl.match(/\/(tt\d+):(\d+):(\d+)/i)
    if (seriesMatch) {
      imdb_id = seriesMatch[1]
      season = parseInt(seriesMatch[2], 10)
      episode = parseInt(seriesMatch[3], 10)
    }
  }

  // 3. Determine media type
  const isTV =
    season !== null || /\/tv\//i.test(url) || /tmdb-tv-\d+/i.test(url)
  const type = isTV ? "tv" : "movie"

  // 4. Extract year
  const yearMatch =
    documentTitle.match(/\((19|20)\d{2}\)/) ||
    bodyText.match(/\b(19|20)\d{2}\b/)
  const extractedYear = yearMatch
    ? yearMatch[0].replace(/[()]/g, "")
    : undefined

  // 5. Extract domain for title cleaning
  let domain = ""
  try {
    const urlObj = new URL(url)
    domain = urlObj.hostname.replace(/^www\./, "")
  } catch {
    // ignore
  }

  // 6. Clean title
  const title = cleanTitle(documentTitle, domain)

  // 7. Return raw data for further processing
  return {
    title: title || "Untitled",
    tmdb_id,
    imdb_id,
    type,
    season: season || (isTV ? 1 : null),
    episode: episode || (isTV ? 1 : null),
    episode_id: null,
    currentTime,
    year: extractedYear
  }
}
