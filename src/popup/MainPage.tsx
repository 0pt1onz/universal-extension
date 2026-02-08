export type SegmentType = "intro" | "recap" | "credits" | "preview"

export interface MainPageProps {
  mediaTitle: string
  mediaMeta: string
  segment: SegmentType
  setSegment: (s: SegmentType) => void
  startSec: string
  setStartSec: (v: string) => void
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
  status,
  statusColor,
  onSubmit,
  onDisconnect
}: MainPageProps) {
  return (
    <>
      <div
        style={{
          boxSizing: "border-box",
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 4,
          borderLeft: "3px solid #00ff88",
          padding: "4px 10px",
          background:
            "linear-gradient(90deg, rgba(0,255,136,0.1), transparent)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 12
        }}>
        {(["intro", "recap", "credits", "preview"] as const).map((s) => (
          <button
            key={s}
            type="button"
            data-segment={s}
            onClick={() => setSegment(s)}
            style={{
              padding: 10,
              background: segment === s ? "rgba(0,255,136,0.12)" : "#151515",
              border: `1px solid ${segment === s ? "#00ff88" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              color: segment === s ? "#00ff88" : "#777",
              cursor: "pointer",
              fontSize: 11
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
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          minWidth: 0
        }}>
        <input
          id="start_sec"
          placeholder="00:30"
          value={startSec}
          onChange={(e) => setStartSec(e.target.value)}
          style={{
            flex: "1 1 0",
            minWidth: 0,
            padding: 11,
            background: "#151515",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            boxSizing: "border-box",
            color: "white",
            fontSize: 13
          }}
        />
        <input
          id="end_sec"
          placeholder="01:30"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            padding: 11,
            background: "#151515",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            boxSizing: "border-box",
            color: "white",
            fontSize: 13
          }}
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
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
          marginTop: 5
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
        onClick={onDisconnect}
        style={{
          background: "transparent",
          color: "#777",
          border: "none",
          fontSize: 9,
          marginTop: 10,
          width: "100%",
          cursor: "pointer",
          textDecoration: "underline"
        }}>
        Disconnect Token
      </button>
    </>
  )
}
