import type { PlasmoCSConfig } from "plasmo"

import i18next from "~/i18n/config"
import { extractMediaContext } from "~/websites"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true,
  run_at: "document_idle"
}

interface Segment {
  start_ms: number
  end_ms: number
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

interface MediaContext {
  title: string
  type: "tv" | "movie"
  season?: number
  episode?: number
  episode_id?: number
  tmdb_id?: number
  imdb_id?: string
  year?: string
}

let activeTimestamps: Record<string, Segment[]> | null = null
let skipBtn: HTMLButtonElement | null = null
let playbackIntervalId: ReturnType<typeof setInterval> | null = null
let lastPlayerInfo: {
  title: string
  tmdb_id?: number
  type: "tv" | "movie"
  season?: number
  episode?: number
} | null = null
let retryCount = 0
const MAX_RETRIES = 3
let lastUrl = window.location.href
let urlMonitoringStarted = false
let initRunning = false
let initScheduledId: ReturnType<typeof setTimeout> | null = null
let playerPollId: ReturnType<typeof setInterval> | null = null
let domObserver: MutationObserver | null = null
let lastLookupKey: string | null = null
let activeMediaKey: string | null = null
let inFlightMediaKey: string | null = null
let suppressUntilMs = 0

// Monitor for URL changes to reset retry counter
function monitorUrlChanges() {
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      console.log("URL changed, resetting retry counter")
      lastUrl = window.location.href
      retryCount = 0
      suppressUntilMs = 0
      resetPageState()
      lastLookupKey = null
      activeMediaKey = null
      scheduleInit(1200)
    }
  }, 1000)
}

function scheduleInit(delayMs = 800) {
  if (initScheduledId) clearTimeout(initScheduledId)
  initScheduledId = setTimeout(() => {
    initScheduledId = null
    if (!initRunning) {
      init()
    }
  }, delayMs)
}

function clearSkipButton() {
  if (skipBtn) {
    skipBtn.remove()
    skipBtn = null
  }
}

function clearMediaState() {
  activeTimestamps = null
  lastPlayerInfo = null
  activeMediaKey = null
  inFlightMediaKey = null
}

function resetPageState() {
  clearSkipButton()
  clearMediaState()
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
  if (!playerPollId) {
    playerPollId = setInterval(() => {
      if (Date.now() < suppressUntilMs) return
      const hasVideo = !!document.querySelector("video")
      if (!hasVideo) return
      if (!activeMediaKey && (!activeTimestamps || !lastPlayerInfo)) {
        scheduleInit(0)
      }
    }, 10000)
  }

  if (!domObserver) {
    domObserver = new MutationObserver(() => {
      if (Date.now() < suppressUntilMs) return
      const hasVideo = !!document.querySelector("video")
      if (!hasVideo) return
      if (!activeMediaKey && (!activeTimestamps || !lastPlayerInfo)) {
        scheduleInit(400)
      }
    })

    domObserver.observe(document.documentElement, {
      subtree: true,
      childList: true
    })
  }
}

async function recordSkip(type: string, durationMs: number) {
  const key = "skipButtonStats"
  const storage = await chrome.storage.local.get([key])

  const stats = storage[key] || {
    segments_skipped: { intro: 0, recap: 0, credits: 0 },
    time_saved_by_type_ms: { intro: 0, recap: 0, credits: 0 }
  }

  const typeKey = type.toLowerCase() as "intro" | "recap" | "credits"

  if (stats.segments_skipped[typeKey] !== undefined) {
    stats.segments_skipped[typeKey] += 1
    stats.time_saved_by_type_ms[typeKey] += Math.max(0, durationMs)
    await chrome.storage.local.set({ [key]: stats })
  }
}

function getActiveVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video"))
  return videos.find((v) => !v.paused) || videos[0] || null
}

function createBtn(type: string, endMs: number) {
  if (skipBtn) return

  skipBtn = document.createElement("button")
  skipBtn.innerHTML = `${i18next.t(`content.skipButton.${type}`)} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>`

  Object.assign(skipBtn.style, {
    position: "fixed",
    right: "40px",
    bottom: "130px",
    padding: "14px 28px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#34D399",
    zIndex: "2147483647",
    fontWeight: "900",
    borderRadius: "9999px",
    cursor: "pointer",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    outline: "none",
    boxShadow:
      "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
    fontFamily: "sans-serif",
    fontSize: "12px",
    transition: "transform 0.1s ease, background-color 0.2s ease",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  })

  // Add hover effect
  skipBtn.addEventListener("mouseenter", () => {
    skipBtn.style.backgroundColor = "rgba(255, 255, 255, 0.1)"
    skipBtn.style.color = "#ffffff"
  })

  skipBtn.addEventListener("mouseleave", () => {
    skipBtn.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
    skipBtn.style.color = "#34D399"
  })

  skipBtn.onclick = async (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()

    const video = getActiveVideo()
    if (video) {
      const currentMs = video.currentTime * 1000
      const savedMs = endMs - currentMs

      await recordSkip(type, savedMs)

      Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "currentTime"
      )?.set?.call(video, endMs / 1000)
    }

    skipBtn?.remove()
    skipBtn = null
  }

  document.body.appendChild(skipBtn)
}

const END_OF_VIDEO_SENTINEL_MS = 86400000

function monitorPlayback() {
  if (playbackIntervalId) clearInterval(playbackIntervalId)

  playbackIntervalId = setInterval(() => {
    const video = getActiveVideo()
    if (!video || !activeTimestamps) {
      return
    }

    const now = video.currentTime * 1000
    const durationMs = video.duration * 1000
    let found: { type: string; end: number } | null = null

    for (const [type, segments] of Object.entries(activeTimestamps)) {
      for (const s of segments) {
        const endMs =
          s.end_ms >= END_OF_VIDEO_SENTINEL_MS || !s.end_ms
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
      if (!skipBtn) createBtn(found.type, found.end)
    } else if (skipBtn) {
      skipBtn.remove()
      skipBtn = null
    }
  }, 400)
}

async function init() {
  if (initRunning) return
  if (Date.now() < suppressUntilMs) return
  initRunning = true
  try {
    const { disabled_sites } = await chrome.storage.local.get([
      "disabled_sites"
    ])
    const host = window.location.hostname.replace(/^www./, "")
    if (Array.isArray(disabled_sites) && disabled_sites.includes(host)) {
      return
    }

    // Start URL change monitoring on first init
    if (!urlMonitoringStarted) {
      monitorUrlChanges()
      urlMonitoringStarted = true
    }

    startPlayerMonitors()

    const video = getActiveVideo()
    if (!video) {
      console.log("No HTML video element detected; skipping TIDB lookup")
      resetPageState()
      return
    }

    if (isInvalidDocumentTitle(document.title)) {
      console.log("Skipping invalid page title:", document.title)
      if (retryCount < MAX_RETRIES) {
        retryCount++
        console.log(
          `Retry attempt ${retryCount}/${MAX_RETRIES} for invalid title`
        )
        setTimeout(init, 3000) // Retry in 3 seconds
      } else {
        console.log("Max retries reached for invalid title, stopping attempts")
        suppressUntilMs = Date.now() + 60000
      }
      return
    }

    const ctx = (await extractMediaContext(
      window.location.href,
      document.title,
      document.body.innerText,
      video?.currentTime ?? 0
    )) as MediaContext

    const mediaKey = makeMediaKey(ctx)
    if (!mediaKey) {
      const attemptKey = `missing_ids|${ctx.type}|${ctx.title || ""}`
      if (attemptKey === lastLookupKey) return
      console.log("Skipping TIDB lookup: media is missing TMDB ID and IMDb ID")
      lastLookupKey = attemptKey
      resetPageState()
      return
    }

    if (activeMediaKey === mediaKey && activeTimestamps && lastPlayerInfo) {
      monitorPlayback()
      return
    }

    if (inFlightMediaKey === mediaKey) {
      return
    }

    resetPageState()
    inFlightMediaKey = mediaKey

    const res = (await chrome.runtime.sendMessage({
      action: "resolveAndFetch",
      data: {
        ...ctx,
        isTV: ctx.type === "tv"
      }
    })) as IntroResponse
    inFlightMediaKey = null

    console.log("TIDB API Response:", res)

    if (res?.status === "success") {
      const data: Record<string, Segment[]> = {}
      const keys = ["intro", "recap", "credits", "preview"] as const

      keys.forEach((k) => {
        if (Array.isArray(res[k])) {
          data[k] = res[k]!
        }
      })

      console.log("Parsed segments:", data)
      activeTimestamps = data
      lastPlayerInfo = {
        title: res.title || ctx.title || "Detected",
        tmdb_id: res.tmdb_id ?? ctx.tmdb_id,
        type: ctx.type,
        season: ctx.season,
        episode: ctx.episode
      }
      activeMediaKey = mediaKey
      // Reset retry counter on successful data retrieval
      retryCount = 0
      suppressUntilMs = 0
      monitorPlayback()
    } else if (res?.status === "rate_limited") {
      suppressUntilMs = Date.now() + 60000
      chrome.storage.local.set({
        error: { type: "rate_limited", reset: res.reset, time: Date.now() }
      })
    } else if (res?.status === "api_unreachable") {
      suppressUntilMs = Date.now() + 60000
      chrome.storage.local.set({
        error: { type: "api_unreachable", time: Date.now() }
      })
    } else if (!activeTimestamps) {
      if (retryCount < MAX_RETRIES) {
        retryCount++
        console.log(
          `No segments found, retry attempt ${retryCount}/${MAX_RETRIES}`
        )
        suppressUntilMs = Date.now() + 5000
        setTimeout(init, 5000)
      } else {
        console.log(
          "Max retries reached for finding segments, stopping attempts"
        )
        suppressUntilMs = Date.now() + 60000
      }
    }
  } finally {
    if (inFlightMediaKey) {
      inFlightMediaKey = null
    }
    initRunning = false
  }
}

chrome.runtime.onMessage.addListener(
  (msg: { action: string }, _sender, sendResponse: (r: unknown) => void) => {
    if (msg.action === "getPlayerInfo") {
      const video = getActiveVideo()
      if (!video) {
        sendResponse({ available: false, reason: "no_video" })
        return false
      }
      const currentTime = video ? video.currentTime : undefined
      if (lastPlayerInfo) {
        sendResponse({
          ...lastPlayerInfo,
          available: true,
          currentTime: typeof currentTime === "number" ? currentTime : undefined
        })
      } else {
        extractMediaContext(
          window.location.href,
          document.title,
          document.body.innerText,
          video?.currentTime ?? 0
        )
          .then((ctx) => {
            if (ctx?.tmdb_id || ctx?.imdb_id) {
              sendResponse({
                title: lastPlayerInfo?.title || ctx.title || "Detected",
                tmdb_id: ctx.tmdb_id,
                type: ctx.type,
                season: ctx.season,
                episode: ctx.episode,
                available: true,
                currentTime:
                  typeof currentTime === "number" ? currentTime : undefined
              })
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
