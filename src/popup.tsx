import "~style.css"
import "~/i18n/config"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import smallLogo from "url:../assets/small-logo.svg"

import { api, API_URL } from "./popup/api"
import { ErrorDisplay } from "./popup/ErrorDisplay"
import { Footer } from "./popup/Footer"
import { MainPage, type SegmentType } from "./popup/MainPage"
import { SetupPage } from "./popup/SetupPage"
import { StatsPage } from "./popup/StatsPage"
import { formatSeconds, formatTime, parseTimeToSeconds } from "./popup/utils"
import {
  ANALYTICS_STORAGE_KEY,
  normalizeAnalyticsEnabled,
  trackAnalyticsEvent,
  writeAnonymousUsageReportingEnabled
} from "./shared/analytics"
import type { MediaType, PlayerInfoMessage } from "./shared/media"

type PopupView = "setup" | "main" | "stats"
type PlayerInfoResponse = PlayerInfoMessage | null
type ActiveTabPlayerInfoResult =
  | { state: "missing_tab"; response: null }
  | { state: "unsupported_page"; response: null }
  | { state: "message_failed"; response: null; error: string | undefined }
  | { state: "ok"; response: PlayerInfoResponse }

const ACTIVE_TAB_QUERY = { active: true, currentWindow: true }
const PLAYER_INFO_MESSAGE = { action: "getPlayerInfo" }
const POLL_INTERVAL_MS = 5000
const RECENT_ERROR_WINDOW_MS = 60000
const UNSUPPORTED_URL_PREFIXES = [
  "chrome://",
  "edge://",
  "about:",
  "moz-extension://"
]

function isSupportedTabUrl(url?: string) {
  return (
    Boolean(url) &&
    !UNSUPPORTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
  )
}

function IndexPopup() {
  const { t } = useTranslation()
  const [view, setView] = useState<PopupView>("setup")
  const [mediaTitle, setMediaTitle] = useState("Detecting...")
  const [mediaMeta, setMediaMeta] = useState("Initializing")
  const [tmdbId, setTmdbId] = useState("")
  const [mediaType, setMediaType] = useState<MediaType>("movie")
  const [season, setSeason] = useState("")
  const [episode, setEpisode] = useState("")
  const [startSec, setStartSec] = useState("")
  const [endSec, setEndSec] = useState("")
  const [videoDuration, setVideoDuration] = useState("")
  const [segment, setSegment] = useState<SegmentType>("intro")
  const [status, setStatus] = useState("")
  const [statusColor, setStatusColor] = useState("")
  const [notice, setNotice] = useState("")
  const [showDebugLogs, setShowDebugLogs] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [anonymousUsageReportingEnabled, setAnonymousUsageReportingEnabled] =
    useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startSecRef = useRef(startSec)
  const videoDurationRef = useRef(videoDuration)
  const trackedPopupMediaKeyRef = useRef<string | null>(null)
  const canSubmit = Number.isFinite(Number(tmdbId)) && Number(tmdbId) > 0

  const appendDebugLog = useCallback((message: string) => {
    console.debug("[popup]", message)
    setDebugLogs((previousLogs) => {
      if (previousLogs[0] === message) {
        return previousLogs
      }

      return [message, ...previousLogs].slice(0, 6)
    })
  }, [])

  const track = useCallback(
    (name: string, props?: Record<string, string | number>) => {
      if (!anonymousUsageReportingEnabled) return
      trackAnalyticsEvent(name, props)
    },
    [anonymousUsageReportingEnabled]
  )

  const currentMediaProps = useCallback(() => {
    const tmdbIdNumber = Number(tmdbId)
    const normalizedTmdbId = Number.isFinite(tmdbIdNumber) ? tmdbIdNumber : 0
    const normalizedSeason = mediaType === "tv" ? Number(season) || 0 : 0
    const normalizedEpisode = mediaType === "tv" ? Number(episode) || 0 : 0

    return {
      tmdbId: normalizedTmdbId,
      mediaType,
      season: normalizedSeason,
      episode: normalizedEpisode
    }
  }, [episode, mediaType, season, tmdbId])

  const getPlayerInfoFromActiveTab = useCallback(async () => {
    const [tab] = await api.tabs.query(ACTIVE_TAB_QUERY)
    if (!tab?.id) {
      appendDebugLog("No active tab id available for popup lookup.")
      return {
        state: "missing_tab",
        response: null
      } satisfies ActiveTabPlayerInfoResult
    }

    if (!isSupportedTabUrl(tab.url)) {
      appendDebugLog(`Unsupported tab URL: ${tab.url}`)
      return {
        state: "unsupported_page",
        response: null
      } satisfies ActiveTabPlayerInfoResult
    }

    const result = await new Promise<{
      response: PlayerInfoResponse
      error?: string
    }>((resolve) => {
      api.tabs.sendMessage(tab.id, PLAYER_INFO_MESSAGE, (message) => {
        if (api.runtime.lastError) {
          resolve({
            response: null,
            error: api.runtime.lastError.message
          })
          return
        }

        resolve({ response: message })
      })
    })

    if (result.error) {
      appendDebugLog(`sendMessage failed: ${result.error}`)
      return {
        state: "message_failed",
        response: null,
        error: result.error
      } satisfies ActiveTabPlayerInfoResult
    }

    appendDebugLog("Content script responded to getPlayerInfo.")
    return {
      state: "ok",
      response: result.response
    } satisfies ActiveTabPlayerInfoResult
  }, [appendDebugLog])

  const loadPlayerInfo = useCallback(async () => {
    const { state, response, error } = await getPlayerInfoFromActiveTab()

    if (state === "missing_tab" || state === "unsupported_page") {
      setNotice("")
      setMediaTitle(t("errors.cannotRunOnThisPage"))
      setMediaMeta("")
      return
    }

    if (state === "message_failed" || !response) {
      setNotice(
        "This tab does not have an active content script yet. Reload the page once to reconnect the extension."
      )
      setMediaTitle(t("errors.refreshPageToSync"))
      setMediaMeta(
        error ? "The extension needs to reattach to the current tab." : ""
      )
      return
    }

    if (response.available === false) {
      appendDebugLog(
        `Player info unavailable${response.reason ? `: ${response.reason}` : "."}`
      )
      setNotice("")
      setMediaTitle(t("errors.notAvailableOnThisPage"))
      setMediaMeta(t("errors.noHtmlVideoPlayerDetected"))
      return
    }

    appendDebugLog(
      `Detected ${response.type || "movie"}: ${response.title || "Detected"}`
    )
    setNotice(
      response.playerAvailable === false
        ? t("popup.skippingUnavailableMediaFound")
        : ""
    )
    setTmdbId(String(response.tmdb_id || ""))
    setMediaType(response.type || "movie")

    const detectedTmdbId = Number(response.tmdb_id || 0)
    const detectedMediaKey = `${response.type || "movie"}|${detectedTmdbId}|${Number(response.season || 0)}|${Number(response.episode || 0)}`
    if (trackedPopupMediaKeyRef.current !== detectedMediaKey) {
      trackedPopupMediaKeyRef.current = detectedMediaKey
      track("popup_media_detected", {
        tmdbId: detectedTmdbId,
        mediaType: response.type || "movie",
        season: Number(response.season || 0),
        episode: Number(response.episode || 0),
        playerAvailable: response.playerAvailable === false ? 0 : 1
      })
    }

    if (
      typeof response.currentTime === "number" &&
      startSecRef.current.trim() === ""
    ) {
      setStartSec(formatTime(response.currentTime))
    }

    if (
      typeof response.durationMs === "number" &&
      videoDurationRef.current.trim() === ""
    ) {
      setVideoDuration(formatTime(response.durationMs / 1000))
    }

    setMediaTitle(response.title || "Detected")

    if (response.type === "tv") {
      setSeason(String(response.season ?? ""))
      setEpisode(String(response.episode ?? ""))
      setMediaMeta(
        response.season && response.episode
          ? `${t("media.season")} ${response.season} - ${t("media.episode")} ${response.episode}`
          : t("media.tvSeries")
      )
      return
    }

    setSeason("")
    setEpisode("")
    setMediaMeta(t("media.featureFilm"))
  }, [appendDebugLog, getPlayerInfoFromActiveTab, t, track])

  useEffect(() => {
    startSecRef.current = startSec
  }, [startSec])

  useEffect(() => {
    videoDurationRef.current = videoDuration
  }, [videoDuration])

  useEffect(() => {
    api.storage.local
      .get(["introdb_api_key", "error", ANALYTICS_STORAGE_KEY])
      .then(async (storage) => {
        const { introdb_api_key, error } = storage
        const storedApiKey =
          typeof introdb_api_key === "string" ? introdb_api_key : ""

        setApiKeyInput(storedApiKey)
        setAnonymousUsageReportingEnabled(
          normalizeAnalyticsEnabled(storage[ANALYTICS_STORAGE_KEY])
        )

        if (error && Date.now() - error.time < RECENT_ERROR_WINDOW_MS) {
          if (error.type === "rate_limited") {
            const timeString = formatSeconds(error.reset)
            setErrorMessage(t("errors.rateLimited", { timeString }))
          } else if (error.type === "api_unreachable") {
            setErrorMessage(t("errors.apiUnreachable"))
          }
          await api.storage.local.remove("error")
        }

        if (storedApiKey) {
          setView("main")
          await loadPlayerInfo()
        }
      })
  }, [loadPlayerInfo, t])

  useEffect(() => {
    if (view !== "main") return
    const id = setInterval(() => {
      loadPlayerInfo()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [view, loadPlayerInfo])

  async function handleSaveKey() {
    const key = apiKeyInput.trim()
    if (key) {
      await api.storage.local.set({ introdb_api_key: key })
      track("connect_click", currentMediaProps())
      setView("main")
      await loadPlayerInfo()
    } else {
      await api.storage.local.remove("introdb_api_key")
      setApiKeyInput("")
    }
  }

  const handleAnonymousUsageReportingChange = async (enabled: boolean) => {
    setAnonymousUsageReportingEnabled(enabled)
    await writeAnonymousUsageReportingEnabled(enabled)
    if (enabled) {
      trackAnalyticsEvent("analytics_enabled")
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return

    const { introdb_api_key } = await api.storage.local.get(["introdb_api_key"])
    const endSecValue =
      endSec.trim() === ""
        ? segment === "credits" || segment === "preview"
          ? null
          : 0
        : parseTimeToSeconds(endSec)

    const videoDurationSecValue =
      videoDuration.trim() === "" ? null : parseTimeToSeconds(videoDuration)
    const videoDurationMsValue =
      typeof videoDurationSecValue === "number" &&
      Number.isFinite(videoDurationSecValue) &&
      videoDurationSecValue > 0
        ? Math.round(videoDurationSecValue * 1000)
        : null

    const payload: Record<string, unknown> = {
      tmdb_id: Number(tmdbId),
      type: mediaType,
      segment,
      start_sec: parseTimeToSeconds(startSec),
      end_sec: endSecValue
    }

    if (typeof videoDurationMsValue === "number") {
      payload.video_duration_ms = videoDurationMsValue
    }
    if (mediaType === "tv") {
      payload.season = Number(season)
      payload.episode = Number(episode)
    }
    setStatus(t("status.submitting"))
    try {
      track("submit_click", { ...currentMediaProps(), segment })
      const res = await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${introdb_api_key}`
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        track("submit_success", { ...currentMediaProps(), segment })
        setStatus(t("status.submittedSuccessfully"))
        setStatusColor("text-green-400")
      } else {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData?.error === "string"
            ? errData.error
            : errData?.message ?? "Failed"
        track("submit_error", { ...currentMediaProps(), segment })
        setStatus(msg)
        setStatusColor("text-red-500")
      }
    } catch {
      track("submit_error", { ...currentMediaProps(), segment })
      setStatus(t("status.connectionFailed"))
      setStatusColor("text-red-500")
    }
  }

  async function handleDisconnect() {
    await api.storage.local.remove("introdb_api_key")
    track("disconnect_click", currentMediaProps())
    setApiKeyInput("")
    setStatus("")
    setStatusColor("")
    setNotice("")
    setView("setup")
  }

  const goToStats = () => {
    setView("stats")
  }

  const goToMain = () => {
    setView("main")
    loadPlayerInfo()
  }

  const fetchCurrentPlayerTimeSec = async () => {
    const { response } = await getPlayerInfoFromActiveTab()
    if (!response || response.available === false) return null
    return typeof response.currentTime === "number"
      ? response.currentTime
      : null
  }

  const handleUsePlayerTimeForStart = async () => {
    const current = await fetchCurrentPlayerTimeSec()
    if (typeof current === "number") {
      setStartSec(formatTime(current))
    }
  }

  const handleUsePlayerTimeForEnd = async () => {
    const current = await fetchCurrentPlayerTimeSec()
    if (typeof current === "number") {
      setEndSec(formatTime(current))
    }
  }

  return (
    <>
      <ErrorDisplay message={errorMessage} />

      <div className="box-border w-80 max-w-full m-0 p-0 overflow-hidden bg-gray-950 text-white font-ubuntu">
        <div className="box-border w-full p-5 border-t-2 border-green-400">
          <div className="flex items-center justify-between mb-4">
            <a
              href="https://theintrodb.org"
              target="_blank"
              rel="noopener noreferrer">
              <img src={smallLogo} alt="TIDB" className="h-7 w-auto block" />
            </a>
            {view !== "setup" && (
              <>
                {view === "stats" ? (
                  <button
                    onClick={goToMain}
                    className="liquid-glass-button back-button text-sm py-1.5 px-3">
                    &larr; {t("navigation.back")}
                  </button>
                ) : (
                  <button
                    onClick={goToStats}
                    className="liquid-glass-button text-base font-bold">
                    {t("navigation.stats")}
                  </button>
                )}
              </>
            )}
          </div>

          {view === "setup" && (
            <p className="block text-xs text-gray-400 font-bold mb-3.5">
              {t("setup.description1")}
              <br />
              <br />
              {t("setup.description2")}
            </p>
          )}

          <div className="box-border w-full overflow-hidden bg-gray-900/60 p-[18px] rounded-4xl border border-white/[.08] shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
            {view === "setup" && (
              <SetupPage
                apiKey={apiKeyInput}
                onApiKeyChange={setApiKeyInput}
                anonymousUsageReportingEnabled={anonymousUsageReportingEnabled}
                onAnonymousUsageReportingChange={
                  handleAnonymousUsageReportingChange
                }
                onSaveKey={handleSaveKey}
              />
            )}
            {view === "main" && (
              <MainPage
                notice={notice}
                mediaTitle={mediaTitle}
                mediaMeta={mediaMeta}
                showDebugLogs={showDebugLogs}
                debugLogs={debugLogs}
                canSubmit={canSubmit}
                segment={segment}
                setSegment={setSegment}
                startSec={startSec}
                setStartSec={setStartSec}
                endSec={endSec}
                setEndSec={setEndSec}
                videoDuration={videoDuration}
                setVideoDuration={setVideoDuration}
                onUsePlayerTimeForStart={handleUsePlayerTimeForStart}
                onUsePlayerTimeForEnd={handleUsePlayerTimeForEnd}
                status={status}
                statusColor={statusColor}
                onSubmit={handleSubmit}
                onDisconnect={handleDisconnect}
              />
            )}
            {view === "stats" && (
              <StatsPage
                anonymousUsageReportingEnabled={anonymousUsageReportingEnabled}
                onAnonymousUsageReportingChange={
                  handleAnonymousUsageReportingChange
                }
              />
            )}
          </div>
          <Footer
            onVersionDoubleClick={() =>
              setShowDebugLogs((currentValue) => !currentValue)
            }
          />
        </div>
      </div>
    </>
  )
}

export default IndexPopup
