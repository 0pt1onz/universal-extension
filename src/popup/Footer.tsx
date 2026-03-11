import { useEffect, useState } from "react"

import { api } from "./api"

import "~style.css"

export function Footer() {
  const version = api.runtime.getManifest().version ?? "0.0.0"
  const [isEnabled, setIsEnabled] = useState(true)
  const [hostname, setHostname] = useState("")

  useEffect(() => {
    api.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        const url = new URL(tab.url)
        const host = url.hostname.replace(/^www./, "")
        setHostname(host)
        api.storage.local.get(["disabled_sites"]).then(({ disabled_sites }) => {
          setIsEnabled(!(disabled_sites || []).includes(host))
        })
      }
    })
  }, [])

  const handleToggle = () => {
    api.storage.local.get(["disabled_sites"]).then(({ disabled_sites }) => {
      const sites = disabled_sites || []
      if (sites.includes(hostname)) {
        api.storage.local.set({
          disabled_sites: sites.filter((s) => s !== hostname)
        })
        setIsEnabled(true)
      } else {
        api.storage.local.set({ disabled_sites: [...sites, hostname] })
        setIsEnabled(false)
      }
    })
  }

  return (
    <div className="flex items-center justify-between pt-2 mt-3">
      <span className="inline-block text-xs text-gray-400 no-underline transition-colors duration-200">
        v{version}
      </span>
      <label className="flex items-center text-xs text-gray-400">
        {isEnabled ? "Enabled" : "Disabled"} on {hostname}
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={handleToggle}
          className="ml-1 accent-green-400"
        />
      </label>
      <a
        href="https://github.com/TheIntroDB/universal-extension"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs text-gray-400 no-underline transition-colors duration-200 hover:text-gray-300">
        Github
      </a>
    </div>
  )
}
