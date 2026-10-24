/* Set the public API origin here after deploying your own backend. Never put secrets here. */
window.WORK_SATTHI_API_URL = window.WORK_SATTHI_API_URL || "";
async function apiRequest(path, options = {}) {
  const base = String(window.WORK_SATTHI_API_URL || "").replace(/\/$/, "");
  if (!base || base.includes("YOUR-BACKEND-SERVICE")) {
    throw new Error("The Work Satthi API is not configured. Set WORK_SATTHI_API_URL in api.js to your backend's public origin.");
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("workSatthiToken");
  if (token) headers.Authorization = "Bearer " + token;
  let response;
  try {
    response = await fetch(base + path, { ...options, headers });
  } catch (_error) {
    throw new Error("Could not connect to the backend. Check that the API is deployed and its CORS origin includes this website.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
