
const API_URL = "http://localhost:5000";

// ========================================
// HTML ELEMENTS
// ========================================

const tableBody = document.getElementById("historyTableBody");
const emptyHistory = document.getElementById("emptyHistory");
const takenCount = document.getElementById("takenCount");
const missedCount = document.getElementById("missedCount");
const totalCount = document.getElementById("totalCount");

// ========================================
// GET LOGGED-IN USER
// ========================================

function getLoggedInUser() {
    try {
        return JSON.parse(localStorage.getItem("loggedInUser")) || null;
    } catch {
        return null;
    }
}

// ========================================
// FORMAT DATE
// ========================================

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ========================================
// FORMAT TIME
// ========================================

function formatTime(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// LOAD HISTORY FROM DATABASE
// ========================================

async function loadHistory() {
    const user = getLoggedInUser();

    if (!tableBody) {
        console.error("historyTableBody element not found.");
        return;
    }

    if (!user || !user.id) {
        tableBody.replaceChildren();

        if (emptyHistory) {
            emptyHistory.style.display = "block";
            emptyHistory.textContent = "Please login to view medicine history.";
        }

        return;
    }

    try {
        tableBody.replaceChildren();

        const response = await fetch(
            `${API_URL}/api/history/${user.id}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load history.");
        }

        const historyData = data.history || [];

        let taken = 0;
        let missed = 0;

        if (historyData.length === 0) {
            if (emptyHistory) {
                emptyHistory.style.display = "block";
                emptyHistory.textContent =
                    "No medicine history available yet.";
            }

            if (takenCount) takenCount.textContent = "0";
            if (missedCount) missedCount.textContent = "0";
            if (totalCount) totalCount.textContent = "0";

            return;
        }

        if (emptyHistory) {
            emptyHistory.style.display = "none";
        }

        historyData.forEach(record => {
            if (record.status === "Taken") taken++;
            if (record.status === "Missed") missed++;

            const row = document.createElement("tr");

            const dateCell = document.createElement("td");
            dateCell.textContent = formatDate(record.scheduled_time);

            const medicineCell = document.createElement("td");
            medicineCell.className = "medicine-name";
            medicineCell.textContent =
                `💊 ${record.medicine_name || "Medicine unavailable"}`;

            const dosageCell = document.createElement("td");
            dosageCell.textContent = record.dosage || "-";

            const timeCell = document.createElement("td");
            timeCell.textContent = formatTime(record.scheduled_time);

            const statusCell = document.createElement("td");
            const statusBadge = document.createElement("span");

            statusBadge.className =
                `status ${record.status.toLowerCase()}`;

            statusBadge.textContent =
                record.status === "Taken" ? "✓ Taken" : "✕ Missed";

            statusCell.appendChild(statusBadge);

            row.append(
                dateCell,
                medicineCell,
                dosageCell,
                timeCell,
                statusCell
            );

            tableBody.appendChild(row);
        });

        if (takenCount) takenCount.textContent = taken;
        if (missedCount) missedCount.textContent = missed;
        if (totalCount) totalCount.textContent = historyData.length;

    } catch (error) {
        console.error("History loading error:", error);

        if (emptyHistory) {
            emptyHistory.style.display = "block";
            emptyHistory.textContent =
                "Unable to load history. Please check the backend server.";
        }
    }
}

// ========================================
// START
// ========================================

loadHistory();
