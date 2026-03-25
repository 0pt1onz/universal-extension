import type { MediaContext } from "./types"

function cleanTitle(title: string, domain: string): string {
  return title
    .replace(/\s*\(\d{4}\)\s*/g, "") // Remove year in parentheses
    .replace(/\s*\b(19|20)\d{2}\b\s*/g, "") // Remove standalone year
    .replace(/-\d{4}-\d+$/, "") // Remove trailing year and ID for nepu.to
    .replace(new RegExp(domain.replace(/\./g, "\\."), "gi"), "")
    .replace(new RegExp(domain.split(".")[0], "gi"), "")
    .replace(/Watching|Online|HD|1080p|720p|4K|Stream/gi, "")
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

  // 4. Extract year from URL path first, then fall back to document
  const urlYearMatch =
    url.match(/-(19|20)\d{2}-/) || url.match(/-(19|20)\d{2}$/)
  const yearMatch =
    urlYearMatch ||
    documentTitle.match(/\((19|20)\d{2}\)/) ||
    bodyText.match(/\b(19|20)\d{2}\b/)
  const extractedYear = yearMatch
    ? yearMatch[0].replace(/[-()]/g, "")
    : undefined

  // 5. Extract domain for title cleaning
  let domain = ""
  try {
    const urlObj = new URL(url)
    domain = urlObj.hostname.replace(/^www\./, "")
  } catch {
    // ignore
  }

  // 6. Extract title from URL path - try multiple patterns
  let title: string | undefined
  let titleFromUrl = false
  try {
    const path = new URL(url).pathname

    // Pattern 1: /movies/title-year-id or /movie/title-year-id
    let match = path.match(
      /\/(?:movie|movies|tv)\/(.+?)(?:-(19|20)\d{2})?(?:-[a-z0-9]+)?$/i
    )

    // Pattern 2: /watch/title-year or /watch/title
    if (!match) {
      match = path.match(/\/watch\/(.+?)(?:-(19|20)\d{2})?(?:-[a-z0-9]+)?$/i)
    }

    // Pattern 3: /film/title or /show/title
    if (!match) {
      match = path.match(
        /\/(?:film|show|video)\/(.+?)(?:-(19|20)\d{2})?(?:-[a-z0-9]+)?$/i
      )
    }

    if (match && match[1]) {
      title = match[1].replace(/-/g, " ")
      // Clean up common streaming site suffixes
      title = title.replace(
        /\s+(full\s+movie|watch\s+online|stream\s+free)$/i,
        ""
      )
      titleFromUrl = true
      console.log("Generic extractor: Found title from URL:", title)
    }
  } catch {
    // ignore
  }

  // 7. Clean title from document if not found in URL
  if (!title) {
    title = cleanTitle(documentTitle, domain)
    console.log("Generic extractor: Using title from document:", title)
  }

  // 8. Validate title - only validate titles that came from document.title
  if (!titleFromUrl && title) {
    // Only validate if title came from document.title, not from URL extraction
    const invalidTitles = [
      "page not found",
      "404",
      "error",
      "loading...",
      "redirecting...",
      "untitled"
    ]
    if (
      invalidTitles.some((invalid) => title.toLowerCase().includes(invalid))
    ) {
      title = undefined
    }
  }

  // 8. Return raw data for further processing
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
