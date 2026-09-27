import { useEffect, useState } from "react";
import { REPO_URL } from "./constants";

export type LatestRelease = {
  version: string;
  downloads: {
    mac: string;
    windows: string;
    linux: string;
  };
};

type GithubAsset = {
  name?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  assets?: GithubAsset[];
};

// GitHub's /releases/latest omits prereleases. Pupil publishes those, so the
// newest item from /releases is the version the landing page should offer.
function releasesEndpoint(): string {
  const { pathname } = new URL(REPO_URL);
  return `https://api.github.com/repos${pathname}/releases?per_page=1`;
}

function assetUrl(release: GithubRelease, suffix: string): string | null {
  const asset = release.assets?.find(
    (item) => item.name?.endsWith(suffix) && item.browser_download_url,
  );
  return asset?.browser_download_url ?? null;
}

export function parseLatestRelease(release: GithubRelease): LatestRelease | null {
  const tag = release.tag_name ?? "";
  const version = tag.startsWith("app-v") ? tag.slice("app-v".length) : tag;
  const mac = assetUrl(release, "_aarch64.dmg");
  const windows = assetUrl(release, "_x64-setup.exe");
  const linux = assetUrl(release, "_amd64.AppImage");

  if (!version || !mac || !windows || !linux) return null;

  return { version, downloads: { mac, windows, linux } };
}

let pending: Promise<LatestRelease | null> | null = null;

export function loadLatestRelease(): Promise<LatestRelease | null> {
  if (!pending) {
    pending = fetch(releasesEndpoint(), {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const releases = (await response.json()) as GithubRelease[];
        const newest = releases[0];
        return newest ? parseLatestRelease(newest) : null;
      })
      .catch(() => null);
  }

  return pending;
}

export function useLatestRelease(): LatestRelease | null {
  const [release, setRelease] = useState<LatestRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLatestRelease().then((value) => {
      if (!cancelled) setRelease(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}
