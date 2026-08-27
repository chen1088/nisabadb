export function classifyRawBookDataRequest(requestUrl: string): 400 | 404 | null {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return 400;
  }
  const segments: string[] = [];
  for (const segment of decodedPathname.replaceAll("\\", "/").split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  const normalizedPathname = `/${segments.join("/")}`;
  return /(?:^|\/)data\/(?:books|book-sources)(?:\/|$)/iu.test(normalizedPathname) ? 404 : null;
}
