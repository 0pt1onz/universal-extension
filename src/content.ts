import type { PlasmoCSConfig } from "plasmo"

import i18next from "~/i18n/config"
import { trackAnalyticsEvent } from "~/shared/analytics"
import {
  END_OF_VIDEO_SENTINEL_MS,
  SEGMENT_TYPES,
  TRACKED_SEGMENT_TYPES,
  type MediaType,
  type PlayerInfoMessage,
  type Segment,
  type SegmentType,
  type TrackableSegmentType
} from "~/shared/media"
import { extractMediaContext } from "~/websites"
import type { MediaContext } from "~/websites"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_idle"
}

interface IntroResponse {
  status: string
  tmdb_id?: number
  title?: string
  year?: string
  intro?: Segment[]
  recap?: Segment[]
  credits?: Segment[]
  preview?: Segment[]
  reset?: number
}

interface DiscoveryResponse {
  status?: string
  tmdb_id?: number
  title?: string
}

type ActiveSegments = Partial<Record<SegmentType, Segment[]>>

interface LastPlayerInfo {
  title: string
  tmdb_id?: number
  type: MediaType
  season?: number
  episode?: number
  durationMs?: number
}

interface ContentRuntimeState {
  activeSegments: ActiveSegments | null
  skipButton: HTMLButtonElement | null
  playbackIntervalId: ReturnType<typeof setInterval> | null
  lastPlayerInfo: LastPlayerInfo | null
  trackedMediaKey: string | null
  retryCount: number
  lastUrl: string
  urlMonitoringStarted: boolean
  initRunning: boolean
  initScheduledId: ReturnType<typeof setTimeout> | null
  playerPollId: ReturnType<typeof setInterval> | null
  domObserver: MutationObserver | null
  lastLookupKey: string | null
  activeMediaKey: string | null
  inFlightMediaKey: string | null
  suppressUntilMs: number
}

const MAX_RETRIES = 3
const PLAYER_POLL_MS = 10000
const PLAYBACK_POLL_MS = 400
const INVALID_TITLE_RETRY_DELAY_MS = 3000
const SEGMENT_RETRY_DELAY_MS = 5000
const LONG_SUPPRESSION_MS = 60000
const SHORT_SUPPRESSION_MS = 5000
const DOM_INIT_DELAY_MS = 400
const URL_CHANGE_INIT_DELAY_MS = 1200
const DEFAULT_INIT_DELAY_MS = 800
const STORAGE_KEYS = {
  disabledSites: "disabled_sites",
  error: "error",
  skipStats: "skipButtonStats",
  buttonTheme: "button_theme"
} as const

const BUTTON_THEMES = {
  green: {
    bg: "rgba(255, 255, 255, 0.05)",
    bgHover: "rgba(255, 255, 255, 0.1)",
    color: "#34D399",
    colorHover: "#ffffff",
    borderColor: "rgba(255, 255, 255, 0.1)"
  },
  blue: {
    bg: "rgba(59, 130, 246, 0.1)",
    bgHover: "rgba(59, 130, 246, 0.2)",
    color: "#60A5FA",
    colorHover: "#ffffff",
    borderColor: "rgba(59, 130, 246, 0.3)"
  },
  purple: {
    bg: "rgba(168, 85, 247, 0.1)",
    bgHover: "rgba(168, 85, 247, 0.2)",
    color: "#C084FC",
    colorHover: "#ffffff",
    borderColor: "rgba(168, 85, 247, 0.3)"
  },
  white: {
    bg: "rgba(255, 255, 255, 0.05)",
    bgHover: "rgba(255, 255, 255, 0.15)",
    color: "#ffffff",
    colorHover: "#ffffff",
    borderColor: "rgba(255, 255, 255, 0.15)"
  },
  red: {
    bg: "rgba(239, 68, 68, 0.1)",
    bgHover: "rgba(239, 68, 68, 0.2)",
    color: "#F87171",
    colorHover: "#ffffff",
    borderColor: "rgba(239, 68, 68, 0.3)"
  },
  orange: {
    bg: "rgba(249, 115, 22, 0.1)",
    bgHover: "rgba(249, 115, 22, 0.2)",
    color: "#FB923C",
    colorHover: "#ffffff",
    borderColor: "rgba(249, 115, 22, 0.3)"
  },
  cyan: {
    bg: "rgba(6, 182, 212, 0.1)",
    bgHover: "rgba(6, 182, 212, 0.2)",
    color: "#22D3EE",
    colorHover: "#ffffff",
    borderColor: "rgba(6, 182, 212, 0.3)"
  },
  pink: {
    bg: "rgba(236, 72, 153, 0.1)",
    bgHover: "rgba(236, 72, 153, 0.2)",
    color: "#F472B6",
    colorHover: "#ffffff",
    borderColor: "rgba(236, 72, 153, 0.3)"
  }
} as const

type ButtonTheme = keyof typeof BUTTON_THEMES

const state: ContentRuntimeState = {
  activeSegments: null,
  skipButton: null,
  playbackIntervalId: null,
  lastPlayerInfo: null,
  trackedMediaKey: null,
  retryCount: 0,
  lastUrl: window.location.href,
  urlMonitoringStarted: false,
  initRunning: false,
  initScheduledId: null,
  playerPollId: null,
  domObserver: null,
  lastLookupKey: null,
  activeMediaKey: null,
  inFlightMediaKey: null,
  suppressUntilMs: 0
}

function isSuppressed() {
  return Date.now() < state.suppressUntilMs
}

function suppressLookups(durationMs: number) {
  state.suppressUntilMs = Date.now() + durationMs
}

function hasVideoElement() {
  // Simple existence check used by the polling/monitoring logic to decide
  // when to call init(). init() itself will use getActiveVideo() to find
  // the actual playable video element.
  return Boolean(document.querySelector("video"))
}

function shouldInitializeForCurrentPage() {
  return (
    !state.activeMediaKey && (!state.activeSegments || !state.lastPlayerInfo)
  )
}

function isTrackableSegmentType(value: string): value is TrackableSegmentType {
  return TRACKED_SEGMENT_TYPES.includes(value as TrackableSegmentType)
}

function getDefaultSkipStats() {
  return {
    segments_skipped: { intro: 0, recap: 0, credits: 0 },
    time_saved_by_type_ms: { intro: 0, recap: 0, credits: 0 }
  }
}

function buildActiveSegments(response: IntroResponse): ActiveSegments {
  const segments: ActiveSegments = {}

  SEGMENT_TYPES.forEach((type) => {
    if (Array.isArray(response[type])) {
      segments[type] = response[type]
    }
  })

  return segments
}

function handleUrlChange() {
  if (window.location.href !== state.lastUrl) {
    state.lastUrl = window.location.href
    state.retryCount = 0
    state.suppressUntilMs = 0
    resetPageState()
    state.lastLookupKey = null
    state.activeMediaKey = null
    scheduleInit(URL_CHANGE_INIT_DELAY_MS)
  }
}

function monitorUrlChanges() {
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = (...args) => {
    originalPushState(...args)
    window.dispatchEvent(new Event("urlchange"))
  }

  history.replaceState = (...args) => {
    originalReplaceState(...args)
    window.dispatchEvent(new Event("urlchange"))
  }

  window.addEventListener("popstate", handleUrlChange)
  window.addEventListener("urlchange", handleUrlChange)
}

function scheduleInit(delayMs = DEFAULT_INIT_DELAY_MS) {
  if (state.initScheduledId) clearTimeout(state.initScheduledId)
  state.initScheduledId = setTimeout(() => {
    state.initScheduledId = null
    if (!state.initRunning) {
      init()
    }
  }, delayMs)
}

function clearSkipButton() {
  if (state.skipButton) {
    state.skipButton.remove()
    state.skipButton = null
  }
}

function clearMediaState() {
  state.activeSegments = null
  state.lastPlayerInfo = null
  state.activeMediaKey = null
  state.inFlightMediaKey = null
  state.trackedMediaKey = null
}

function resetPageState() {
  clearSkipButton()
  clearMediaState()
  if (state.playbackIntervalId) {
    clearInterval(state.playbackIntervalId)
    state.playbackIntervalId = null
  }
}

function isInvalidDocumentTitle(title: string): boolean {
  const invalidTitles = [
    "page not found",
    "404",
    "error",
    "loading...",
    "redirecting...",
    "unknown"
  ]
  const cleanTitle = title.trim().toLowerCase()
  return invalidTitles.some((invalid) => cleanTitle.includes(invalid))
}

function makeMediaKey(ctx: MediaContext): string | null {
  const idPart = ctx.tmdb_id
    ? `tmdb:${ctx.tmdb_id}`
    : ctx.imdb_id
      ? `imdb:${ctx.imdb_id}`
      : null
  if (!idPart) return null

  if (ctx.type === "tv") {
    const season = ctx.season ?? ""
    const episode = ctx.episode ?? ""
    const episodeId = ctx.episode_id ?? ""
    return `${idPart}|tv|s:${season}|e:${episode}|eid:${episodeId}`
  }

  return `${idPart}|movie`
}

function startPlayerMonitors() {
  if (!state.playerPollId) {
    state.playerPollId = setInterval(() => {
      if (isSuppressed() || !hasVideoElement()) return
      if (shouldInitializeForCurrentPage()) {
        scheduleInit(0)
      }
    }, PLAYER_POLL_MS)
  }

  if (!state.domObserver) {
    state.domObserver = new MutationObserver(() => {
      if (isSuppressed() || !hasVideoElement()) return
      if (shouldInitializeForCurrentPage()) {
        scheduleInit(DOM_INIT_DELAY_MS)
      }
    })

    state.domObserver.observe(document.documentElement, {
      subtree: true,
      childList: true
    })
  }
}

async function recordSkip(type: string, durationMs: number) {
  if (!isTrackableSegmentType(type.toLowerCase())) return

  const storage = await chrome.storage.local.get([STORAGE_KEYS.skipStats])

  const stats = storage[STORAGE_KEYS.skipStats] || getDefaultSkipStats()
  const typeKey = type.toLowerCase()

  stats.segments_skipped[typeKey] += 1
  stats.time_saved_by_type_ms[typeKey] += Math.max(0, durationMs)

  await chrome.storage.local.set({ [STORAGE_KEYS.skipStats]: stats })
}

function getActiveVideo(): HTMLVideoElement | null {
  const videos = findAllVideos()
  if (videos.length === 0) return null

  // 1. Prefer the currently playing video
  const playing = videos.find((v) => !v.paused && v.readyState >= 1)
  if (playing) return playing

  // 2. Pick the video with the largest visible area (avoids ad/preview elements)
  let best = videos[0]
  let bestScore = -1
  for (const v of videos) {
    const w = v.videoWidth || v.clientWidth || 0
    const h = v.videoHeight || v.clientHeight || 0
    const area = w * h
    const hasData = v.readyState >= 2 || (v.duration && v.duration > 0) ? 1 : 0
    // Score: prefer larger area and loaded data
    const score = area + (hasData ? 10000000 : 0) - Math.abs(v.currentTime - 0) * 100
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }

  return best
}

function findAllVideos(): HTMLVideoElement[] {
  const videos: HTMLVideoElement[] = Array.from(
    document.querySelectorAll("video")
  )

  // Also search inside open shadow roots
  const allElements = document.querySelectorAll("*")
  for (const el of allElements) {
    if (el.shadowRoot) {
      videos.push(...el.shadowRoot.querySelectorAll("video"))
    }
  }

  return videos
}

function getKnownDurationMs(video?: HTMLVideoElement | null) {
  const durationSec = video?.duration
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec)) {
    return undefined
  }
  if (durationSec <= 0) return undefined
  const durationMs = Math.round(durationSec * 1000)
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined
}

function applyButtonTheme(
  theme: (typeof BUTTON_THEMES)[keyof typeof BUTTON_THEMES]
) {
  if (!state.skipButton) return

  // Update only visual styles — no cloning, no event listener manipulation.
  // Event handlers read from data attributes set here.
  Object.assign(state.skipButton.style, {
    backgroundColor: theme.bg,
    color: theme.color,
    border: `1px solid ${theme.borderColor}`
  })

  state.skipButton.dataset.themeBg = theme.bg
  state.skipButton.dataset.themeBgHover = theme.bgHover
  state.skipButton.dataset.themeColor = theme.color
  state.skipButton.dataset.themeColorHover = theme.colorHover
}

function createBtn(type: string, endMs: number) {
  if (state.skipButton) return

  state.skipButton = document.createElement("button")
  state.skipButton.innerHTML = `${i18next.t(`content.skipButton.${type}`)} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>`

  // Apply static layout styles once (these never change)
  Object.assign(state.skipButton.style, {
    position: "fixed",
    right: "40px",
    bottom: "130px",
    padding: "10px 20px",
    zIndex: "2147483647",
    fontWeight: "500",
    borderRadius: "9999px",
    cursor: "pointer",
    outline: "none",
    boxShadow:
      "0 4px 20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.02)",
    fontFamily: "sans-serif",
    fontSize: "14px",
    transition: "all 0.2s ease",
    backdropFilter: "blur(4px)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  })

  // Apply default theme (green) — will be overridden by storage read
  applyButtonTheme(BUTTON_THEMES.green)

  // Read stored theme asynchronously and override
  chrome.storage.local.get([STORAGE_KEYS.buttonTheme]).then((storage) => {
    const themeKey =
      (storage[STORAGE_KEYS.buttonTheme] as ButtonTheme) || "green"
    const theme = BUTTON_THEMES[themeKey] || BUTTON_THEMES.green
    applyButtonTheme(theme)
  })

  // Click handler — closes over type/endMs from createBtn parameters
  state.skipButton.onclick = async (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()

    const video = getActiveVideo()
    if (video) {
      const currentMs = video.currentTime * 1000
      const savedMs = endMs - currentMs

      await recordSkip(type, savedMs)
      trackAnalyticsEvent("skip_click", {
        segment: type.toLowerCase(),
        savedMs: Math.max(0, Math.round(savedMs)),
        tmdbId: state.lastPlayerInfo?.tmdb_id ?? 0,
        mediaType: state.lastPlayerInfo?.type ?? "movie",
        season: state.lastPlayerInfo?.season ?? 0,
        episode: state.lastPlayerInfo?.episode ?? 0,
        host: window.location.hostname.replace(/^www\./, "")
      })

      Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "currentTime"
      )?.set?.call(video, endMs / 1000)
    }

    state.skipButton?.remove()
    state.skipButton = null
  }

  // Hover handlers — added once, read current theme from data attributes
  state.skipButton.addEventListener("mouseenter", () => {
    if (!state.skipButton) return
    state.skipButton.style.backgroundColor =
      state.skipButton.dataset.themeBgHover || BUTTON_THEMES.green.bgHover
    state.skipButton.style.color =
      state.skipButton.dataset.themeColorHover || BUTTON_THEMES.green.colorHover
  })

  state.skipButton.addEventListener("mouseleave", () => {
    if (!state.skipButton) return
    state.skipButton.style.backgroundColor =
      state.skipButton.dataset.themeBg || BUTTON_THEMES.green.bg
    state.skipButton.style.color =
      state.skipButton.dataset.themeColor || BUTTON_THEMES.green.color
  })

  document.body.appendChild(state.skipButton)
}

function monitorPlayback() {
  if (state.playbackIntervalId) clearInterval(state.playbackIntervalId)

  state.playbackIntervalId = setInterval(() => {
    const video = getActiveVideo()
    if (!video || !state.activeSegments) {
      return
    }

    const now = video.currentTime * 1000
    const durationMs = video.duration * 1000
    let found: { type: string; end: number } | null = null

    for (const [type, segments] of Object.entries(state.activeSegments)) {
      for (const s of segments) {
        const endMs =
          s.end_ms >= END_OF_VIDEO_SENTINEL_MS || s.end_ms == null
            ? durationMs
            : s.end_ms
        if (now >= s.start_ms && now < endMs - 500) {
          found = { type, end: endMs }
          break
        }
      }
      if (found) break
    }

    if (found) {
      if (!state.skipButton) createBtn(found.type, found.end)
    } else if (state.skipButton) {
      state.skipButton.remove()
      state.skipButton = null
    }
  }, PLAYBACK_POLL_MS)
}

async function init() {
  if (state.initRunning || isSuppressed()) return
  state.initRunning = true
  try {
    const { disabled_sites } = await chrome.storage.local.get([
      STORAGE_KEYS.disabledSites
    ])
    const host = window.location.hostname.replace(/^www\./, "")
    if (Array.isArray(disabled_sites) && disabled_sites.includes(host)) {
      return
    }

    if (!state.urlMonitoringStarted) {
      monitorUrlChanges()
      state.urlMonitoringStarted = true
    }

    startPlayerMonitors()

    const video = getActiveVideo()
    if (!video) {
      resetPageState()
      return
    }

    if (isInvalidDocumentTitle(document.title)) {
      if (state.retryCount < MAX_RETRIES) {
        state.retryCount++
        setTimeout(init, INVALID_TITLE_RETRY_DELAY_MS)
      } else {
        suppressLookups(LONG_SUPPRESSION_MS)
      }
      return
    }

    const ctx = await extractMediaContext(
      window.location.href,
      document.title,
      document.body.innerText,
      video?.currentTime ?? 0
    )

    const mediaKey = makeMediaKey(ctx)
    if (!mediaKey) {
      const attemptKey = `missing_ids|${ctx.type}|${ctx.title || ""}`
      if (attemptKey === state.lastLookupKey) return
      state.lastLookupKey = attemptKey
      resetPageState()
      return
    }

    if (
      state.activeMediaKey === mediaKey &&
      state.activeSegments &&
      state.lastPlayerInfo
    ) {
      monitorPlayback()
      return
    }

    if (state.inFlightMediaKey === mediaKey) {
      return
    }

    resetPageState()
    state.inFlightMediaKey = mediaKey

    const durationMs = getKnownDurationMs(video)

    const res = (await chrome.runtime.sendMessage({
      action: "resolveAndFetch",
      data: {
        ...ctx,
        isTV: ctx.type === "tv",
        duration_ms: durationMs
      }
    })) as IntroResponse
    state.inFlightMediaKey = null

    if (res?.status === "success") {
      const data = buildActiveSegments(res)

      state.activeSegments = data
      state.lastPlayerInfo = {
        title: res.title || ctx.title || "Detected",
        tmdb_id: res.tmdb_id ?? ctx.tmdb_id,
        type: ctx.type,
        season: ctx.season,
        episode: ctx.episode,
        durationMs
      }
      state.activeMediaKey = mediaKey

      if (state.trackedMediaKey !== mediaKey) {
        state.trackedMediaKey = mediaKey
        const host = window.location.hostname.replace(/^www\./, "")
        trackAnalyticsEvent("media_detected", {
          tmdbId: state.lastPlayerInfo.tmdb_id ?? 0,
          mediaType: state.lastPlayerInfo.type,
          season: state.lastPlayerInfo.season ?? 0,
          episode: state.lastPlayerInfo.episode ?? 0,
          host
        })
        trackAnalyticsEvent("segments_loaded", {
          tmdbId: state.lastPlayerInfo.tmdb_id ?? 0,
          mediaType: state.lastPlayerInfo.type,
          season: state.lastPlayerInfo.season ?? 0,
          episode: state.lastPlayerInfo.episode ?? 0,
          host,
          introCount: state.activeSegments.intro?.length ?? 0,
          recapCount: state.activeSegments.recap?.length ?? 0,
          creditsCount: state.activeSegments.credits?.length ?? 0,
          previewCount: state.activeSegments.preview?.length ?? 0
        })
      }

      state.retryCount = 0
      state.suppressUntilMs = 0
      monitorPlayback()
    } else if (res?.status === "rate_limited") {
      suppressLookups(LONG_SUPPRESSION_MS)
      chrome.storage.local.set({
        [STORAGE_KEYS.error]: {
          type: "rate_limited",
          reset: res.reset,
          time: Date.now()
        }
      })
    } else if (res?.status === "api_unreachable") {
      suppressLookups(LONG_SUPPRESSION_MS)
      chrome.storage.local.set({
        [STORAGE_KEYS.error]: { type: "api_unreachable", time: Date.now() }
      })
    } else if (!state.activeSegments) {
      if (state.retryCount < MAX_RETRIES) {
        state.retryCount++
        suppressLookups(SHORT_SUPPRESSION_MS)
        setTimeout(init, SEGMENT_RETRY_DELAY_MS)
      } else {
        suppressLookups(LONG_SUPPRESSION_MS)
      }
    }
  } finally {
    if (state.inFlightMediaKey) {
      state.inFlightMediaKey = null
    }
    state.initRunning = false
  }
}

// Listen for live theme changes from the settings page
chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEYS.buttonTheme]) {
    const themeKey = changes[STORAGE_KEYS.buttonTheme].newValue as ButtonTheme
    const theme = BUTTON_THEMES[themeKey]
    if (theme && state.skipButton) {
      applyButtonTheme(theme)
    }
  }
})

chrome.runtime.onMessage.addListener(
  (msg: { action: string }, _sender, sendResponse: (r: unknown) => void) => {
    if (msg.action === "getPlayerInfo") {
      const video = getActiveVideo()
      const currentTime = video?.currentTime
      const durationMs = getKnownDurationMs(video)
      if (state.lastPlayerInfo) {
        const response: PlayerInfoMessage = {
          ...state.lastPlayerInfo,
          available: true,
          playerAvailable: Boolean(video),
          currentTime:
            typeof currentTime === "number" ? currentTime : undefined,
          durationMs: durationMs ?? state.lastPlayerInfo.durationMs
        }
        sendResponse(response)
      } else {
        extractMediaContext(
          window.location.href,
          document.title,
          document.body.innerText,
          video?.currentTime ?? 0
        )
          .then(async (ctx) => {
            let resolvedTmdbId = ctx?.tmdb_id
            let resolvedTitle =
              state.lastPlayerInfo?.title || ctx.title || "Detected"

            if (ctx && !resolvedTmdbId && !ctx.imdb_id && ctx.title) {
              const discovery = (await chrome.runtime.sendMessage({
                action: "resolveAndFetch",
                data: {
                  ...ctx,
                  isTV: ctx.type === "tv",
                  duration_ms: durationMs
                }
              })) as DiscoveryResponse

              if (discovery?.tmdb_id) resolvedTmdbId = discovery.tmdb_id
              if (discovery?.title) resolvedTitle = discovery.title
            }

            if (resolvedTmdbId || ctx?.imdb_id) {
              const response: PlayerInfoMessage = {
                title: resolvedTitle,
                tmdb_id: resolvedTmdbId,
                type: ctx.type,
                season: ctx.season,
                episode: ctx.episode,
                available: true,
                playerAvailable: Boolean(video),
                reason: video ? undefined : "no_video",
                currentTime:
                  typeof currentTime === "number" ? currentTime : undefined,
                durationMs
              }
              sendResponse(response)
            } else {
              sendResponse({ available: false, reason: "missing_ids" })
            }
          })
          .catch(() => {
            sendResponse(null)
          })
      }
      return true
    }
    return false
  }
)

init()
