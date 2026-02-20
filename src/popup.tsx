import { useCallback, useEffect, useState } from "react";
import smallLogo from "url:../assets/small-logo.svg";

import { api, API_URL } from "./popup/api";
import { Footer } from "./popup/Footer";
import { MainPage, type SegmentType } from "./popup/MainPage";
import { SetupPage } from "./popup/SetupPage";
import { formatTime, parseTimeToSeconds } from "./popup/utils";

import { StatsPage } from "./popup/StatsPage"; 

function IndexPopup() {
  const [view, setView] = useState<"setup" | "main" | "stats">("setup");
  const [mediaTitle, setMediaTitle] = useState("Detecting...");
  const [mediaMeta, setMediaMeta] = useState("Initializing");
  const [tmdbId, setTmdbId] = useState("");
  const [mediaType, setMediaType] = useState("movie");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [startSec, setStartSec] = useState("");
  const [segment, setSegment] = useState<SegmentType>("intro");
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("");

  const loadPlayerInfo = useCallback(async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (
      !tab ||
      tab.url?.startsWith("chrome://") ||
      tab.url?.startsWith("edge://") ||
      tab.url?.startsWith("about:") ||
      tab.url?.startsWith("moz-extension://")
    ) {
      setMediaTitle("Cannot run on this page");
      return;
    }
    api.tabs.sendMessage(tab.id!, { action: "getPlayerInfo" }, (response) => {
      if (api.runtime.lastError) {
        setMediaTitle("Refresh page to sync");
        return;
      }
      if (!response) {
        setMediaTitle("No Video Detected");
        return;
      }
      setTmdbId(String(response.tmdb_id || ""));
      setMediaType(response.type || "movie");
      setStartSec(
        typeof response.currentTime === "number"
          ? formatTime(response.currentTime)
          : ""
      );
      setMediaTitle(response.title || "Detected");
      if (response.type === "tv") {
        setSeason(String(response.season ?? ""));
        setEpisode(String(response.episode ?? ""));
        setMediaMeta(
          response.season && response.episode
            ? `Season ${response.season} - Episode ${response.episode}`
            : "TV Series"
        );
      } else {
        setMediaMeta("Feature Film");
      }
    });
  }, []);

  useEffect(() => {
    api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
      if (introdb_api_key) {
        setView("main");
        loadPlayerInfo();
      }
    });
  }, [loadPlayerInfo]);

  async function handleSaveKey() {
    const key = (
      document.getElementById("api-key-input") as HTMLInputElement
    )?.value?.trim();
    if (key) {
      await api.storage.local.set({ introdb_api_key: key });
      setView("main");
      loadPlayerInfo();
    }
  }

  async function handleSubmit() {
    const { introdb_api_key } = await api.storage.local.get(["introdb_api_key"]);
    const endSecEl = document.getElementById("end_sec") as HTMLInputElement;
    const endSecRaw = endSecEl?.value?.trim() ?? "";
    const endSec =
      endSecRaw === ""
        ? segment === "credits" || segment === "preview"
          ? null
          : 0
        : parseTimeToSeconds(endSecRaw);
    const payload: Record<string, unknown> = {
      tmdb_id: Number(tmdbId),
      type: mediaType,
      segment,
      start_sec: parseTimeToSeconds(startSec),
      end_sec: endSec,
    };
    if (mediaType === "tv") {
      payload.season = Number(season);
      payload.episode = Number(episode);
    }
    setStatus("Submitting...");
    try {
      const res = await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${introdb_api_key}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("Submitted successfully");
        setStatusColor("#00ff88");
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg =
          typeof errData?.error === "string"
            ? errData.error
            : errData?.message ?? "Failed";
        setStatus(`${msg}`);
        setStatusColor("#ff4444");
      }
    } catch {
      setStatus("Connection failed");
      setStatusColor("#ff4444");
    }
  }

  function handleClearKey() {
    api.storage.local.remove("introdb_api_key", () => setView("setup"));
  }

  const goToStats = () => {
    setView("stats");
  };

  const goToMain = () => {
    setView("main");
    api.storage.local.get(["introdb_api_key"]).then(({ introdb_api_key }) => {
      if (introdb_api_key && view !== "setup") {
        loadPlayerInfo(); 
      }
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap');
        html, body {
          margin: 0;
          padding: 0;
          background: #0a0a0a;
          color: #fff;
          box-sizing: border-box;
          font-family: 'Ubuntu', sans-serif;
        }
        *, *::before, *::after { box-sizing: inherit; }
        
        .liquid-glass-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #00ff88; /* Neon green text */
          background: rgba(25, 25, 25, 0.8);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          box-shadow: 
             0 0 15px rgba(0, 255, 136, 0.2),
             inset 0 0 15px rgba(0, 255, 136, 0.1);
          text-decoration: none;
        }
        
        .liquid-glass-button:hover {
          background: rgba(30, 30, 30, 0.9);
          box-shadow: 
             0 0 20px rgba(0, 255, 136, 0.4),
             inset 0 0 20px rgba(0, 255, 136, 0.2);
          transform: translateY(-2px);
        }
        
        .liquid-glass-button:active {
          transform: translateY(1px);
          box-shadow: 
             0 0 10px rgba(0, 255, 136, 0.3),
             inset 0 0 10px rgba(0, 255, 136, 0.15);
        }
        
        .back-button {
          background: rgba(100, 100, 100, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          margin-bottom: 15px;
        }
        
        .back-button:hover {
           background: rgba(120, 120, 120, 0.4);
           box-shadow: 
             0 0 15px rgba(255, 255, 255, 0.2),
             inset 0 0 15px rgba(255, 255, 255, 0.1);
        }
      `}</style>
      <div
        style={{
          boxSizing: "border-box",
          width: 320,
          maxWidth: "100%",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}>
        <div
          style={{
            boxSizing: "border-box",
            width: "100%",
            padding: "20px",
            borderTop: "2px solid #00ff88",
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 15,
            }}>
            <a
              href="https://theintrodb.org"
              target="_blank"
              rel="noopener noreferrer">
              <img
                src={smallLogo}
                alt="TIDB"
                style={{ height: 28, width: "auto", display: "block" }}
              />
            </a>
            {view === "stats" ? (
              <button
                onClick={goToMain}
                className="liquid-glass-button back-button"
                style={{ fontSize: 14, padding: "6px 12px" }}
              >
                &larr; Back
              </button>
            ) : (
              <button
                onClick={goToStats}
                className="liquid-glass-button"
                style={{ fontSize: 16, fontWeight: 700 }}
              >
                Stats
              </button>
            )}
          </div>

          {view === "setup" && (
            <p
              style={{
                display: "block",
                fontSize: 12,
                color: "grey",
                fontWeight: 700,
                marginBottom: 14,
              }}>
              You&apos;re getting skip segments from TheIntroDB!
              <br />
              <br />
              Optionally, you can enter your API key to submit new segments and
              skip using your still pending segments!
            </p>
          )}

          <div
            style={{
              boxSizing: "border-box",
              width: "100%",
              overflow: "hidden",
              background: "rgba(25, 25, 25, 0.8)",
              padding: 18,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 15px 35px rgba(0,0,0,0.6)",
            }}>
            {view === "setup" && <SetupPage onSaveKey={handleSaveKey} />}
            {view === "main" && (
              <MainPage
                mediaTitle={mediaTitle}
                mediaMeta={mediaMeta}
                segment={segment}
                setSegment={setSegment}
                startSec={startSec}
                setStartSec={setStartSec}
                status={status}
                statusColor={statusColor}
                onSubmit={handleSubmit}
                onDisconnect={handleClearKey}
              />
            )}
            {view === "stats" && <StatsPage />}
          </div>
          <Footer />
        </div>
      </div>
    </>
  );
}

export default IndexPopup;