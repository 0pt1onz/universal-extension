import React, { useEffect, useState } from "react"

import { api } from "./api"

interface StatsState {
  total_time_saved_ms: number
  segments_skipped: { intro: number; recap: number; credits: number }
  time_saved_by_type_ms: { intro: number; recap: number; credits: number }
  total_submissions: number
  userSubmissions?: {
    total: number
    accepted: number
    pending: number
    rejected: number
    acceptance_rate: number
    current_streak: number
    best_streak: number
  }
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
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

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

        const storage = await api.storage.local.get([
          "skipButtonStats",
          "introdb_api_key"
        ])
        const local = storage.skipButtonStats
        const introdb_api_key = storage.introdb_api_key as string | undefined

        const baseStats: StatsState = {
          ...DEFAULT_STATS,
          total_submissions: communityTotal
        }

        if (local) {
          const totalSaved =
            (local.time_saved_by_type_ms?.intro || 0) +
            (local.time_saved_by_type_ms?.recap || 0) +
            (local.time_saved_by_type_ms?.credits || 0)
          baseStats.total_time_saved_ms = totalSaved
          baseStats.segments_skipped = { ...DEFAULT_STATS.segments_skipped, ...local.segments_skipped }
          baseStats.time_saved_by_type_ms = { ...DEFAULT_STATS.time_saved_by_type_ms, ...local.time_saved_by_type_ms }
        }

        setApiKeyError(null)
        if (introdb_api_key?.trim()) {
          try {
            const userRes = await fetch(
              "https://api.theintrodb.org/v2/user/stats",
              {
                headers: {
                  Authorization: `Bearer ${introdb_api_key.trim()}`
                }
              }
            )
            const userData = await userRes.json().catch(() => ({}))
            if (!userRes.ok) {
              if (userRes.status === 401) {
                setApiKeyError(
                  "API key not accepted. Check or regenerate key at theintrodb.org"
                )
              } else {
                setApiKeyError(
                  "Could not load account stats. Try again later."
                )
              }
            } else {
              const tsMs = userData.total_time_saved_ms
              if (typeof tsMs === "number" && tsMs >= 0) {
                baseStats.total_time_saved_ms = tsMs
              }
              if (
                typeof userData.total === "number" ||
                typeof userData.accepted === "number"
              ) {
                baseStats.userSubmissions = {
                  total: Number(userData.total) || 0,
                  accepted: Number(userData.accepted) || 0,
                  pending: Number(userData.pending) || 0,
                  rejected: Number(userData.rejected) || 0,
                  acceptance_rate:
                    Number(userData.acceptance_rate) || 0,
                  current_streak:
                    Number(userData.current_streak) || 0,
                  best_streak: Number(userData.best_streak) || 0
                }
              }
            }
          } catch (e) {
            console.error("User stats fetch failed", e)
          }
        }

        setStats(baseStats)
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

      {stats.userSubmissions && (
        <div
          style={{
            background: "#1e1e1e",
            padding: "10px",
            borderRadius: "8px",
            marginTop: "10px"
          }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#888" }}>
            Your Submissions
          </h4>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span>Total:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.total.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span>Accepted:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.accepted.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span>Pending:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.pending.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span>Acceptance rate:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.acceptance_rate.toFixed(1)}%
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px"
            }}>
            <span>Current streak:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.current_streak}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
            <span>Best streak:</span>
            <span style={{ color: "#00ff88" }}>
              {stats.userSubmissions.best_streak}
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: "15px", fontSize: "13px", color: "#888" }}>
        Community Submissions:{" "}
        <span style={{ color: "#00ff88" }}>
          {stats.total_submissions.toLocaleString()}
        </span>
      </div>

      {apiKeyError && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 10px",
            background: "rgba(255, 68, 68, 0.15)",
            border: "1px solid rgba(255, 68, 68, 0.4)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#ff8888"
          }}>
          {apiKeyError}
        </div>
      )}
    </div>
  )
}

export { StatsPage }
