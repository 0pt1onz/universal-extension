import type { PlasmoCSConfig } from "plasmo"

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

// Monitor for URL changes to reset retry counter
function monitorUrlChanges() {
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      console.log("URL changed, resetting retry counter")
      lastUrl = window.location.href
      retryCount = 0
    }
  }, 1000)
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
  skipBtn.innerHTML = `SKIP ${type.toUpperCase()} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>`

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
  const { disabled_sites } = await chrome.storage.local.get(["disabled_sites"])
  const host = window.location.hostname.replace(/^www./, "")
  if (Array.isArray(disabled_sites) && disabled_sites.includes(host)) {
    return
  }

  // Start URL change monitoring on first init
  if (!urlMonitoringStarted) {
    monitorUrlChanges()
    urlMonitoringStarted = true
  }

  const video = getActiveVideo()

  // Skip if the page title indicates an error or not found page
  const invalidTitles = [
    "page not found",
    "404",
    "error",
    "loading...",
    "redirecting..."
  ]
  const cleanTitle = document.title.trim().toLowerCase()
  if (invalidTitles.some((invalid) => cleanTitle.includes(invalid))) {
    console.log("Skipping invalid page title:", document.title)
    if (retryCount < MAX_RETRIES) {
      retryCount++
      console.log(
        `Retry attempt ${retryCount}/${MAX_RETRIES} for invalid title`
      )
      setTimeout(init, 3000) // Retry in 3 seconds
    } else {
      console.log("Max retries reached for invalid title, stopping attempts")
    }
    return
  }

  const ctx = (await extractMediaContext(
    window.location.href,
    document.title,
    document.body.innerText,
    video?.currentTime ?? 0
  )) as MediaContext

  if (!ctx?.title && !ctx?.tmdb_id && !ctx?.imdb_id) {
    console.log("No valid media context found (no title, TMDB ID, or IMDb ID)")
    if (retryCount < MAX_RETRIES) {
      retryCount++
      console.log(
        `Retry attempt ${retryCount}/${MAX_RETRIES} for missing media context`
      )
      setTimeout(init, 5000)
    } else {
      console.log(
        "Max retries reached for missing media context, stopping attempts"
      )
    }
    return
  }

  const res = (await chrome.runtime.sendMessage({
    action: "resolveAndFetch",
    data: {
      ...ctx,
      isTV: ctx.type === "tv"
    }
  })) as IntroResponse

  console.log("IntroDB API Response:", res)

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
    // Reset retry counter on successful data retrieval
    retryCount = 0
    monitorPlayback()
  } else if (res?.status === "rate_limited") {
    chrome.storage.local.set({
      error: { type: "rate_limited", reset: res.reset, time: Date.now() }
    })
  } else if (res?.status === "api_unreachable") {
    chrome.storage.local.set({
      error: { type: "api_unreachable", time: Date.now() }
    })
  } else if (!activeTimestamps) {
    if (retryCount < MAX_RETRIES) {
      retryCount++
      console.log(
        `No segments found, retry attempt ${retryCount}/${MAX_RETRIES}`
      )
      setTimeout(init, 5000)
    } else {
      console.log("Max retries reached for finding segments, stopping attempts")
    }
  }
}

chrome.runtime.onMessage.addListener(
  (msg: { action: string }, _sender, sendResponse: (r: unknown) => void) => {
    if (msg.action === "getPlayerInfo") {
      const video = getActiveVideo()
      const currentTime = video ? video.currentTime : undefined
      if (lastPlayerInfo) {
        sendResponse({
          ...lastPlayerInfo,
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
            if (ctx?.title || ctx?.tmdb_id || ctx?.imdb_id) {
              sendResponse({
                title: lastPlayerInfo?.title || ctx.title || "Detected",
                tmdb_id: ctx.tmdb_id,
                type: ctx.type,
                season: ctx.season,
                episode: ctx.episode,
                currentTime:
                  typeof currentTime === "number" ? currentTime : undefined
              })
            } else {
              sendResponse(null)
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
