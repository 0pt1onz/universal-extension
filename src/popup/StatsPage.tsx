import React, { useEffect, useState } from "react"

interface StatsState {
  total_time_saved_ms: number
  segments_skipped: { intro: number; recap: number; credits: number }
  time_saved_by_type_ms: { intro: number; recap: number; credits: number }
  total_submissions: number
}

const DEFAULT_STATS: StatsState = {
  total_time_saved_ms: 0,
  segments_skipped: { intro: 0, recap: 0, credits: 0 },
  time_saved_by_type_ms: { intro: 0, recap: 0, credits: 0 },
  total_submissions: 0
}

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<StatsState>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        let communityTotal = 0
        try {
          const res = await fetch("https://api.theintrodb.org/v2/stats")
          if (res.ok) {
            const data = await res.json()
            communityTotal = data.total_submissions || 0
          }
        } catch (e) {
          console.error("API Offline", e)
        }

        const storage = await chrome.storage.local.get(["skipButtonStats"])
        const local = storage.skipButtonStats

        if (local) {
          const totalSaved =
            (local.time_saved_by_type_ms.intro || 0) +
            (local.time_saved_by_type_ms.recap || 0) +
            (local.time_saved_by_type_ms.credits || 0)

          setStats({
            total_time_saved_ms: totalSaved,
            segments_skipped: local.segments_skipped,
            time_saved_by_type_ms: local.time_saved_by_type_ms,
            total_submissions: communityTotal
          })
        } else {
          setStats((prev) => ({ ...prev, total_submissions: communityTotal }))
        }
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const m = Math.floor((seconds % 3600) / 60)
    const h = Math.floor(seconds / 3600)
    const s = seconds % 60
    return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`
  }

  if (loading)
    return <div style={{ color: "#aaa", textAlign: "center" }}>Loading...</div>

  return (
    <div
      style={{ color: "#e0e0e0", fontFamily: "sans-serif", padding: "10px" }}>
      <h3 style={{ color: "#00ff88", borderBottom: "1px solid #333" }}>
        Your Statistics
      </h3>

      <div
        style={{
          background: "#1e1e1e",
          padding: "10px",
          borderRadius: "8px",
          margin: "10px 0"
        }}>
        <strong>Personal Time Saved:</strong>
        <span style={{ color: "#00ff88", marginLeft: "10px" }}>
          {formatDuration(stats.total_time_saved_ms)}
        </span>
      </div>

      <div
        style={{ background: "#1e1e1e", padding: "10px", borderRadius: "8px" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#888" }}>
          Segments Skipped
        </h4>
        {Object.entries(stats.segments_skipped).map(([key, val]) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span style={{ textTransform: "capitalize" }}>{key}:</span>
            <span style={{ color: "#00ff88" }}>{val}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "15px", fontSize: "13px", color: "#888" }}>
        Community Submissions:{" "}
        <span style={{ color: "#00ff88" }}>
          {stats.total_submissions.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export { StatsPage }
