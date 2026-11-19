
const API_URL = "http://localhost:5000";

let dashboardMedicines = [];
let medicineHistory = [];
const notifiedReminders = new Set();
const savingMedicineIds = new Set();

// ========================================
// LOGGED-IN USER
// ========================================

function getLoggedInUser() {
    try {
        return JSON.parse(localStorage.getItem("loggedInUser")) || null;
    } catch {
        return null;
    }
}

// ========================================
// DATE AND TIME HELPERS
// ========================================

function getTodayString() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function getLocalDateString(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function formatTime(value) {
    if (!value) return "Not set";

    const parts = String(value).slice(0, 5).split(":");
    const date = new Date();

    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// LOAD DASHBOARD DATA
// ========================================

async function loadDashboard() {
    const user = getLoggedInUser();

    if (!user || !user.id) {
        window.location.href = "login.html";
        return;
    }

    const heading = document.querySelector(".dashboard-header h1");
    const profileCircle = document.querySelector(".profile-circle");
    const dateElement = document.getElementById("todayDate");

    if (heading) {
        heading.textContent = `Welcome, ${user.name || "User"}! 👋`;
    }

    if (profileCircle) {
        profileCircle.textContent = user.name
            ? user.name.charAt(0).toUpperCase()
            : "U";
    }

    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString(
            undefined,
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
    }

    try {
        const [medicineResponse, historyResponse] = await Promise.all([
            fetch(`${API_URL}/api/medicines/${user.id}`),
            fetch(`${API_URL}/api/history/${user.id}`)
        ]);

        const medicineData = await medicineResponse.json();
        const historyData = await historyResponse.json();

        if (!medicineResponse.ok || !medicineData.success) {
            throw new Error(
                medicineData.message || "Unable to load medicines."
            );
        }

        dashboardMedicines = medicineData.medicines || [];

        medicineHistory =
            historyResponse.ok && historyData.success
                ? historyData.history || []
                : [];

        displayMedicines();
        updateStatistics();
        updateNextReminder();

    } catch (error) {
        console.error("Dashboard loading error:", error);

        const list = document.getElementById("dashboardMedicineList");

        if (list) {
            list.textContent =
                "Unable to load dashboard data. Check that the backend is running.";
        }
    }
}

// ========================================
// MEDICINES ACTIVE TODAY
// ========================================

function getTodaysMedicines() {
    const today = getTodayString();

    return dashboardMedicines.filter(medicine => {
        const start = String(medicine.start_date || "").slice(0, 10);
        const end = medicine.end_date
            ? String(medicine.end_date).slice(0, 10)
            : "9999-12-31";

        return start <= today && end >= today &&
            String(medicine.status || "Active").toLowerCase() !== "inactive";
    });
}

// ========================================
// GET STATUS FOR TODAY
// ========================================

function getMedicineStatus(medicine) {
    const today = getTodayString();

    const entries = medicineHistory
        .filter(item => {
            if (String(item.medicine_id) !== String(medicine.id)) {
                return false;
            }

            if (!item.scheduled_time) return false;

            const date = new Date(item.scheduled_time);

            return !Number.isNaN(date.getTime()) &&
                getLocalDateString(date) === today;
        })
        .sort((a, b) =>
            new Date(b.recorded_at || b.scheduled_time) -
            new Date(a.recorded_at || a.scheduled_time)
        );

    return entries.length ? entries[0].status : "";
}

// ========================================
// DISPLAY MEDICINES
// ========================================

function displayMedicines() {
    const list = document.getElementById("dashboardMedicineList");

    if (!list) return;

    list.replaceChildren();

    const medicines = getTodaysMedicines();

    if (medicines.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No medicines scheduled for today.";
        list.appendChild(message);
        return;
    }

    medicines.forEach(medicine => {
        const row = document.createElement("div");
        row.className = "medicine-row";

        const left = document.createElement("div");
        left.className = "medicine-left";

        const icon = document.createElement("div");
        icon.className = "medicine-icon";
        icon.textContent = "💊";

        const details = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = medicine.medicine_name || "Medicine";

        const dosage = document.createElement("p");
        dosage.textContent =
            `${medicine.dosage || ""} • ${medicine.food_timing || "Any Time"}`;

        details.append(name, dosage);
        left.append(icon, details);

        const timeBox = document.createElement("div");
        timeBox.className = "medicine-time";

        const time = document.createElement("strong");
        time.textContent = formatTime(medicine.reminder_time);

        const status = document.createElement("span");
        status.className = "medicine-status";

        const currentStatus = getMedicineStatus(medicine);
        status.textContent = currentStatus || "Upcoming";
        status.classList.add(
            currentStatus === "Taken" ? "taken" :
            currentStatus === "Missed" ? "missed" : "upcoming"
        );

        const buttons = document.createElement("div");
        buttons.className = "medicine-action-buttons";

        const takenButton = document.createElement("button");
        takenButton.type = "button";
        takenButton.textContent = "✓ Taken";
        takenButton.className = "taken-btn";

        const missedButton = document.createElement("button");
        missedButton.type = "button";
        missedButton.textContent = "✗ Missed";
        missedButton.className = "missed-btn";

        const alreadySaved = Boolean(currentStatus);
        const isSaving = savingMedicineIds.has(String(medicine.id));

        takenButton.disabled = alreadySaved || isSaving;
        missedButton.disabled = alreadySaved || isSaving;

        takenButton.addEventListener("click", () => {
            saveMedicineHistory(medicine, "Taken");
        });

        missedButton.addEventListener("click", () => {
            saveMedicineHistory(medicine, "Missed");
        });

        buttons.append(takenButton, missedButton);
        timeBox.append(time, status, buttons);
        row.append(left, timeBox);
        list.appendChild(row);
    });
}

// ========================================
// SAVE TAKEN OR MISSED STATUS
// ========================================

async function saveMedicineHistory(medicine, selectedStatus) {
    const user = getLoggedInUser();

    if (!user || !user.id) {
        alert("Please login again.");
        return;
    }

    if (!["Taken", "Missed"].includes(selectedStatus)) {
        alert("Invalid medicine status.");
        return;
    }

    const medicineId = String(medicine.id);

    if (savingMedicineIds.has(medicineId)) return;

    if (getMedicineStatus(medicine)) {
        alert("A status is already saved for this medicine today.");
        return;
    }

    savingMedicineIds.add(medicineId);
    displayMedicines();

    try {
        const timeParts = String(medicine.reminder_time || "00:00")
            .slice(0, 5)
            .split(":");

        const scheduledDate = new Date();
        scheduledDate.setHours(
            Number(timeParts[0]),
            Number(timeParts[1]),
            0,
            0
        );

        const response = await fetch(`${API_URL}/api/history`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: user.id,
                medicineId: medicine.id,
                scheduledTime: scheduledDate.toISOString(),
                status: selectedStatus
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not save medicine history.");
        }

        // Reload saved history from the backend.
        const historyResponse = await fetch(
            `${API_URL}/api/history/${user.id}`
        );

        const historyData = await historyResponse.json();

        if (!historyResponse.ok || !historyData.success) {
            throw new Error(
                "Status may have been saved, but history could not be refreshed. Reload the dashboard."
            );
        }

        medicineHistory = historyData.history || [];

        displayMedicines();
        updateStatistics();
        updateNextReminder();

        alert(`Medicine marked as ${selectedStatus}!`);

    } catch (error) {
        console.error("Save medicine status error:", error);
        alert(error.message || "Unable to save status. Please try again.");
    } finally {
        savingMedicineIds.delete(medicineId);
        displayMedicines();
        updateStatistics();
        updateNextReminder();
    }
}

// ========================================
// UPDATE DASHBOARD STATISTICS
// ========================================

function updateStatistics() {
    const cards = document.querySelectorAll(".stat-card h3");

    if (cards.length < 4) return;

    const medicines = getTodaysMedicines();

    const taken = medicines.filter(
        medicine => getMedicineStatus(medicine) === "Taken"
    ).length;

    const missed = medicines.filter(
        medicine => getMedicineStatus(medicine) === "Missed"
    ).length;

    const upcoming = Math.max(0, medicines.length - taken - missed);

    cards[0].textContent = dashboardMedicines.length;
    cards[1].textContent = taken;
    cards[2].textContent = upcoming;
    cards[3].textContent = missed;
}

// ========================================
// NEXT REMINDER
// ========================================

function updateNextReminder() {
    const output = document.getElementById("nextReminderText");

    if (!output) return;

    const now = new Date();
    const currentTime =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0");

    const upcoming = getTodaysMedicines()
        .filter(medicine =>
            !getMedicineStatus(medicine) &&
            String(medicine.reminder_time || "").slice(0, 5) >= currentTime
        )
        .sort((a, b) =>
            String(a.reminder_time).localeCompare(String(b.reminder_time))
        );

    output.textContent = upcoming.length
        ? `${upcoming[0].medicine_name} is scheduled for ${formatTime(upcoming[0].reminder_time)}.`
        : "No upcoming medicine reminders for today.";
}

// ========================================
// VAPID PUBLIC KEY HELPER
// ========================================

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
        [...rawData].map(character => character.charCodeAt(0))
    );
}

// ========================================
// PUSH NOTIFICATIONS
// ========================================

async function setupPushNotifications() {
    const status = document.getElementById("notificationStatus");
    const button = document.getElementById("enableNotificationsBtn");

    const setStatus = message => {
        if (status) status.textContent = message;
    };

    try {
        const user = getLoggedInUser();

        if (!user || !user.id) {
            setStatus("Please login first.");
            return;
        }

        if (
            !("serviceWorker" in navigator) ||
            !("PushManager" in window) ||
            !("Notification" in window)
        ) {
            setStatus("Push notifications are not supported by this browser.");
            return;
        }

        if (button) button.disabled = true;
        setStatus("Enabling notifications...");

        const registration = await navigator.serviceWorker.register(
            "/service-worker.js"
        );

        await navigator.serviceWorker.ready;

        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                setStatus("Notification permission was not granted.");
                return;
            }
        }

        const keyResponse = await fetch(`${API_URL}/api/push/public-key`);
        const keyData = await keyResponse.json();

        if (!keyResponse.ok || !keyData.success || !keyData.publicKey) {
            throw new Error(keyData.message || "Unable to retrieve public key.");
        }

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
            });
        }

        const saveResponse = await fetch(`${API_URL}/api/push/subscribe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: user.id,
                subscription: subscription.toJSON()
            })
        });

        const saveData = await saveResponse.json();

        if (!saveResponse.ok || !saveData.success) {
            throw new Error(saveData.message || "Unable to save subscription.");
        }

        setStatus("Push notifications enabled!");

        const testResponse = await fetch(`${API_URL}/api/push/test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ userId: user.id })
        });

        const testData = await testResponse.json();

        if (testResponse.ok && testData.success) {
            setStatus("Push notifications enabled! Test notification sent.");
        } else {
            setStatus("Subscription saved, but test notification failed.");
        }

    } catch (error) {
        console.error("Push setup error:", error);
        setStatus("Notification setup failed: " + error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

// ========================================
// LOCAL REMINDERS WHILE DASHBOARD IS OPEN
// ========================================

function checkMedicineReminders() {
    if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) {
        return;
    }

    const today = getTodayString();
    const now = new Date();

    const currentTime =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0");

    getTodaysMedicines().forEach(medicine => {
        const medicineTime = String(medicine.reminder_time || "").slice(0, 5);
        const key = `${today}-${medicine.id}-${medicineTime}`;

        if (
            medicineTime === currentTime &&
            !notifiedReminders.has(key) &&
            !getMedicineStatus(medicine)
        ) {
            new Notification("Medicine Reminder 💊", {
                body: `Time to take ${medicine.medicine_name} (${medicine.dosage}).`
            });

            notifiedReminders.add(key);
        }
    });
}

// ========================================
// BUTTON EVENTS
// ========================================

const notificationButton = document.getElementById(
    "enableNotificationsBtn"
);

if (notificationButton) {
    notificationButton.addEventListener("click", setupPushNotifications);
}

// ========================================
// START DASHBOARD
// ========================================

loadDashboard();

setInterval(checkMedicineReminders, 15000);
setInterval(loadDashboard, 60000);
