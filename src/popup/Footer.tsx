import { api } from "./api"

export function Footer() {
  const version = api.runtime.getManifest().version ?? "0.0.0"
  const linkStyle = {
    fontSize: 10,
    color: "#AAA",
    textDecoration: "none" as const,
    display: "inline-block" as const,
    transition: "color 0.2s"
  }
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 12,
        paddingTop: 8
      }}>
      <span style={linkStyle}>v{version}</span>
      <a
        href="https://github.com/TheIntroDB/universal-extension"
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#DDD"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#AAA"
        }}>
        Github
      </a>
    </div>
  )
}
