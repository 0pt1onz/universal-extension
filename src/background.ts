export {}

const TMDB_TOKEN = process.env.PLASMO_PUBLIC_TMDB_TOKEN
const INTRODB_API =
  process.env.PLASMO_PUBLIC_INTRODB_API || "https://api.theintrodb.org/v2"

interface TMDBResult {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}
interface IntroDBSegment {
  start_ms: number | null
  end_ms: number | null
  start?: number
  end?: number
}

interface DiscoveryResult {
  status: string
  tmdb_id?: number
  title?: string
  year?: string
  intro?: Array<{ start_ms: number; end_ms: number }>
  recap?: Array<{ start_ms: number; end_ms: number }>
  credits?: Array<{ start_ms: number; end_ms: number }>
  preview?: Array<{ start_ms: number; end_ms: number }>
  reset?: number
}

interface DiscoveryRequest {
  tmdb_id?: number
  imdb_id?: string
  title?: string
  isTV?: boolean
  season?: number
  episode?: number
  episode_id?: number
  year?: string
}

const tmdbHeaders = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  Accept: "application/json"
}
const cleanTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .trim()

async function handleDiscovery(
  data: DiscoveryRequest
): Promise<DiscoveryResult> {
  try {
    let tmdbId = data.tmdb_id
    let tmdbResult: TMDBResult | null = null

    if (!tmdbId && data.imdb_id) {
      const res = await fetch(
        `https://api.themoviedb.org/3/find/${data.imdb_id}?external_source=imdb_id`,
        { headers: tmdbHeaders }
      )
      if (res.ok) {
        const findData = await res.json()
        const result = findData.movie_results?.[0] || findData.tv_results?.[0]
        if (result) {
          tmdbId = result.id
          tmdbResult = result
        }
      }
    }

    if (!tmdbId && data.title && data.title.length > 2) {
      const type = data.isTV ? "tv" : "movie"
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(data.title)}`,
        { headers: tmdbHeaders }
      )

      if (res.ok) {
        const sData = await res.json()
        const results: TMDBResult[] = sData.results || []
        if (results.length > 0) {
          const targetTitle = cleanTitle(data.title)
          const match = results.find((r) => {
            const rDate = r.release_date || r.first_air_date || ""
            const rTitle = cleanTitle(r.title || r.name || "")
            return (
              (data.year ? rDate.startsWith(data.year) : true) &&
              (rTitle.includes(targetTitle) || targetTitle.includes(rTitle))
            )
          })
          tmdbResult = match || results[0]
          tmdbId = tmdbResult.id
        }
      }
    }

    if (!tmdbId) return { status: "not_found" }

    const sNum = data.season ?? 1
    const eNum = data.episode ?? 1
    const introRes = await fetch(
      `${INTRODB_API}/media?tmdb_id=${tmdbId}${data.isTV ? `&season=${sNum}&episode=${eNum}` : ""}`,
      { headers: { Accept: "application/json" } }
    )

    if (!introRes.ok) {
      if (introRes.status === 429) {
        const reset =
          introRes.headers.get("X-RateLimit-Reset") ||
          introRes.headers.get("X-UsageLimit-Reset")
        return {
          status: "rate_limited",
          reset: reset ? parseInt(reset, 10) : undefined
        }
      }
      return {
        status: "no_data",
        tmdb_id: tmdbId,
        title: tmdbResult?.title || tmdbResult?.name || data.title,
        year:
          tmdbResult?.release_date || tmdbResult?.first_air_date || data.year
      }
    }

    const introData = await introRes.json()
    const result: DiscoveryResult = {
      status: "success",
      tmdb_id: tmdbId,
      title: tmdbResult?.title || tmdbResult?.name || data.title,
      year: tmdbResult?.release_date || tmdbResult?.first_air_date || data.year
    }
    const keys = ["intro", "recap", "credits", "preview"] as const

    const END_OF_VIDEO_MS = 86400000
    for (const key of keys) {
      const raw = introData[key]
      if (!Array.isArray(raw)) continue
      const segments = (raw as IntroDBSegment[])
        .map((s) => {
          const start = s.start_ms ?? (s.start ? s.start * 1000 : 0)
          const end = s.end_ms ?? (s.end ? s.end * 1000 : END_OF_VIDEO_MS)
          return { start_ms: start, end_ms: end }
        })
        .filter((s) => s.end_ms > s.start_ms || s.end_ms >= END_OF_VIDEO_MS)
      if (segments.length > 0) result[key] = segments
    }
    return result
  } catch {
    return { status: "api_unreachable" }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "resolveAndFetch" && request.data) {
    handleDiscovery(request.data).then(sendResponse)
    return true
  } else if (request.action === "fetchNetflixMetadata" && request.netflixId) {
    const { documentTitle, season, episode } = request
    const isTV = season != null || episode != null

    handleDiscovery({
      title: documentTitle,
      isTV: isTV,
      season: season,
      episode: episode
    }).then(sendResponse)
    return true
  }
})
