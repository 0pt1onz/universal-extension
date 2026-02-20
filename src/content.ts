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

function monitorPlayback() {
  if (playbackIntervalId) clearInterval(playbackIntervalId)

  playbackIntervalId = setInterval(() => {
    const video = getActiveVideo()
    if (!video || !activeTimestamps) return

    const now = video.currentTime * 1000
    let found: { type: string; end: number } | null = null

    for (const [type, segments] of Object.entries(activeTimestamps)) {
      const active = segments.find(
        (s) => now >= s.start_ms && now < s.end_ms - 500
      )
      if (active) {
        found = { type, end: active.end_ms }
        break
      }
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

  if (!video) return

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
    monitorPlayback()
  }
}

init()