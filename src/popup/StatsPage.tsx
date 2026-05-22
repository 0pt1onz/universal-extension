import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  TRACKED_SEGMENT_TYPES,
  type TrackableSegmentType
} from "~/shared/media"

import { api, API_URL } from "./api"

type SegmentTotals = Record<TrackableSegmentType, number>

interface StatsPageProps {
  anonymousUsageReportingEnabled: boolean
  onAnonymousUsageReportingChange: (enabled: boolean) => void | Promise<void>
}

interface UserSubmissionsState {
  total: number
  accepted: number
  pending: number
  rejected: number
  acceptance_rate: number
  current_streak: number
  best_streak: number
}

interface LocalSkipStats {
  segments_skipped?: Partial<SegmentTotals>
  time_saved_by_type_ms?: Partial<SegmentTotals>
}

interface StatsState {
  local_time_saved_ms: number
  account_time_saved_ms: number
  segments_skipped: SegmentTotals
  time_saved_by_type_ms: SegmentTotals
  total_submissions: number
  userSubmissions?: UserSubmissionsState
}

const createEmptySegmentTotals = (): SegmentTotals => ({
  intro: 0,
  recap: 0,
  credits: 0
})

const mergeSegmentTotals = (
  values?: Partial<SegmentTotals>
): SegmentTotals => ({
  ...createEmptySegmentTotals(),
  ...values
})

const getTotalSavedTime = (values: Partial<SegmentTotals> | undefined) =>
  TRACKED_SEGMENT_TYPES.reduce(
    (total, type) => total + Number(values?.[type] || 0),
    0
  )

const normalizeUserSubmissions = (
  data: Record<string, unknown>
): UserSubmissionsState | undefined => {
  if (typeof data.total !== "number" && typeof data.accepted !== "number") {
    return undefined
  }

  return {
    total: Number(data.total) || 0,
    accepted: Number(data.accepted) || 0,
    pending: Number(data.pending) || 0,
    rejected: Number(data.rejected) || 0,
    acceptance_rate: Number(data.acceptance_rate) || 0,
    current_streak: Number(data.current_streak) || 0,
    best_streak: Number(data.best_streak) || 0
  }
}

const DEFAULT_STATS: StatsState = {
  local_time_saved_ms: 0,
  account_time_saved_ms: 0,
  segments_skipped: createEmptySegmentTotals(),
  time_saved_by_type_ms: createEmptySegmentTotals(),
  total_submissions: 0
}

const StatsPage: React.FC<StatsPageProps> = ({
  anonymousUsageReportingEnabled,
  onAnonymousUsageReportingChange
}) => {
  const { t } = useTranslation()
  const [stats, setStats] = useState<StatsState>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        let communityTotal = 0
        try {
          const res = await fetch(`${API_URL}/stats`)
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
        const local = storage.skipButtonStats as LocalSkipStats | undefined
        const introdb_api_key = storage.introdb_api_key as string | undefined

        const baseStats: StatsState = {
          ...DEFAULT_STATS,
          total_submissions: communityTotal
        }

        if (local) {
          baseStats.local_time_saved_ms = getTotalSavedTime(
            local.time_saved_by_type_ms
          )
          baseStats.segments_skipped = mergeSegmentTotals(
            local.segments_skipped
          )
          baseStats.time_saved_by_type_ms = mergeSegmentTotals(
            local.time_saved_by_type_ms
          )
        }

        setApiKeyError(null)
        if (introdb_api_key?.trim()) {
          try {
            const userRes = await fetch(`${API_URL}/user/stats`, {
              headers: {
                Authorization: `Bearer ${introdb_api_key.trim()}`
              }
            })
            const userData = (await userRes.json().catch(() => ({}))) as Record<
              string,
              unknown
            >
            if (!userRes.ok) {
              if (userRes.status === 401) {
                setApiKeyError(t("errors.apiKeyNotAccepted"))
              } else {
                setApiKeyError(t("errors.couldNotLoadAccountStats"))
              }
            } else {
              const tsMs = userData.total_time_saved_ms
              if (typeof tsMs === "number" && tsMs >= 0) {
                baseStats.account_time_saved_ms = tsMs
              }

              baseStats.userSubmissions = normalizeUserSubmissions(userData)
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
  }, [t])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const m = Math.floor((seconds % 3600) / 60)
    const h = Math.floor(seconds / 3600)
    const s = seconds % 60
    return `${h > 0 ? h + t("time.hours") + " " : ""}${m > 0 ? m + t("time.minutes") + " " : ""}${s}${t("time.seconds")}`
  }

  const totalSegmentsSkipped = Object.values(stats.segments_skipped).reduce(
    (total, value) => total + value,
    0
  )

  if (loading)
    return (
      <div className="text-gray-400 text-center rounded-4xl">
        {t("popup.loading")}
      </div>
    )

  return (
    <div className="text-gray-200 font-sans">
      <h3 className="text-green-400 border-b border-gray-700">
        {t("popup.yourStatistics")}
      </h3>

      <div className="my-2.5">
        <h4 className="m-0 mb-2.5 text-sm text-gray-400">
          {t("popup.segmentsSkipped")}
        </h4>
        <div className="flex justify-between mb-1">
          <span>{t("popup.total")}:</span>
          <span className="text-green-400">{totalSegmentsSkipped}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>{t("popup.personalTimeSaved")}:</span>
          <span className="text-green-400">
            {formatDuration(stats.local_time_saved_ms)}
          </span>
        </div>
        {Object.entries(stats.segments_skipped).map(([key, val]) => (
          <div key={key} className="flex justify-between mb-1">
            <span className="capitalize">{t(`segments.${key}`)}:</span>
            <span className="text-green-400">{val}</span>
          </div>
        ))}
      </div>

      {stats.userSubmissions && (
        <div className="mt-2.5">
          <h4 className="m-0 mb-2.5 text-sm text-gray-400">
            {t("popup.yourSubmissions")}
          </h4>
          <div className="flex justify-between mb-1">
            <span>{t("popup.total")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.total.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>{t("popup.totalTimeSaved")}:</span>
            <span className="text-green-400">
              {formatDuration(stats.account_time_saved_ms)}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>{t("popup.accepted")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.accepted.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>{t("popup.pending")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.pending.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>{t("popup.acceptanceRate")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.acceptance_rate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>{t("popup.currentStreak")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.current_streak}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t("popup.bestStreak")}:</span>
            <span className="text-green-400">
              {stats.userSubmissions.best_streak}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3.5 text-[13px] text-gray-400">
        {t("popup.communitySubmissions")}:{" "}
        <span className="text-green-400">
          {stats.total_submissions.toLocaleString()}
        </span>
      </div>

      {apiKeyError && (
        <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/40 rounded-xl text-xs text-red-300">
          {apiKeyError}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-800">
        <label className="flex gap-2.5 items-start text-xs text-gray-300">
          <input
            type="checkbox"
            checked={anonymousUsageReportingEnabled}
            onChange={(event) =>
              onAnonymousUsageReportingChange(event.target.checked)
            }
            className="mt-0.5"
          />
          <span className="leading-snug">
            <span className="font-bold text-gray-200">
              {t("popup.anonymousUsageReporting")}
            </span>
            <span className="block text-[11px] text-gray-400 mt-1">
              {t("popup.anonymousUsageReportingDescription")}
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}

export { StatsPage }
