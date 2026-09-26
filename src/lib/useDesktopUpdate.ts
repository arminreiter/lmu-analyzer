import { useCallback, useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/** Tauri desktop updater: checks GitHub Releases once on startup. No-op in the browser (PWA uses its service worker). */
export function useDesktopUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    // ponytail: startup-only check — racing sessions are short-lived app runs; add an interval if people leave it open for days
    check()
      .then(setUpdate)
      .catch(e => console.warn('Update check failed:', e));
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error('Update failed:', e);
      setInstalling(false);
    }
  }, [update]);

  return { available: update !== null, installing, install };
}
