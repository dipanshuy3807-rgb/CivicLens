const API_BASE_URL = window.CIVICLENS_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_CENTER = [19.45, 72.81];
const DEFAULT_ZOOM = 11;

const severityColors = {
    Critical: "#d62828",
    High: "#f77f00",
    Medium: "#fcbf49",
    Low: "#2a9d8f",
};

const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);
const bounds = L.latLngBounds([]);
const statusEl = document.getElementById("status");
const markerLayer = L.layerGroup().addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

document.addEventListener("click", async (event) => {
    const button = event.target.closest(".match-button");
    if (!button) {
        return;
    }

    const issueId = button.dataset.issueId;
    if (!issueId) {
        return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Loading volunteers...";

    try {
        const matchResponse = await fetchJson(`/match/${issueId}`);
        alert(formatVolunteerMatch(matchResponse));
    } catch (error) {
        alert(error.message || "Unable to load volunteer matches.");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
});

async function init() {
    await Promise.allSettled([loadIssues(), loadHeatmap()]);

    if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
    }
}

async function loadIssues() {
    try {
        const issues = await fetchJson("/issues");
        let markerCount = 0;

        issues.forEach((issue) => {
            if (!isValidCoordinate(issue.latitude, issue.longitude)) {
                return;
            }

            const marker = L.circleMarker([issue.latitude, issue.longitude], {
                radius: 9,
                color: "#263238",
                weight: 1,
                fillColor: severityColors[issue.severity] || "#5c677d",
                fillOpacity: 0.9,
            });

            marker.bindPopup(buildIssuePopup(issue));
            marker.addTo(markerLayer);
            bounds.extend([issue.latitude, issue.longitude]);
            markerCount += 1;
        });

        setStatus(`${markerCount} issue markers loaded`);
    } catch (error) {
        setStatus("Issue markers failed to load");
        console.error("Failed to load issues:", error);
    }
}

async function loadHeatmap() {
    try {
        const heatmapPoints = await fetchJson("/analytics/heatmap");
        const heatData = heatmapPoints
            .filter((point) => isValidCoordinate(point.lat, point.lng))
            .map((point) => [point.lat, point.lng, normalizeIntensity(point.intensity)]);

        if (!heatData.length) {
            return;
        }

        L.heatLayer(heatData, {
            radius: 25,
            blur: 18,
            maxZoom: 16,
        }).addTo(map);

        heatData.forEach(([lat, lng]) => bounds.extend([lat, lng]));
    } catch (error) {
        console.error("Failed to load heatmap data:", error);
    }
}

async function fetchJson(path) {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

function buildIssuePopup(issue) {
    return `
        <div class="issue-popup">
            <h3>${escapeHtml(issue.issue_type || "Unknown Issue")}</h3>
            <p><strong>Location:</strong> ${escapeHtml(issue.location || "Unknown")}</p>
            <p><strong>Severity:</strong> ${escapeHtml(issue.severity || "Unknown")}</p>
            <p><strong>People Affected:</strong> ${formatNumber(issue.people_affected)}</p>
            <p><strong>Priority Score:</strong> ${formatNumber(issue.priority_score)}</p>
            <button class="match-button" data-issue-id="${issue.id}">
                Match Volunteers
            </button>
        </div>
    `;
}

function formatVolunteerMatch(payload) {
    const volunteers = payload.matched_volunteers || [];
    if (!volunteers.length) {
        return `Required skill: ${payload.required_skill}\nNo matching volunteers found.`;
    }

    const volunteerLines = volunteers.map((volunteer) => {
        const skills = Array.isArray(volunteer.skills) ? volunteer.skills.join(", ") : "";
        return `- ${volunteer.name} (${volunteer.location})${skills ? ` | Skills: ${skills}` : ""}`;
    });

    return [
        `Required skill: ${payload.required_skill}`,
        "",
        "Matched volunteers:",
        ...volunteerLines,
    ].join("\n");
}

function normalizeIntensity(value) {
    const numericValue = Number(value) || 0;
    return Math.max(0.2, Math.min(numericValue / 1000, 1));
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function formatNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "N/A";
}

function setStatus(message) {
    statusEl.textContent = message;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

init();
