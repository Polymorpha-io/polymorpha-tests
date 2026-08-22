/**
 * Fetches data from an external API (via proxy) and returns it as a raw File.
 * JSON APIs will be returned as .json files, which the Python backend will flatten.
 */
export async function fetchApiAndConvertToCsv(apiUrl: string): Promise<File> {
  const proxyUrl = `/api/v1/proxy?url=${encodeURIComponent(apiUrl)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    let errorMsg = "Failed to fetch API";
    try {
      const errData = await res.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const contentType = res.headers.get("Content-Type") || "";
  const isCsv = contentType.includes("text/csv");
  const ext = isCsv ? ".csv" : ".json";
  const mimeType = isCsv ? "text/csv" : "application/json";

  const blob = await res.blob();

  // Generate a filename from the URL, fallback to api_data
  let fileName = `api_data${ext}`;
  try {
    const urlObj = new URL(apiUrl);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      fileName = `${pathParts[pathParts.length - 1]}`;
      if (!fileName.endsWith(ext)) fileName += ext;
    }
  } catch {
    // ignore
  }

  // Create and return a File
  return new File([blob], fileName, { type: mimeType });
}
