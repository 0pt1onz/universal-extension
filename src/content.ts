import type { PlasmoCSConfig } from "plasmo"

import { extractMediaContext } from "~/websites"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true,
  run_at: "document_idle"
}

const browserAPI = typeof browser !== "undefined" ? browser : chrome
let activeTimestamps: Record<
  string,
  { start_ms: number; end_ms: number | null }
> | null = null
let skipBtn: HTMLButtonElement | null = null
let playbackIntervalId: ReturnType<typeof setInterval> | null = null

function sendMessagePromise<T = unknown>(message: object): Promise<T> {
  if (typeof browser !== "undefined") {
    return browser.runtime.sendMessage(message) as Promise<T>
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => resolve(response))
  })
}

function getMediaContext() {
  const video = document.querySelector("video")
  return extractMediaContext(
    window.location.href,
    document.title,
    document.body.innerText,
    video ? video.currentTime : 0
  )
}

browserAPI.runtime.onMessage.addListener(
  (
    req: { action: string },
    _sender,
    sendResponse: (r: ReturnType<typeof getMediaContext>) => void
  ) => {
    if (req.action === "getPlayerInfo") {
      sendResponse(getMediaContext())
    }
    return true
  }
)

function applyIntroData(res: {
  status: string
  intro?: { start_ms: number; end_ms: number | null }
  recap?: { start_ms: number; end_ms: number | null }
  credits?: { start_ms: number; end_ms: number | null }
}): boolean {
  if (!res || res.status !== "success") return false
  activeTimestamps = {}
  for (const key of ["intro", "recap", "credits"] as const) {
    const seg = res[key]
    if (!seg || typeof seg.start_ms !== "number") continue
    if (key === "credits") {
      activeTimestamps[key] = {
        start_ms: seg.start_ms,
        end_ms: seg.end_ms ?? null
      }
    } else if (typeof seg.end_ms === "number") {
      activeTimestamps[key] = { start_ms: seg.start_ms, end_ms: seg.end_ms }
    }
  }
  if (Object.keys(activeTimestamps).length > 0) {
    monitorPlayback()
    return true
  }
  return false
}

async function init() {
  const ctx = getMediaContext()
  const hasContext = !!(ctx.tmdb_id || ctx.title)

  if (hasContext) {
    const res = await sendMessagePromise<{
      status: string
      intro?: { start_ms: number; end_ms: number | null }
      recap?: { start_ms: number; end_ms: number | null }
      credits?: { start_ms: number; end_ms: number | null }
    }>({
      action: "resolveAndFetch",
      data: { ...ctx, isTV: ctx.type === "tv" }
    })
    if (applyIntroData(res)) return
  }

  const video = document.querySelector("video")
  if (video) {
    const tryStored = async () => {
      const res = await sendMessagePromise<{
        status: string
        intro?: { start_ms: number; end_ms: number | null }
        recap?: { start_ms: number; end_ms: number | null }
        credits?: { start_ms: number; end_ms: number | null }
      }>({ action: "getStoredIntroData" })
      if (applyIntroData(res)) return true
      return false
    }
    if (await tryStored()) return
    const interval = setInterval(async () => {
      if (activeTimestamps) {
        clearInterval(interval)
        return
      }
      if (await tryStored()) clearInterval(interval)
    }, 3000)
    setTimeout(() => clearInterval(interval), 60000)
  }
}

function monitorPlayback() {
  const video = document.querySelector("video")
  if (!video) {
    setTimeout(monitorPlayback, 2000)
    return
  }

  if (playbackIntervalId) {
    clearInterval(playbackIntervalId)
    playbackIntervalId = null
  }

  playbackIntervalId = setInterval(() => {
    if (!activeTimestamps) return
    const v = document.querySelector("video")
    if (!v) return
    const now = v.currentTime * 1000
    const durationMs =
      typeof v.duration === "number" && Number.isFinite(v.duration)
        ? v.duration * 1000
        : 0

    const segment = (["intro", "recap", "credits"] as const).find((key) => {
      const s = activeTimestamps![key]
      if (!s) return false
      const endMs = s.end_ms ?? durationMs
      if (endMs <= 0) return false
      return now >= s.start_ms && now < endMs
    })

    if (segment) {
      const s = activeTimestamps[segment]
      const endMs = s.end_ms ?? durationMs
      if (!skipBtn) createBtn(segment, endMs)
    } else {
      if (skipBtn) {
        skipBtn.remove()
        skipBtn = null
      }
    }
  }, 500)
}

function createBtn(type: string, endMs: number) {
  if (skipBtn) return
  skipBtn = document.createElement("button")
  skipBtn.innerText = `SKIP ${type.toUpperCase()}`
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
    border: "2px solid black",
    boxShadow: "0 0 20px rgba(0,255,136,0.6)",
    fontFamily: "sans-serif",
    fontSize: "12px"
  })
  document.body.appendChild(skipBtn)
  skipBtn.onclick = () => {
    const video = document.querySelector("video")
    if (video) video.currentTime = endMs / 1000
  }
}

init()
