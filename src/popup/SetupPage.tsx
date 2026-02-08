export function SetupPage({ onSaveKey }: { onSaveKey: () => void }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          color: "#00ff88",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
        API Key
      </label>
      <input
        id="api-key-input"
        type="password"
        placeholder="Enter your API key"
        style={{
          width: "100%",
          minWidth: 0,
          padding: 11,
          background: "#151515",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          boxSizing: "border-box",
          color: "white",
          fontSize: 13,
          marginBottom: 12
        }}
      />
      <button
        type="button"
        onClick={onSaveKey}
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
          letterSpacing: "1px"
        }}>
        Authorize
      </button>
    </div>
  )
}
