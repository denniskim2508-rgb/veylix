import { useState, useCallback } from "react";
import {
  Download,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  ExternalLink,
  Tag,
  User,
  Calendar,
} from "lucide-react";
import { useAddonStore } from "../../store/addonStore";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import {
  ADDON_CATEGORY_LABELS,
  ADDON_TYPE_LABELS,
} from "../../types/addon";

export function AddonDetail() {
  const {
    getSelectedAddon,
    getAddonState,
    installAddon,
    uninstallAddon,
    enableAddon,
    disableAddon,
    isLoading,
    installedAddons,
  } = useAddonStore();

  const addon = getSelectedAddon();
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const handleInstall = useCallback(async () => {
    if (!addon) return;
    const latestVersion = addon.versions[0];
    if (!latestVersion) return;
    setIsActionInProgress(true);
    try {
      await installAddon(addon, latestVersion.version);
    } catch {
      // error is set in store
    } finally {
      setIsActionInProgress(false);
    }
  }, [addon, installAddon]);

  const handleUninstall = useCallback(async () => {
    if (!addon) return;
    setIsActionInProgress(true);
    try {
      await uninstallAddon(addon.id);
    } catch {
      // error is set in store
    } finally {
      setIsActionInProgress(false);
    }
  }, [addon, uninstallAddon]);

  const handleEnable = useCallback(async () => {
    if (!addon) return;
    setIsActionInProgress(true);
    try {
      await enableAddon(addon.id);
    } catch {
      // error is set in store
    } finally {
      setIsActionInProgress(false);
    }
  }, [addon, enableAddon]);

  const handleDisable = useCallback(async () => {
    if (!addon) return;
    setIsActionInProgress(true);
    try {
      await disableAddon(addon.id);
    } catch {
      // error is set in store
    } finally {
      setIsActionInProgress(false);
    }
  }, [addon, disableAddon]);

  const installBtn = useFocusableElement({
    id: "addon-install",
    region: "addondetail",
    onClick: handleInstall,
  });
  const uninstallBtn = useFocusableElement({
    id: "addon-uninstall",
    region: "addondetail",
    onClick: handleUninstall,
  });
  const enableBtn = useFocusableElement({
    id: "addon-enable",
    region: "addondetail",
    onClick: handleEnable,
  });
  const disableBtn = useFocusableElement({
    id: "addon-disable",
    region: "addondetail",
    onClick: handleDisable,
  });

  if (!addon) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Select an add-on to view details
      </div>
    );
  }

  const state = getAddonState(addon.id);
  const installed = installedAddons.find((a) => a.id === addon.id);
  const latestVersion = addon.versions[0];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
          <span>{ADDON_CATEGORY_LABELS[addon.category] || addon.category}</span>
          <span>&middot;</span>
          <span>{ADDON_TYPE_LABELS[addon.type] || addon.type}</span>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-1">{addon.name}</h2>
        <p className="text-sm text-text-secondary">{addon.author}</p>
      </div>

      {/* Description */}
      <div className="mb-6">
        <p className="text-sm text-text-secondary leading-relaxed">
          {addon.description}
        </p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <MetaRow icon={Tag} label="Version" value={addon.version} />
        <MetaRow icon={User} label="Author" value={addon.author} />
        {addon.license && (
          <MetaRow icon={Calendar} label="License" value={addon.license} />
        )}
        {installed && (
          <MetaRow
            icon={Calendar}
            label="Installed"
            value={new Date(installed.installedAt).toLocaleDateString()}
          />
        )}
      </div>

      {/* Tags */}
      {addon.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {addon.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-full bg-bg-hover text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Screenshots */}
      {addon.screenshots.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-2">
            Screenshots
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {addon.screenshots.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Screenshot ${i + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex gap-3 mb-6">
        {addon.homepageUrl && (
          <a
            href={addon.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={12} />
            Homepage
          </a>
        )}
        {addon.sourceRepository && (
          <a
            href={addon.sourceRepository}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink size={12} />
            Source
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        {state === "not-installed" && (
          <ActionButton
            ref={installBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={handleInstall}
            disabled={isActionInProgress || isLoading || !latestVersion}
            icon={Download}
            label={isActionInProgress ? "Installing..." : "Install"}
            variant="primary"
            focusableProps={installBtn.focusableProps}
            isFocused={installBtn.isFocused}
          />
        )}

        {state === "update-available" && (
          <ActionButton
            ref={installBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={handleInstall}
            disabled={isActionInProgress || isLoading || !latestVersion}
            icon={RefreshCw}
            label={isActionInProgress ? "Updating..." : `Update to ${latestVersion?.version}`}
            variant="primary"
            focusableProps={installBtn.focusableProps}
            isFocused={installBtn.isFocused}
          />
        )}

        {(state === "enabled" || state === "disabled" || state === "installed") && (
          <>
            {state !== "disabled" && (
              <ActionButton
                ref={disableBtn.ref as React.RefObject<HTMLButtonElement>}
                onClick={handleDisable}
                disabled={isActionInProgress || isLoading}
                icon={PowerOff}
                label="Disable"
                variant="secondary"
                focusableProps={disableBtn.focusableProps}
                isFocused={disableBtn.isFocused}
              />
            )}
            {state === "disabled" && (
              <ActionButton
                ref={enableBtn.ref as React.RefObject<HTMLButtonElement>}
                onClick={handleEnable}
                disabled={isActionInProgress || isLoading}
                icon={Power}
                label="Enable"
                variant="primary"
                focusableProps={enableBtn.focusableProps}
                isFocused={enableBtn.isFocused}
              />
            )}
            <ActionButton
              ref={uninstallBtn.ref as React.RefObject<HTMLButtonElement>}
              onClick={handleUninstall}
              disabled={isActionInProgress || isLoading}
              icon={Trash2}
              label="Uninstall"
              variant="danger"
              focusableProps={uninstallBtn.focusableProps}
              isFocused={uninstallBtn.isFocused}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-text-muted shrink-0" />
      <span className="text-text-muted">{label}:</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  variant,
  focusableProps,
  isFocused,
  ref,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  variant: "primary" | "secondary" | "danger";
  focusableProps: Record<string, unknown>;
  isFocused: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const base =
    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary hover:bg-primary-hover text-white",
    secondary: "border border-border text-text-secondary hover:bg-bg-hover",
    danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      {...focusableProps}
      className={`${base} ${variants[variant]} ${isFocused ? "ring-1 ring-inset ring-primary/40" : ""}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
