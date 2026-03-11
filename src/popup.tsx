import "~style.css"

import { useCallback, useEffect, useState } from "react"
import smallLogo from "url:../assets/small-logo.svg"

import { api, API_URL } from "./popup/api"
import { ErrorDisplay } from "./popup/ErrorDisplay"
import { Footer } from "./popup/Footer"
import { MainPage, type SegmentType } from "./popup/MainPage"
import { SetupPage } from "./popup/SetupPage"
import { StatsPage } from "./popup/StatsPage"
import { formatSeconds, formatTime, parseTimeToSeconds } from "./popup/utils"

function IndexPopup() {
  const [view, setView] = useState<"setup" | "main" | "stats">("setup")
  const [mediaTitle, setMediaTitle] = useState("Detecting...")
  const [mediaMeta, setMediaMeta] = useState("Initializing")
  const [tmdbId, setTmdbId] = useState("")
  const [mediaType, setMediaType] = useState("movie")
  const [season, setSeason] = useState("")
  const [episode, setEpisode] = useState("")
  const [startSec, setStartSec] = useState("")
  const [segment, setSegment] = useState<SegmentType>("intro")
  const [status, setStatus] = useState("")
  const [statusColor, setStatusColor] = useState("")
  const [setupPageKey, setSetupPageKey] = useState("")
  const [errorMessage, setErrorMessage] = useState(null)

  const loadPlayerInfo = useCallback(async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true })
    if (
      !tab ||
      tab.url?.startsWith("chrome://") ||
      tab.url?.startsWith("edge://") ||
      tab.url?.startsWith("about:") ||
      tab.url?.startsWith("moz-extension://")
    ) {
      setMediaTitle("Cannot run on this page")
      return
    }
    api.tabs.sendMessage(tab.id!, { action: "getPlayerInfo" }, (response) => {
      if (api.runtime.lastError) {
        setMediaTitle("Refresh page to sync")
        return
      }
      if (!response) {
        setMediaTitle("No Video Detected")
        return
      }
      setTmdbId(String(response.tmdb_id || ""))
      setMediaType(response.type || "movie")
      setStartSec(
        typeof response.currentTime === "number"
          ? formatTime(response.currentTime)
          : ""
      )
      setMediaTitle(response.title || "Detected")
      if (response.type === "tv") {
        setSeason(String(response.season ?? ""))
        setEpisode(String(response.episode ?? ""))
        setMediaMeta(
          response.season && response.episode
            ? `Season ${response.season} - Episode ${response.episode}`
            : "TV Series"
        )
      } else {
        setMediaMeta("Feature Film")
      }
    })
  }, [])

  useEffect(() => {
    api.storage.local
      .get(["introdb_api_key", "error"])
      .then(({ introdb_api_key, error }) => {
        if (error && Date.now() - error.time < 1000 * 60) {
          // Only show recent errors (1 minute)
          if (error.type === "rate_limited") {
            const timeString = formatSeconds(error.reset)
            setErrorMessage(`Usage limit reached. Try again in ${timeString}.`)
          } else if (error.type === "api_unreachable") {
            setErrorMessage("API is unreachable. Please try again later.")
          }
          api.storage.local.remove("error")
        }

        if (introdb_api_key) {
          setView("main")
          loadPlayerInfo()
        }
      })
  }, [loadPlayerInfo])

  useEffect(() => {
    if (view === "setup") {
      api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
        setSetupPageKey(
          typeof introdb_api_key === "string" ? introdb_api_key : ""
        )
      })
    }
  }, [view])

  async function handleSaveKey() {
    const key = (
      document.getElementById("api-key-input") as HTMLInputElement
    )?.value?.trim()
    if (key) {
      await api.storage.local.set({ introdb_api_key: key })
      setView("main")
      loadPlayerInfo()
    } else {
      await api.storage.local.remove("introdb_api_key")
      setSetupPageKey("")
    }
  }

  async function handleSubmit() {
    const { introdb_api_key } = await api.storage.local.get(["introdb_api_key"])
    const endSecEl = document.getElementById("end_sec") as HTMLInputElement
    const endSecRaw = endSecEl?.value?.trim() ?? ""
    const endSec =
      endSecRaw === ""
        ? segment === "credits" || segment === "preview"
          ? null
          : 0
        : parseTimeToSeconds(endSecRaw)
    const payload: Record<string, unknown> = {
      tmdb_id: Number(tmdbId),
      type: mediaType,
      segment,
      start_sec: parseTimeToSeconds(startSec),
      end_sec: endSec
    }
    if (mediaType === "tv") {
      payload.season = Number(season)
      payload.episode = Number(episode)
    }
    setStatus("Submitting...")
    try {
      const res = await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${introdb_api_key}`
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setStatus("Submitted successfully")
        setStatusColor("text-green-400")
      } else {
        const errData = await res.json().catch(() => ({}))
        const msg =
          typeof errData?.error === "string"
            ? errData.error
            : errData?.message ?? "Failed"
        setStatus(`${msg}`)
        setStatusColor("text-red-500")
      }
    } catch {
      setStatus("Connection failed")
      setStatusColor("text-red-500")
    }
  }

  function handleClearKey() {
    api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
      setSetupPageKey(
        typeof introdb_api_key === "string" ? introdb_api_key : ""
      )
      setView("setup")
    })
  }

  const goToStats = () => {
    setView("stats")
  }

  const goToMain = () => {
    setView("main")
    api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
      if (introdb_api_key && view !== "setup") {
        loadPlayerInfo()
      }
    })
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
                    &larr; Back
                  </button>
                ) : (
                  <button
                    onClick={goToStats}
                    className="liquid-glass-button text-base font-bold">
                    Stats
                  </button>
                )}
              </>
            )}
          </div>

          {view === "setup" && (
            <p className="block text-xs text-gray-400 font-bold mb-3.5">
              You&apos;re getting skip segments from TheIntroDB!
              <br />
              <br />
              Optionally, you can enter your API key to submit new segments and
              skip using your still pending segments!
            </p>
          )}

          <div className="box-border w-full overflow-hidden bg-gray-900/60 p-[18px] rounded-4xl border border-white/[.08] shadow-[0_15px_35px_rgba(0,0,0,0.6)]">
            {view === "setup" && (
              <SetupPage initialKey={setupPageKey} onSaveKey={handleSaveKey} />
            )}
            {view === "main" && (
              <MainPage
                mediaTitle={mediaTitle}
                mediaMeta={mediaMeta}
                segment={segment}
                setSegment={setSegment}
                startSec={startSec}
                setStartSec={setStartSec}
                status={status}
                statusColor={statusColor}
                onSubmit={handleSubmit}
                onDisconnect={handleClearKey}
              />
            )}
            {view === "stats" && <StatsPage />}
          </div>
          <Footer />
        </div>
      </div>
    </>
  )
}

export default IndexPopup
