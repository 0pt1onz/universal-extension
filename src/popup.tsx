import { useCallback, useEffect, useState } from "react"

const API_URL =
  process.env.PLASMO_PUBLIC_INTRODB_API || "https://api.theintrodb.org/v1"
const api = typeof browser !== "undefined" ? browser : chrome

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function parseTimeToSeconds(timeStr: string) {
  if (!timeStr || !timeStr.includes(":")) return parseFloat(timeStr) || 0
  return timeStr.split(":").reduce((a, v) => a * 60 + parseFloat(v), 0)
}

function IndexPopup() {
  const [view, setView] = useState<"setup" | "main">("setup")
  const [mediaTitle, setMediaTitle] = useState("Detecting...")
  const [mediaMeta, setMediaMeta] = useState("Initializing")
  const [tmdbId, setTmdbId] = useState("")
  const [mediaType, setMediaType] = useState("movie")
  const [season, setSeason] = useState("")
  const [episode, setEpisode] = useState("")
  const [startSec, setStartSec] = useState("")
  const [segment, setSegment] = useState<"intro" | "recap" | "credits" | "preview">("intro")
  const [status, setStatus] = useState("")
  const [statusColor, setStatusColor] = useState("")

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
    api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
      if (introdb_api_key) {
        setView("main")
        loadPlayerInfo()
      }
    })
  }, [loadPlayerInfo])

  async function handleSaveKey() {
    const key = (
      document.getElementById("api-key-input") as HTMLInputElement
    )?.value?.trim()
    if (key) {
      await api.storage.local.set({ introdb_api_key: key })
      setView("main")
      loadPlayerInfo()
    }
  }

  async function handleSubmit() {
    const { introdb_api_key } = await api.storage.local.get(["introdb_api_key"])
    const endSecEl = document.getElementById("end_sec") as HTMLInputElement
    const endSecRaw = endSecEl?.value?.trim() ?? ""
    const endSec =
      endSecRaw === ""
        ? (segment === "credits" || segment === "preview" ? null : 0)
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
        setStatus("✅ Submitted successfully")
        setStatusColor("#00ff88")
      } else {
        const errData = await res.json()
        setStatus(`❌ Error: ${errData.message || "Failed"}`)
        setStatusColor("#ff4444")
      }
    } catch {
      setStatus("❌ Connection failed")
      setStatusColor("#ff4444")
    }
  }

  function handleClearKey() {
    api.storage.local.remove("introdb_api_key", () => setView("setup"))
  }

  return (
    <div
      style={{
        width: 320,
        fontFamily: "'Ubuntu', sans-serif",
        margin: 0,
        background: "#0a0a0a",
        color: "#fff",
        overflow: "hidden"
      }}>
      <div
        style={{
          padding: "20px 20px 10px 20px",
          backdropFilter: "blur(12px)",
          borderTop: "2px solid #00ff88"
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 15
          }}>
          <div
            style={{
              width: 24,
              height: 24,
              background: "#00ff88",
              mask: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'/%3E%3C/svg%3E\") no-repeat center",
              WebkitMask:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'/%3E%3C/svg%3E\") no-repeat center"
            }}
          />
          <h2
            style={{
              fontSize: 13,
              letterSpacing: "1.5px",
              margin: 0,
              fontWeight: 700
            }}>
            TheIntroDB
          </h2>
        </div>

        <div
          style={{
            background: "rgba(25, 25, 25, 0.8)",
            padding: 18,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 15px 35px rgba(0,0,0,0.6)"
          }}>
          {view === "setup" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#00ff88",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                Authentication
              </label>
              <input
                id="api-key-input"
                type="password"
                placeholder="Enter TIDB Api Key"
                style={{
                  width: "100%",
                  padding: 11,
                  background: "#151515",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  boxSizing: "border-box",
                  color: "white",
                  fontSize: 13,
                  marginBottom: 12,
                  fontFamily: "Ubuntu, sans-serif"
                }}
              />
              <button
                type="button"
                onClick={handleSaveKey}
                style={{
                  background: "#00ff88",
                  color: "#000",
                  border: "none",
                  padding: 14,
                  width: "100%",
                  cursor: "pointer",
                  borderRadius: 6,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: "1px",
                  fontFamily: "Ubuntu, sans-serif"
                }}>
                Authorize
              </button>
            </div>
          )}

          {view === "main" && (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 4,
                  borderLeft: "3px solid #00ff88",
                  padding: "4px 10px",
                  background:
                    "linear-gradient(90deg, rgba(0,255,136,0.1), transparent)"
                }}>
                {mediaTitle}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#777",
                  marginBottom: 12,
                  paddingLeft: 13
                }}>
                {mediaMeta}
              </div>

              <label
                style={{
                  display: "block",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#00ff88",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                Segment
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {(["intro", "recap", "credits", "preview"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-segment={s}
                    onClick={() => setSegment(s)}
                    style={{
                      flex: "1 1 0",
                      minWidth: 70,
                      padding: 10,
                      background:
                        segment === s ? "rgba(0,255,136,0.12)" : "#151515",
                      border: `1px solid ${segment === s ? "#00ff88" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 8,
                      color: segment === s ? "#00ff88" : "#777",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "Ubuntu, sans-serif"
                    }}>
                    {s === "intro"
                      ? "Intro"
                      : s === "recap"
                        ? "Recap"
                        : s === "credits"
                          ? "Credits"
                          : "Preview"}
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: "block",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#00ff88",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                Time (MM:SS)
              </label>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  className="input"
                  id="start_sec"
                  placeholder="00:30"
                  value={startSec}
                  onChange={(e) => setStartSec(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 11,
                    background: "#151515",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    boxSizing: "border-box",
                    color: "white",
                    fontSize: 13,
                    fontFamily: "Ubuntu, sans-serif"
                  }}
                />
                <input
                  className="input"
                  id="end_sec"
                  placeholder="01:30"
                  style={{
                    width: "100%",
                    padding: 11,
                    background: "#151515",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    boxSizing: "border-box",
                    color: "white",
                    fontSize: 13,
                    fontFamily: "Ubuntu, sans-serif"
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                style={{
                  background: "#00ff88",
                  color: "#000",
                  border: "none",
                  padding: 14,
                  width: "100%",
                  cursor: "pointer",
                  borderRadius: 6,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: "1px",
                  marginTop: 5,
                  fontFamily: "Ubuntu, sans-serif"
                }}>
                Accept
              </button>
              <div
                id="status"
                style={{
                  fontSize: 10,
                  textAlign: "center",
                  marginTop: 10,
                  minHeight: "1.2em",
                  color: statusColor
                }}>
                {status}
              </div>
              <button
                type="button"
                onClick={handleClearKey}
                style={{
                  background: "transparent",
                  color: "#777",
                  border: "none",
                  fontSize: 9,
                  marginTop: 10,
                  width: "100%",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "Ubuntu, sans-serif"
                }}>
                Disconnect Token
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
