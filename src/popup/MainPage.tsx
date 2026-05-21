import { useTranslation } from "react-i18next"

import { SEGMENT_TYPES, type SegmentType } from "~/shared/media"

export type { SegmentType }

export interface MainPageProps {
  notice: string
  mediaTitle: string
  mediaMeta: string
  showDebugLogs: boolean
  debugLogs: string[]
  canSubmit: boolean
  segment: SegmentType
  setSegment: (s: SegmentType) => void
  startSec: string
  setStartSec: (v: string) => void
  endSec: string
  setEndSec: (v: string) => void
  videoDuration: string
  setVideoDuration: (v: string) => void
  onUsePlayerTimeForStart: () => void
  onUsePlayerTimeForEnd: () => void
  status: string
  statusColor: string
  onSubmit: () => void
  onDisconnect: () => void
}

export function MainPage({
  notice,
  mediaTitle,
  mediaMeta,
  showDebugLogs,
  debugLogs,
  canSubmit,
  segment,
  setSegment,
  startSec,
  setStartSec,
  endSec,
  setEndSec,
  videoDuration,
  setVideoDuration,
  onUsePlayerTimeForStart,
  onUsePlayerTimeForEnd,
  status,
  statusColor,
  onSubmit,
  onDisconnect
}: MainPageProps) {
  const { t } = useTranslation()

  return (
    <>
      <h3 className="text-green-400 border-b border-gray-700 pb-2.5">
        {t("popup.title")}
      </h3>
      {notice && (
        <div className="mt-3 mb-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-200">
          {notice}
        </div>
      )}
      <div className="box-border text-xs font-medium mb-1 border-l-[3px] border-green-400 p-1 pl-2.5 bg-gradient-to-r from-green-400/10 to-transparent overflow-hidden text-ellipsis whitespace-nowrap">
        {mediaTitle}
      </div>
      <div className="text-[10px] text-gray-500 mb-3 pl-3.5">{mediaMeta}</div>
      {showDebugLogs && debugLogs.length > 0 && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.5px] text-gray-400">
            Debug Log
          </div>
          <div className="space-y-1 font-mono text-[10px] text-gray-300">
            {debugLogs.map((log, index) => (
              <div key={`${index}-${log}`}>{log}</div>
            ))}
          </div>
        </div>
      )}

      <label className="block text-[9px] font-bold text-green-400 mb-1.5 uppercase tracking-[0.5px]">
        {t("popup.segment")}
      </label>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {SEGMENT_TYPES.map((s) => (
          <button
            key={s}
            type="button"
            data-segment={s}
            onClick={() => setSegment(s)}
            className={`border-gradient-pill p-2.5 cursor-pointer text-[11px] ${segment === s ? "text-green-400 hover:text-green-400 border-green-400/30" : "text-gray-500"}`}>
            {t(`segments.${s}`)}
          </button>
        ))}
      </div>

      <label className="block text-[9px] font-bold text-green-400 mb-1.5 uppercase tracking-[0.5px]">
        {t("popup.time")}
      </label>
      <div className="flex gap-2.5 mb-3 min-w-0">
        <div className="flex-1 min-w-0">
          <input
            id="start_sec"
            placeholder="00:30"
            value={startSec}
            onChange={(e) => setStartSec(e.target.value)}
            className="w-full min-w-0 p-[11px] bg-[#151515] border border-white/[.08] rounded-4xl box-border text-white text-[13px]"
          />
          <button
            type="button"
            onClick={onUsePlayerTimeForStart}
            className="mt-1 pl-1 text-[9px] text-gray-500 hover:text-green-400">
            {t("popup.insertCurrentTime")}
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <input
            id="end_sec"
            placeholder="01:30"
            value={endSec}
            onChange={(e) => setEndSec(e.target.value)}
            className="w-full min-w-0 p-[11px] bg-[#151515] border border-white/[.08] rounded-4xl box-border text-white text-[13px]"
          />
          <button
            type="button"
            onClick={onUsePlayerTimeForEnd}
            className="mt-1 pl-1 text-[9px] text-gray-500 hover:text-green-400">
            {t("popup.insertCurrentTime")}
          </button>
        </div>
      </div>

      <label className="block text-[9px] font-bold text-green-400 mb-1.5 uppercase tracking-[0.5px]">
        {t("popup.videoDuration")}
      </label>
      <div className="mb-3">
        <input
          id="video_duration"
          placeholder="2:00:00"
          value={videoDuration}
          onChange={(e) => setVideoDuration(e.target.value)}
          className="w-full min-w-0 p-[11px] bg-[#151515] border border-white/[.08] rounded-4xl box-border text-white text-[13px]"
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`border-gradient-pill p-3.5 w-full font-bold uppercase text-[11px] tracking-[1px] mt-[5px] border-green-400/30 ${
          canSubmit
            ? "cursor-pointer text-green-400 hover:text-green-400"
            : "cursor-not-allowed text-gray-600 opacity-60"
        }`}>
        {t("popup.submit")}
      </button>
      <div
        id="status"
        className={`text-[10px] text-center mt-2.5 min-h-[1.2em] ${statusColor}`}>
        {status}
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        className="border-gradient-pill p-2.5 w-full cursor-pointer text-[9px] text-red-500">
        {t("popup.disconnectToken")}
      </button>
    </>
  )
}
