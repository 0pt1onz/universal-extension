import type { PlasmoCSConfig } from "plasmo"

import { extractMediaContext } from "~/websites"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
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
  return new Promise((resolve, reject) => {
    browserAPI.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError)
      }
      resolve(response)
    })
  })
}

function cleanTitle(raw: string): string {
  if (!raw) return ""

  return raw
    .replace(/^(watch|stream|online|free)\s+/i, "")
    .replace(/\s*[-|–]\s*.*$/, "")
    .replace(/\bseason\s*\d+\b/gi, "")
    .replace(/\bepisode\s*\d+\b/gi, "")
    .replace(/\bs\d+e\d+\b/gi, "")
    .trim()
}

function extractFromJsonLd(): string | null {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  )

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "")
      const items = Array.isArray(data) ? data : [data]

      for (const item of items) {
        if (item["@type"] === "TVEpisode") {
          return item.partOfSeries?.name ?? null
        }

        if (item["@type"] === "TVSeries") {
          return item.name ?? null
        }

        if (item["@type"] === "Movie") {
          return item.name ?? null
        }
      }
    } catch {
      //nothing
    }
  }

  return null
}

function getMediaContext() {
  if (window !== window.top) {
    throw new Error("Ignore iframe context")
  }

  const video = document.querySelector("video")

  const structuredTitle = extractFromJsonLd()

  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")

  const h1 = document.querySelector("h1")?.innerText

  const rawTitle = structuredTitle || h1 || ogTitle || document.title

  return extractMediaContext(
    window.location.href,
    cleanTitle(rawTitle || ""),
    document.body.innerText,
    video ? video.currentTime : 0
  )
}

browserAPI.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req.action === "getPlayerInfo") {
    sendResponse(getMediaContext())
  }
  return true
})

function applyIntroData(res: {
  status: string
  [key: string]: unknown
}): boolean {
  if (!res || res.status !== "success") return false

  const timestamps: Record<
    string,
    { start_ms: number; end_ms: number | null }
  > = {}

  for (const key of ["intro", "recap", "credits", "preview"] as const) {
    const seg = res[key]
    if (
      seg &&
      typeof seg === "object" &&
      "start_ms" in seg &&
      typeof seg.start_ms === "number"
    ) {
      timestamps[key] = {
        start_ms: seg.start_ms,
        end_ms: (seg as unknown as { end_ms: number | null }).end_ms ?? null
      } as { start_ms: number; end_ms: number | null }
    }
  }

  if (Object.keys(timestamps).length > 0) {
    activeTimestamps = timestamps
    monitorPlayback()
    return true
  }
  return false
}

async function init() {
  await new Promise((resolve) => setTimeout(resolve, 1500))

  const ctx = getMediaContext()

  if (!ctx.title || ctx.title.length <= 2) {
    console.log("Title not ready yet:", ctx.title)
    return
  }

  const hasContext = !!(ctx.tmdb_id || ctx.title)

  if (hasContext) {
    try {
      const res = await sendMessagePromise<{
        status: string
        [key: string]: unknown
      }>({
        action: "resolveAndFetch",
        data: { ...ctx, isTV: ctx.type === "tv" }
      })
      if (applyIntroData(res)) return
    } catch (e) {
      console.error("Initial fetch failed:", e)
    }
  }

  const video = document.querySelector("video")
  if (video) {
    const tryStored = async () => {
      try {
        const res = await sendMessagePromise<{
          status: string
          [key: string]: unknown
        }>({
          action: "getStoredIntroData"
        })
        return applyIntroData(res)
      } catch {
        return false
      }
    }

    if (await tryStored()) return

    const interval = setInterval(async () => {
      if (activeTimestamps || (await tryStored())) {
        clearInterval(interval)
      }
    }, 3000)

    setTimeout(() => clearInterval(interval), 60000)
  }
}

function monitorPlayback() {
  if (playbackIntervalId) clearInterval(playbackIntervalId)

  playbackIntervalId = setInterval(() => {
    const video = document.querySelector("video")
    if (!video || !activeTimestamps) return

    const now = video.currentTime * 1000
    const durationMs = Number.isFinite(video.duration)
      ? video.duration * 1000
      : 0

    const activeSegmentKey = (
      ["intro", "recap", "credits", "preview"] as const
    ).find((key) => {
      const s = activeTimestamps![key]
      if (!s) return false
      const endMs = s.end_ms ?? durationMs
      return now >= s.start_ms && now < endMs
    })

    if (activeSegmentKey) {
      const segment = activeTimestamps[activeSegmentKey]
      const endMs = segment.end_ms ?? durationMs
      if (!skipBtn) createBtn(activeSegmentKey, endMs)
    } else if (skipBtn) {
      skipBtn.remove()
      skipBtn = null
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
    color: "#000000",
    zIndex: "2147483647",
    fontWeight: "900",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(0,255,136,0.6)",
    fontFamily: "sans-serif",
    fontSize: "12px",
    transition: "transform 0.2s"
  })

  skipBtn.onmouseenter = () => {
    skipBtn!.style.transform = "scale(1.05)"
  }
  skipBtn.onmouseleave = () => {
    skipBtn!.style.transform = "scale(1)"
  }

  skipBtn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const video = document.querySelector("video")
    if (video) {
      video.currentTime = endMs / 1000
      skipBtn?.remove()
      skipBtn = null
    }
  }

  document.body.appendChild(skipBtn)
}

init()
