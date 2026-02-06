export function getAppBaseUrl() {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://runeprep.com";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return `https://${raw}`;
}
