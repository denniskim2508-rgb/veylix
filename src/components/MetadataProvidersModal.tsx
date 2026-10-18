import { useState, useEffect, useRef } from "react";
import { X, Plug, CheckCircle, XCircle, Loader2, Trash2, Eye, EyeOff } from "lucide-react";
import type { GamehubAction } from "../types/controller";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { setConsoleOverlayHandler } from "../utils/consoleInput";
import { isConsoleActive } from "../store/consoleStore";
import { useT } from "../i18n";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface MetadataProvidersModalProps {
  onClose: () => void;
}

type ConnectionStatus = "unknown" | "checking" | "connected" | "error";

interface ProviderState {
  apiKey: string;
  savedApiKey: string;
  status: ConnectionStatus;
  errorMessage: string;
  enabled: boolean;
}

interface IgdbState {
  clientId: string;
  clientSecret: string;
  savedClientId: string;
  status: ConnectionStatus;
  errorMessage: string;
}

export function MetadataProvidersModal({ onClose }: MetadataProvidersModalProps) {
  const { t } = useT();
  const [sgdb, setSgdb] = useState<ProviderState>({
    apiKey: "",
    savedApiKey: "",
    status: "unknown",
    errorMessage: "",
    enabled: true,
  });
  const [igdb, setIgdb] = useState<IgdbState>({
    clientId: "",
    clientSecret: "",
    savedClientId: "",
    status: "unknown",
    errorMessage: "",
  });
  const [moby, setMoby] = useState<ProviderState>({
    apiKey: "",
    savedApiKey: "",
    status: "unknown",
    errorMessage: "",
    enabled: true,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState("");
  const closeBtn = useFocusableElement({ id: "metadata-close", region: "modal", onClick: onClose });
  const panelRef = useRef<HTMLDivElement | null>(null);

  // While open in Console Mode, drive the panel with the controller: D-pad
  // walks the interactive controls in DOM order (auto-scrolling the focused one
  // into view) and BACK closes. Physical keyboard stays native so keys can be
  // typed into the API-key fields.
  useEffect(() => {
    if (!isConsoleActive()) return;
    let current: HTMLElement | null = null;

    const getControls = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("[data-console-control]:not([disabled])") ?? [],
      );

    const focusAt = (index: number) => {
      const controls = getControls();
      if (controls.length === 0) return;
      const clamped = Math.max(0, Math.min(controls.length - 1, index));
      current = controls[clamped];
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: "nearest" });
    };

    const move = (dir: 1 | -1) => {
      const controls = getControls();
      const idx = current ? controls.indexOf(current) : -1;
      focusAt(idx === -1 ? 0 : idx + dir);
    };

    focusAt(0);

    setConsoleOverlayHandler((action: GamehubAction) => {
      switch (action) {
        case "down":
          move(1);
          break;
        case "up":
          move(-1);
          break;
        case "confirm": {
          const controls = getControls();
          const target = current && controls.includes(current) ? current : controls[0];
          target?.click();
          break;
        }
        case "cancel":
        case "menu":
          onClose();
          break;
        default:
          break;
      }
    });

    return () => setConsoleOverlayHandler(null);
  }, [onClose]);

  useEffect(() => {
    invoke<Record<string, unknown>>("get_plugin_settings", { pluginId: "steamgriddb" })
      .then((settings) => {
        const key = (settings.api_key as string) || "";
        const hasKey = settings.api_key === true ||
          (typeof settings.api_key === "string" && settings.api_key.length > 0);
        setSgdb((prev) => ({
          ...prev,
          savedApiKey: key,
          apiKey: key,
          status: hasKey ? "connected" : "unknown",
        }));
      })
      .catch(() => {});

    invoke<Record<string, unknown>>("get_plugin_settings", { pluginId: "igdb" })
      .then((settings) => {
        const cid = (settings.client_id as string) || "";
        const hasSecret = settings.client_secret === true ||
          (typeof settings.client_secret === "string" && settings.client_secret.length > 0);
        setIgdb((prev) => ({
          ...prev,
          savedClientId: cid,
          clientId: cid,
          status: cid && hasSecret ? "connected" : "unknown",
        }));
      })
      .catch(() => {});

    invoke<Record<string, unknown>>("get_plugin_settings", { pluginId: "mobygames" })
      .then((settings) => {
        const key = (settings.api_key as string) || "";
        const hasKey = settings.api_key === true ||
          (typeof settings.api_key === "string" && settings.api_key.length > 0);
        setMoby((prev) => ({
          ...prev,
          savedApiKey: key,
          apiKey: key,
          status: hasKey ? "connected" : "unknown",
        }));
      })
      .catch(() => {});
  }, []);

  const handleSgdbSave = async () => {
    if (!sgdb.apiKey.trim()) return;
    setSaving(true);
    try {
      await invoke("save_plugin_settings", {
        pluginId: "steamgriddb",
        settings: { api_key: sgdb.apiKey.trim() },
      });
      setSgdb((prev) => ({
        ...prev,
        savedApiKey: prev.apiKey.trim(),
        apiKey: prev.apiKey.trim(),
        status: "connected",
        errorMessage: "",
      }));
    } catch (err) {
      setSgdb((prev) => ({ ...prev, status: "error", errorMessage: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const handleSgdbTest = async () => {
    setTesting("steamgriddb");
    setSgdb((prev) => ({ ...prev, status: "checking", errorMessage: "" }));
    try {
      await invoke<string>("test_metadata_provider", { providerId: "steamgriddb" });
      setSgdb((prev) => ({ ...prev, status: "connected", errorMessage: "" }));
    } catch (err) {
      setSgdb((prev) => ({ ...prev, status: "error", errorMessage: String(err) }));
    } finally {
      setTesting("");
    }
  };

  const handleSgdbClear = async () => {
    try {
      await invoke("clear_plugin_settings", { pluginId: "steamgriddb" });
      setSgdb({ apiKey: "", savedApiKey: "", status: "unknown", errorMessage: "", enabled: true });
    } catch (err) {
      console.error("Failed to clear settings:", err);
    }
  };

  const handleSave = async () => {
    if (!igdb.clientId.trim() || !igdb.clientSecret.trim()) return;
    setSaving(true);
    try {
      await invoke("save_plugin_settings", {
        pluginId: "igdb",
        settings: {
          client_id: igdb.clientId.trim(),
          client_secret: igdb.clientSecret.trim(),
        },
      });
      setIgdb((prev) => ({
        ...prev,
        savedClientId: prev.clientId.trim(),
        clientSecret: "",
        status: "connected",
        errorMessage: "",
      }));
    } catch (err) {
      setIgdb((prev) => ({
        ...prev,
        status: "error",
        errorMessage: String(err),
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting("igdb");
    setIgdb((prev) => ({ ...prev, status: "checking", errorMessage: "" }));
    try {
      await invoke<string>("test_metadata_provider", { providerId: "igdb" });
      setIgdb((prev) => ({ ...prev, status: "connected", errorMessage: "" }));
    } catch (err) {
      setIgdb((prev) => ({
        ...prev,
        status: "error",
        errorMessage: String(err),
      }));
    } finally {
      setTesting("");
    }
  };

  const handleClear = async () => {
    try {
      await invoke("clear_plugin_settings", { pluginId: "igdb" });
      setIgdb({
        clientId: "",
        clientSecret: "",
        savedClientId: "",
        status: "unknown",
        errorMessage: "",
      });
    } catch (err) {
      console.error("Failed to clear settings:", err);
    }
  };

  const handleMobySave = async () => {
    if (!moby.apiKey.trim()) return;
    setSaving(true);
    try {
      await invoke("save_plugin_settings", {
        pluginId: "mobygames",
        settings: { api_key: moby.apiKey.trim() },
      });
      setMoby((prev) => ({
        ...prev,
        savedApiKey: prev.apiKey.trim(),
        apiKey: prev.apiKey.trim(),
        status: "connected",
        errorMessage: "",
      }));
    } catch (err) {
      setMoby((prev) => ({ ...prev, status: "error", errorMessage: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const handleMobyTest = async () => {
    setTesting("mobygames");
    setMoby((prev) => ({ ...prev, status: "checking", errorMessage: "" }));
    try {
      await invoke<string>("test_metadata_provider", { providerId: "mobygames" });
      setMoby((prev) => ({ ...prev, status: "connected", errorMessage: "" }));
    } catch (err) {
      setMoby((prev) => ({ ...prev, status: "error", errorMessage: String(err) }));
    } finally {
      setTesting("");
    }
  };

  const handleMobyClear = async () => {
    try {
      await invoke("clear_plugin_settings", { pluginId: "mobygames" });
      setMoby({ apiKey: "", savedApiKey: "", status: "unknown", errorMessage: "", enabled: true });
    } catch (err) {
      console.error("Failed to clear settings:", err);
    }
  };

  const isConfigured = igdb.savedClientId.length > 0;
  const isSgdbConfigured = sgdb.savedApiKey.length > 0;
  const isMobyConfigured = moby.savedApiKey.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        ref={panelRef}
        className="w-full max-w-lg max-h-[92vh] flex flex-col bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Plug size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Metadata Providers</h2>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            data-console-control
            className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* SteamGridDB Provider */}
          <div className="rounded-xl border border-border bg-bg-main p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">SteamGridDB</h3>
                <p className="text-xs text-text-muted mt-0.5">Primary artwork provider — covers, heroes, logos, icons</p>
              </div>
              <StatusBadge status={sgdb.status} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">API Key</label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={sgdb.apiKey}
                    onChange={(e) => setSgdb((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={isSgdbConfigured ? "Enter new key to update" : "Enter your SteamGridDB API key"}
                    data-console-control
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    data-console-control
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {isSgdbConfigured && (
                  <p className="text-xs text-text-muted mt-1">Saved. Enter a new value to replace.</p>
                )}
              </div>

              {sgdb.errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-500">{sgdb.errorMessage}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSgdbSave}
                  disabled={saving || !sgdb.apiKey.trim()}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("common.save")}
                </button>
                <button
                  onClick={handleSgdbTest}
                  disabled={testing === "steamgriddb" || !isSgdbConfigured}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-bg-card hover:bg-bg-hover text-sm font-medium text-text-secondary transition-colors disabled:opacity-50"
                >
                  {testing === "steamgriddb" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test Connection
                </button>
                {isSgdbConfigured && (
                  <button
                    onClick={handleSgdbClear}
                    data-console-control
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-sm font-medium text-red-500 transition-colors ml-auto"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-bg-card border border-border-light">
              <p className="text-xs text-text-muted leading-relaxed">
                Get your API key from{" "}
                <a
                  href="https://www.steamgriddb.com/profile/preferences"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  SteamGridDB Preferences
                </a>
                . Provides high-quality community artwork for covers, heroes, logos, and icons.
              </p>
            </div>
          </div>

          {/* IGDB Provider */}
          <div className="rounded-xl border border-border bg-bg-main p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">IGDB</h3>
                <p className="text-xs text-text-muted mt-0.5">Internet Game Database — structured metadata, screenshots</p>
              </div>
              <StatusBadge status={igdb.status} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Client ID</label>
                <input
                  type="text"
                  value={igdb.clientId}
                  onChange={(e) => setIgdb((prev) => ({ ...prev, clientId: e.target.value }))}
                  placeholder="Enter your Twitch Client ID"
                  data-console-control
                  className="w-full px-3 py-2 rounded-xl bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={igdb.clientSecret}
                    onChange={(e) => setIgdb((prev) => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder={isConfigured ? "Enter new secret to update" : "Enter your Twitch Client Secret"}
                    data-console-control
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    data-console-control
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {isConfigured && (
                  <p className="text-xs text-text-muted mt-1">
                    Saved. Enter a new value to replace.
                  </p>
                )}
              </div>

              {igdb.errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-500">{igdb.errorMessage}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !igdb.clientId.trim() || !igdb.clientSecret.trim()}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("common.save")}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing === "igdb" || !isConfigured}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-bg-card hover:bg-bg-hover text-sm font-medium text-text-secondary transition-colors disabled:opacity-50"
                >
                  {testing === "igdb" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test Connection
                </button>
                {isConfigured && (
                  <button
                    onClick={handleClear}
                    data-console-control
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-sm font-medium text-red-500 transition-colors ml-auto"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-bg-card border border-border-light">
              <p className="text-xs text-text-muted leading-relaxed">
                Get your credentials from{" "}
                <a
                  href="https://dev.twitch.tv/console/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Twitch Developer Console
                </a>
                . Create an application and use the Client ID and Client Secret here. Your secret is stored locally and never sent to any server except Twitch for authentication.
              </p>
            </div>
          </div>

          {/* MobyGames Provider */}
          <div className="rounded-xl border border-border bg-bg-main p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">MobyGames</h3>
                <p className="text-xs text-text-muted mt-0.5">Covers, screenshots and descriptions — strongest for retro/obscure titles</p>
              </div>
              <StatusBadge status={moby.status} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">API Key</label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={moby.apiKey}
                    onChange={(e) => setMoby((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={isMobyConfigured ? "Enter new key to update" : "Enter your MobyGames API key"}
                    data-console-control
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    data-console-control
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {isMobyConfigured && (
                  <p className="text-xs text-text-muted mt-1">Saved. Enter a new value to replace.</p>
                )}
              </div>

              {moby.errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-500">{moby.errorMessage}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleMobySave}
                  disabled={saving || !moby.apiKey.trim()}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("common.save")}
                </button>
                <button
                  onClick={handleMobyTest}
                  disabled={testing === "mobygames" || !isMobyConfigured}
                  data-console-control
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-bg-card hover:bg-bg-hover text-sm font-medium text-text-secondary transition-colors disabled:opacity-50"
                >
                  {testing === "mobygames" ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test Connection
                </button>
                {isMobyConfigured && (
                  <button
                    onClick={handleMobyClear}
                    data-console-control
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-sm font-medium text-red-500 transition-colors ml-auto"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-bg-card border border-border-light">
              <p className="text-xs text-text-muted leading-relaxed">
                Request an API key from{" "}
                <a
                  href="https://www.mobygames.com/info/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  MobyGames
                </a>
                . Access is non-commercial and requires approval (MobyPro subscription or free research access). Provides box-art covers, screenshots and descriptions, but no transparent logos or hero art.
              </p>
              <p className="text-xs text-text-muted mt-2">
                Data by MobyGames.com
              </p>
            </div>
          </div>

          {/* Placeholder for future providers */}
          <div className="rounded-xl border border-dashed border-border bg-bg-main/50 p-5 text-center">
            <p className="text-xs text-text-muted">More providers (Steam, RAWG) coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
          <CheckCircle size={12} />
          Configured
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-error/10 text-error text-xs font-medium">
          <XCircle size={12} />
          Error
        </span>
      );
    case "checking":
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Loader2 size={12} className="animate-spin" />
          Testing...
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded-full bg-bg-hover text-text-muted text-xs font-medium">
          Not Configured
        </span>
      );
  }
}
