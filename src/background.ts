export {}

const TMDB_TOKEN = process.env.PLASMO_PUBLIC_TMDB_TOKEN
const tabIntroData = new Map<
  number,
  { status: string; [key: string]: unknown }
>()
const INTRODB_API =
  process.env.PLASMO_PUBLIC_INTRODB_API || "https://api.theintrodb.org/v2"

const tmdbHeaders = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  Accept: "application/json"
}

async function getTvShowDetails(tmdbId: number): Promise<{
  id: number
  number_of_seasons: number
} | null> {
  const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}`, {
    headers: tmdbHeaders
  })
  if (!res.ok) return null
  const data = (await res.json()) as { id: number; number_of_seasons?: number }
  return {
    id: data.id,
    number_of_seasons: Math.max(1, data.number_of_seasons ?? 1)
  }
}

async function resolveEpisodeId(
  tmdbId: number,
  episodeId: number
): Promise<{ season: number; episode: number } | null> {
  const show = await getTvShowDetails(tmdbId)
  if (!show) return null
  for (let s = 1; s <= show.number_of_seasons; s++) {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${s}`,
      { headers: tmdbHeaders }
    )
    if (!res.ok) continue
    const seasonData = (await res.json()) as {
      episodes?: Array<{ id: number; episode_number: number }>
    }
    const ep = seasonData.episodes?.find((e) => e.id === episodeId)
    if (ep) return { season: s, episode: ep.episode_number }
  }
  return null
}

async function handleDiscovery(data: {
  tmdb_id?: number
  title?: string
  isTV?: boolean
  season?: number
  episode?: number
  episode_id?: number
}) {
  try {
    let tmdbId = data.tmdb_id

    if (
      !tmdbId &&
      data.title &&
      data.title.length > 2 &&
      !/^[a-z]$/i.test(data.title) &&
      data.title.toLowerCase() !== "xprime"
    ) {
      const type = data.isTV ? "tv" : "movie"
      const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(data.title)}`

      const res = await fetch(searchUrl, { headers: tmdbHeaders })

      if (res.ok) {
        const searchData = await res.json()
        if (searchData.results?.length) tmdbId = searchData.results[0].id
      }
    }

    if (!tmdbId) return { status: "not_found" }

    let seasonNumber: number | null = data.season ?? null
    let episodeNumber: number | null = data.episode ?? null

    if (data.isTV) {
      let show = await getTvShowDetails(tmdbId)
      if (!show && data.title && data.title.toLowerCase() !== "xprime") {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(data.title)}`
        const res = await fetch(searchUrl, { headers: tmdbHeaders })
        if (res.ok) {
          const searchData = (await res.json()) as {
            results?: Array<{ id: number }>
          }
          if (searchData.results?.length) {
            tmdbId = searchData.results[0].id
            show = await getTvShowDetails(tmdbId)
          }
        }
      }
      if (!show) return { status: "not_found", tmdb_id: tmdbId }

      if (data.episode_id != null) {
        const resolved = await resolveEpisodeId(tmdbId, data.episode_id)
        if (resolved) {
          seasonNumber = resolved.season
          episodeNumber = resolved.episode
        } else {
          return { status: "not_found", tmdb_id: tmdbId }
        }
      } else {
        seasonNumber = seasonNumber ?? 1
        episodeNumber = episodeNumber ?? 1
      }
    }

    let introUrl = `${INTRODB_API}/media?tmdb_id=${tmdbId}`
    if (data.isTV && seasonNumber != null && episodeNumber != null) {
      introUrl += `&season=${seasonNumber}&episode=${episodeNumber}`
    }

    const { introdb_api_key } = (await chrome.storage.local.get(
      "introdb_api_key"
    )) as {
      introdb_api_key?: string
    }
    const headers: Record<string, string> = { Accept: "application/json" }
    if (introdb_api_key) headers.Authorization = `Bearer ${introdb_api_key}`

    const res = await fetch(introUrl, { headers })
    if (!res.ok) return { status: "no_data", tmdb_id: tmdbId }

    const introData = (await res.json()) as Record<string, unknown>
    const normalized: Record<
      string,
      { start_ms: number; end_ms: number | null }
    > = {}

    const timestamps: Record<
      string,
      Array<{ start_ms: number; end_ms: number | null }>
    > = {}

    for (const key of ["intro", "recap", "credits", "preview"] as const) {
      const segments = introData[key]
      if (!Array.isArray(segments) || segments.length === 0) continue

      timestamps[key] = segments
        .map((s) => ({
          start_ms: s.start_ms ?? s.start! * 1000,
          end_ms: s.end_ms ?? s.end! * 1000
        }))
        .filter((s) => s.start_ms < (s.end_ms ?? Infinity))
    }
    return { status: "success", ...normalized, tmdb_id: tmdbId }
  } catch (e) {
    console.error("Discovery Error:", e)
    return {
      status: "error",
      message: e instanceof Error ? e.message : String(e)
    }
  }
}

chrome.runtime.onMessage.addListener(
  (
    request: { action: string; data?: Parameters<typeof handleDiscovery>[0] },
    sender,
    sendResponse
  ) => {
    if (request.action === "resolveAndFetch" && request.data) {
      handleDiscovery(request.data)
        .then((result) => {
          if (result.status === "success" && sender.tab?.id) {
            tabIntroData.set(sender.tab.id, result)
          }
          sendResponse(result)
        })
        .catch((error) =>
          sendResponse({
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          })
        )
      return true
    }
    if (request.action === "getStoredIntroData" && sender.tab?.id) {
      const stored = tabIntroData.get(sender.tab.id)
      sendResponse(stored ?? { status: "no_data" })
      return false
    }
  }
)

chrome.tabs.onRemoved.addListener((tabId) => tabIntroData.delete(tabId))

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabIntroData.delete(tabId)
  }
})
