export function getAppBaseUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://runeprep.com";
}
