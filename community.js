(() => {
  "use strict";
  const KEY = "communityWatchReportsV1";
  const categories = {
    pothole: { label: "Road / pothole", symbol: "●", color: "#B45309" },
    waste: { label: "Waste / garbage", symbol: "♻", color: "#15803D" },
    water: { label: "Water / drainage", symbol: "◆", color: "#0369A1" },
    streetlight: { label: "Streetlight", symbol: "☼", color: "#A16207" },
    electricity: { label: "Electricity hazard", symbol: "⚡", color: "#B91C1C" },
    air: { label: "Air pollution", symbol: "≋", color: "#6D28D9" },
    public: { label: "Public property", symbol: "■", color: "#475569" },
    other: { label: "Other issue", symbol: "!", color: "#BE185D" }
  };
  const $ = (id) => document.getElementById(id);
  let map;
  let markers = [];
  let selectedPoint = null;
  let photoData = "";
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function loadReports() {
    try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveReports(reports) { localStorage.setItem(KEY, JSON.stringify(reports)); }
  function icon(category) {
    const item = categories[category] || categories.other;
    return L.divIcon({ className: "issue-marker-shell", html: '<span class="issue-marker" style="--marker-color:' + item.color + '">' + item.symbol + '</span>', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -15] });
  }
  function initMap() {
    if (!window.L) { $("map-status").textContent = "Map library could not load. Check your internet connection."; return; }
    map = L.map("india-map", { minZoom: 4, maxZoom: 18 }).setView([22.8, 79.0], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    map.setMaxBounds([[5.5, 66.5], [38.8, 100]]);
    map.on("click", (event) => setCoordinates(event.latlng.lat, event.latlng.lng, true));
    $("map-status").textContent = "Tap the map to choose a report location.";
    renderLegend();
    renderReports();
  }
  function renderLegend() {
    $("legend-list").innerHTML = Object.entries(categories).map(([key, item]) => '<div class="legend-item"><span class="legend-symbol" style="--marker-color:' + item.color + '">' + item.symbol + '</span><span>' + safe(item.label) + '</span></div>').join("");
  }
  function setCoordinates(lat, lng, moveMap) {
    if (lat < 6.5 || lat > 37.5 || lng < 68 || lng > 98.5) {
      $("form-feedback").textContent = "Choose a location within the map area of India."; return;
    }
    selectedPoint = { lat, lng };
    $("report-lat").value = lat.toFixed(5);
    $("report-lng").value = lng.toFixed(5);
    $("map-status").textContent = "Selected point: " + lat.toFixed(4) + ", " + lng.toFixed(4) + ".";
    if (moveMap && map) map.setView([lat, lng], Math.max(map.getZoom(), 10));
  }
  function locate() {
    if (!navigator.geolocation) { $("form-feedback").textContent = "This browser does not support location. Tap the map to choose a point."; return; }
    $("form-feedback").textContent = "Waiting for location permission…";
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      if (latitude < 6.5 || latitude > 37.5 || longitude < 68 || longitude > 98.5) { $("form-feedback").textContent = "Your location appears outside India. Tap the map to choose a report point."; return; }
      setCoordinates(latitude, longitude, true);
      if (map) L.circleMarker([latitude, longitude], { radius: 7, color: "#143D32", fillColor: "#D9F078", fillOpacity: 1 }).addTo(map).bindPopup("Your current location (shown only in this browser)").openPopup();
      $("form-feedback").textContent = "Coordinates filled. For privacy, consider choosing a nearby public landmark instead of your exact position.";
    }, (error) => {
      const messages = { 1: "Location permission was denied. You can tap the map to choose a point.", 2: "Your location is unavailable. Tap the map to choose a point.", 3: "Location request timed out. Try again or tap the map." };
      $("form-feedback").textContent = messages[error.code] || "Could not get location. Tap the map to choose a point.";
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }
  function filteredReports() {
    const filter = $("reports-filter").value;
    return loadReports().filter((report) => filter === "all" || report.category === filter);
  }
  function renderReports() {
    if (!map) return;
    markers.forEach((marker) => map.removeLayer(marker));
    markers = [];
    const reports = loadReports();
    const mapFilter = $("map-filter").value;
    reports.filter((report) => mapFilter === "all" || report.category === mapFilter).forEach((report) => {
      if (!Number.isFinite(Number(report.lat)) || !Number.isFinite(Number(report.lng))) return;
      const item = categories[report.category] || categories.other;
      const marker = L.marker([Number(report.lat), Number(report.lng)], { icon: icon(report.category) }).addTo(map);
      marker.bindPopup('<div class="map-popup"><strong>' + safe(report.title) + '</strong><span class="popup-category">' + safe(item.label) + '</span><p>' + safe(report.description) + '</p><small>' + safe(report.location) + '</small><br><small>' + safe(new Date(report.createdAt).toLocaleString()) + '</small></div>');
      markers.push(marker);
    });
    $("report-total").textContent = reports.length;
    const list = filteredReports();
    $("reports-list").innerHTML = list.map((report) => {
      const item = categories[report.category] || categories.other;
      return '<article class="report-card"><div class="report-card-top"><span class="legend-symbol" style="--marker-color:' + item.color + '">' + item.symbol + '</span><span class="report-category">' + safe(item.label) + '</span><span class="report-status">Community report</span></div><h3>' + safe(report.title) + '</h3><p>' + safe(report.description) + '</p><div class="report-location">⌖ ' + safe(report.location) + '</div><div class="report-card-bottom"><span>' + safe(new Date(report.createdAt).toLocaleDateString()) + (report.reporter ? ' · ' + safe(report.reporter) : '') + '</span><button type="button" class="text-button" data-report-id="' + safe(report.id) + '">View on map →</button></div></article>';
    }).join("");
    $("empty-reports").hidden = list.length > 0;
    $("reports-list").querySelectorAll("[data-report-id]").forEach((button) => button.addEventListener("click", () => {
      const report = loadReports().find((item) => item.id === button.dataset.reportId);
      if (report && map) { map.setView([report.lat, report.lng], 13); const marker = markers.find((item) => { const point = item.getLatLng(); return Math.abs(point.lat - report.lat) < 0.000001 && Math.abs(point.lng - report.lng) < 0.000001; }); if (marker) marker.openPopup(); $("explore-map").scrollIntoView({ behavior: "smooth" }); }
    }));
    $("map-status").textContent = markers.length + " report marker" + (markers.length === 1 ? "" : "s") + " shown. Tap any marker for details.";
  }
  $("community-report-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const lat = Number($("report-lat").value), lng = Number($("report-lng").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 6.5 || lat > 37.5 || lng < 68 || lng > 98.5) { $("form-feedback").textContent = "Choose a valid location in India by clicking the map or using location."; return; }
    const reports = loadReports();
    const report = { id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()), title: $("report-title").value.trim(), category: $("report-category").value, description: $("report-description").value.trim(), location: $("report-location").value.trim(), lat, lng, reporter: $("report-name").value.trim(), createdAt: new Date().toISOString() };
    if (!report.title || !report.category || !report.description || !report.location) { $("form-feedback").textContent = "Please complete all required fields."; return; }
    reports.unshift(report);
    try { saveReports(reports.slice(0, 300)); }
    catch { $("form-feedback").textContent = "Could not save the report in this browser. Try removing the optional photo and retry."; return; }
    $("community-report-form").reset(); selectedPoint = null; photoData = "";
    $("form-feedback").textContent = "Report added to this browser's map. It is not shared with other devices or sent to authorities.";
    renderReports();
    map.setView([lat, lng], 12);
    const marker = markers.find((item) => { const point = item.getLatLng(); return Math.abs(point.lat - lat) < 0.000001 && Math.abs(point.lng - lng) < 0.000001; });
    if (marker) marker.openPopup();
    $("explore-map").scrollIntoView({ behavior: "smooth" });
  });
  $("report-photo").addEventListener("change", () => {
    const file = $("report-photo").files[0];
    if (file && file.size > 2 * 1024 * 1024) { $("report-photo").value = ""; $("form-feedback").textContent = "Photo must be 2 MB or smaller. Photos are not uploaded in this prototype."; return; }
    photoData = "";
  });
  $("locate-me").addEventListener("click", locate);
  $("form-locate").addEventListener("click", locate);
  $("map-filter").addEventListener("change", renderReports);
  $("reports-filter").addEventListener("change", renderReports);
  const menu = $("menu-toggle");
  if (menu) menu.addEventListener("click", () => { const open = menu.getAttribute("aria-expanded") === "true"; menu.setAttribute("aria-expanded", String(!open)); $("nav-links").classList.toggle("is-open", !open); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMap); else initMap();
})();