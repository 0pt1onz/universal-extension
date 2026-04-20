import { useTranslation } from "react-i18next"

interface SetupPageProps {
  apiKey: string
  onApiKeyChange: (value: string) => void
  onSaveKey: () => void | Promise<void>
}

export function SetupPage({
  apiKey,
  onApiKeyChange,
  onSaveKey
}: SetupPageProps) {
  const { t } = useTranslation()

  return (
    <div>
      <label className="block text-[10px] font-bold text-green-400 mb-2.5 uppercase tracking-[0.5px]">
        {t("popup.apiKey")}
      </label>
      <input
        id="api-key-input"
        type="password"
        placeholder={t("popup.enterApiKey")}
        value={apiKey}
        onChange={(event) => onApiKeyChange(event.target.value)}
        className="w-full min-w-0 p-[11px] bg-[#151515] border border-white/[.08] rounded-4xl box-border text-white text-[13px] mb-3"
      />
      <button
        type="button"
        onClick={onSaveKey}
        className="border-gradient-pill p-3.5 w-full cursor-pointer font-bold uppercase text-[11px] tracking-[1px] text-green-400 hover:text-green-400 border-green-400/30">
        {t("popup.authorize")}
      </button>
    </div>
  )
}
