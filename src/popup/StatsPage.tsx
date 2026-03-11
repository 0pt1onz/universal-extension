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
          baseStats.segments_skipped = {
            ...DEFAULT_STATS.segments_skipped,
            ...local.segments_skipped
          }
          baseStats.time_saved_by_type_ms = {
            ...DEFAULT_STATS.time_saved_by_type_ms,
            ...local.time_saved_by_type_ms
          }
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
                setApiKeyError("Could not load account stats. Try again later.")
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
                  acceptance_rate: Number(userData.acceptance_rate) || 0,
                  current_streak: Number(userData.current_streak) || 0,
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
    return (
      <div className="text-gray-400 text-center rounded-4xl">Loading...</div>
    )

  return (
    <div className="text-gray-200 font-sans">
      <h3 className="text-green-400 border-b border-gray-700">
        Your Statistics
      </h3>

      <div className="my-2.5">
        <strong>Personal Time Saved:</strong>
        <span className="text-green-400 ml-2.5">
          {formatDuration(stats.total_time_saved_ms)}
        </span>
      </div>

      <div className="my-2.5">
        <h4 className="m-0 mb-2.5 text-sm text-gray-400">Segments Skipped</h4>
        {Object.entries(stats.segments_skipped).map(([key, val]) => (
          <div key={key} className="flex justify-between mb-1">
            <span className="capitalize">{key}:</span>
            <span className="text-green-400">{val}</span>
          </div>
        ))}
      </div>

      {stats.userSubmissions && (
        <div className="mt-2.5">
          <h4 className="m-0 mb-2.5 text-sm text-gray-400">Your Submissions</h4>
          <div className="flex justify-between mb-1">
            <span>Total:</span>
            <span className="text-green-400">
              {stats.userSubmissions.total.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Accepted:</span>
            <span className="text-green-400">
              {stats.userSubmissions.accepted.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Pending:</span>
            <span className="text-green-400">
              {stats.userSubmissions.pending.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Acceptance rate:</span>
            <span className="text-green-400">
              {stats.userSubmissions.acceptance_rate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Current streak:</span>
            <span className="text-green-400">
              {stats.userSubmissions.current_streak}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Best streak:</span>
            <span className="text-green-400">
              {stats.userSubmissions.best_streak}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3.5 text-[13px] text-gray-400">
        Community Submissions:{" "}
        <span className="text-green-400">
          {stats.total_submissions.toLocaleString()}
        </span>
      </div>

      {apiKeyError && (
        <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/40 rounded-xl text-xs text-red-300">
          {apiKeyError}
        </div>
      )}
    </div>
  )
}

export { StatsPage }
