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
  intro?: Segment[]
  recap?: Segment[]
  credits?: Segment[]
  preview?: Segment[]
}

interface MediaContext {
  title: string
  type: "tv" | "movie"
  season?: number
  episode?: number
  episode_id?: number
  tmdb_id?: number
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
let initRetryCount = 0

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
  skipBtn.textContent = `SKIP ${type.toUpperCase()}`

  Object.assign(skipBtn.style, {
    position: "fixed",
    right: "40px",
    bottom: "130px",
    padding: "14px 28px",
    backgroundColor: "#ffffff",
    color: "#000",
    zIndex: "2147483647",
    fontWeight: "900",
    borderRadius: "8px",
    cursor: "pointer",
    border: "none",
    outline: "none",
    boxShadow: "0 0 20px rgba(0,255,136,0.6)",
    fontFamily: "sans-serif",
    fontSize: "12px",
    transition: "transform 0.1s ease"
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
    if (!video || !activeTimestamps) return

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
  const video = await new Promise<HTMLVideoElement | null>((res) => {
    let attempts = 0
    const check = setInterval(() => {
      const v = getActiveVideo()
      attempts++
      if (v) {
        clearInterval(check)
        res(v)
      } else if (attempts > 20) {
        clearInterval(check)
        res(null)
      }
    }, 500)
  })

  if (!video) {
    if (initRetryCount < 3) {
      initRetryCount++
      setTimeout(init, 5000)
    }
    return
  }

  initRetryCount = 0
  const ctx = extractMediaContext(
    window.location.href,
    document.title,
    document.body.innerText,
    video.currentTime
  ) as MediaContext

  if (!ctx?.title && !ctx?.tmdb_id) return

  const res = (await chrome.runtime.sendMessage({
    action: "resolveAndFetch",
    data: {
      ...ctx,
      isTV: ctx.type === "tv"
    }
  })) as IntroResponse

  if (res?.status === "success") {
    const data: Record<string, Segment[]> = {}
    const keys = ["intro", "recap", "credits", "preview"] as const

    keys.forEach((k) => {
      if (Array.isArray(res[k])) {
        data[k] = res[k]!
      }
    })

    activeTimestamps = data
    lastPlayerInfo = {
      title: ctx.title || "Detected",
      tmdb_id: res.tmdb_id ?? ctx.tmdb_id,
      type: ctx.type,
      season: ctx.season,
      episode: ctx.episode
    }
    monitorPlayback()
  } else if (!activeTimestamps) {
    setTimeout(init, 5000)
  }
}

chrome.runtime.onMessage.addListener(
  (
    msg: { action: string },
    _sender,
    sendResponse: (r: unknown) => void
  ) => {
    if (msg.action === "getPlayerInfo") {
      const video = getActiveVideo()
      const currentTime = video ? video.currentTime : undefined
      if (lastPlayerInfo) {
        sendResponse({
          ...lastPlayerInfo,
          currentTime:
            typeof currentTime === "number" ? currentTime : undefined
        })
      } else {
        const ctx = extractMediaContext(
          window.location.href,
          document.title,
          document.body.innerText,
          video?.currentTime ?? 0
        ) as MediaContext
        if (ctx?.title || ctx?.tmdb_id) {
          sendResponse({
            title: ctx.title || "Detected",
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
      }
      return true
    }
    return false
  }
)

init()
