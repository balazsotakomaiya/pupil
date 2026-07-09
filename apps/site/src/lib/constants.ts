import appPackage from "../../../app/package.json";

export const REPO_URL = "https://github.com/balazsotakomaiya/pupil";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const DOCS_URL = `${REPO_URL}/wiki`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const DESKTOP_APP_VERSION = appPackage.version;
export const RELEASE_TAG = `app-v${DESKTOP_APP_VERSION}`;
export const DOWNLOAD_BASE = `${REPO_URL}/releases/download/${RELEASE_TAG}`;
