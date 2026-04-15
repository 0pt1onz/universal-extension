export type SegmentType = "intro" | "recap" | "credits" | "preview"

export interface MainPageProps {
  mediaTitle: string
  mediaMeta: string
  segment: SegmentType
  setSegment: (s: SegmentType) => void
  startSec: string
  setStartSec: (v: string) => void
  endSec: string
  setEndSec: (v: string) => void
  onUsePlayerTimeForStart: () => void
  onUsePlayerTimeForEnd: () => void
  status: string
  statusColor: string
  onSubmit: () => void
  onDisconnect: () => void
}

export function MainPage({
  mediaTitle,
  mediaMeta,
  segment,
  setSegment,
  startSec,
  setStartSec,
  endSec,
  setEndSec,
  onUsePlayerTimeForStart,
  onUsePlayerTimeForEnd,
  status,
  statusColor,
  onSubmit,
  onDisconnect
}: MainPageProps) {
  return (
    <>
      <h3 className="text-green-400 border-b border-gray-700 pb-2.5">Submit</h3>
      <div className="box-border text-xs font-medium mb-1 border-l-[3px] border-green-400 p-1 pl-2.5 bg-gradient-to-r from-green-400/10 to-transparent overflow-hidden text-ellipsis whitespace-nowrap">
        {mediaTitle}
      </div>
      <div className="text-[10px] text-gray-500 mb-3 pl-3.5">{mediaMeta}</div>

      <label className="block text-[9px] font-bold text-green-400 mb-1.5 uppercase tracking-[0.5px]">
        Segment
      </label>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {(["intro", "recap", "credits", "preview"] as const).map((s) => (
          <button
            key={s}
            type="button"
            data-segment={s}
            onClick={() => setSegment(s)}
            className={`border-gradient-pill p-2.5 cursor-pointer text-[11px] ${segment === s ? "text-green-400 hover:text-green-400 border-green-400/30" : "text-gray-500"}`}>
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

      <label className="block text-[9px] font-bold text-green-400 mb-1.5 uppercase tracking-[0.5px]">
        Time (MM:SS)
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
            Insert current time
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
            Insert current time
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        className="border-gradient-pill p-3.5 w-full cursor-pointer font-bold uppercase text-[11px] tracking-[1px] mt-[5px] text-green-400 hover:text-green-400 border-green-400/30">
        Accept
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
        Disconnect Token
      </button>
    </>
  )
}
