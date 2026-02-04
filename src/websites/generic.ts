import type { MediaContext } from "./types"

/**
 * Generic extractor: URL regex and heuristics that work across most sites
 * (e.g. /tv/id/s/e, tmdb-tv-id slug, /watch/id, S01E03 in body, episode in path).
 * Use site-specific extractors in this folder for sites that need custom logic.
 */
export function extractGeneric(
  url: string,
  documentTitle: string,
  bodyText: string,
  currentTime = 0
): MediaContext {
  let tmdb_id: number | null = null
  let season: number | null = null
  let episode: number | null = null
  let episode_id: number | null = null

  const isTV = /\/tv\//i.test(url) || /tmdb-tv-\d+/i.test(url)

  if (isTV) {
    const tvShowSeasonEpisode = url.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/i)
    if (tvShowSeasonEpisode) {
      tmdb_id = parseInt(tvShowSeasonEpisode[1], 10)
      season = parseInt(tvShowSeasonEpisode[2], 10)
      episode = parseInt(tvShowSeasonEpisode[3], 10)
    }

    const tmdbTvSlug = url.match(/tmdb-tv-(\d+)(?:-[^/]*)?\/(\d+)\/(\d+)/i)
    if (tmdbTvSlug && !tmdb_id) {
      tmdb_id = parseInt(tmdbTvSlug[1], 10)
      const first = parseInt(tmdbTvSlug[2], 10)
      const second = parseInt(tmdbTvSlug[3], 10)
      if (first <= 999 && second <= 999) {
        season = first
        episode = second
      } else {
        episode_id = second
      }
    }

    if (!tmdb_id) {
      const watchMatch = url.match(/\/watch\/(\d+)/i)
      const genericTv = url.match(/\/(tv|movie)\/(\d+)/i)
      const tmdbMatch = url.match(/tmdb[/-](\d+)/i)
      const idMatch = watchMatch || genericTv || tmdbMatch
      tmdb_id = idMatch ? parseInt(idMatch[idMatch.length - 1], 10) : null
    }

    if (tmdb_id && season == null && episode == null && !episode_id) {
      const tvMatch =
        url.match(/\/watch\/\d+\/(\d+)\/(\d+)/) ||
        bodyText.match(/S(\d+)\s*E(\d+)/i) ||
        bodyText.match(/(\d+)x(\d+)/)
      if (tvMatch) {
        season = parseInt(tvMatch[1], 10)
        episode = parseInt(tvMatch[2], 10)
      }
      if (episode == null) {
        const episodeInPath =
          url.match(/\/(?:episode|e)\/(\d+)/i) || url.match(/\/s\d*e(\d+)/i)
        if (episodeInPath) {
          episode = parseInt(episodeInPath[1], 10)
          if (episode >= 1 && episode <= 999) season = season ?? 1
        } else {
          const trailingNum = url.match(/\/(\d+)(?:\?|$)/)
          if (trailingNum) {
            const n = parseInt(trailingNum[1], 10)
            if (n >= 1 && n <= 999) {
              episode = n
              season = season ?? 1
            }
          }
        }
      }
    }
  } else {
    const movieMatch =
      url.match(/\/(movie)\/(\d+)/i) || url.match(/tmdb[/-](\d+)/i)
    tmdb_id = movieMatch
      ? parseInt(movieMatch[movieMatch.length - 1], 10)
      : null
  }

  if (!tmdb_id && bodyText) {
    const anyId = url.match(/tmdb[/-](\d+)/i)
    if (anyId) tmdb_id = parseInt(anyId[1], 10)
  }

  const cleanTitle = documentTitle
    .replace(/XPrime|Cineby|Watching|Online|Free/gi, "")
    .split(/[-|–|—]/)[0]
    .trim()

  return {
    title: cleanTitle,
    tmdb_id,
    type: isTV ? "tv" : "movie",
    season,
    episode,
    episode_id,
    currentTime
  }
}
