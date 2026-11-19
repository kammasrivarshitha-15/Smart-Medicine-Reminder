const API_URL = "http://localhost:5000";

const medicineList = document.getElementById("medicineList");
const emptyMessage = document.getElementById("emptyMessage");

let allMedicines = [];
const savingMedicineIds = new Set();
const deactivatingMedicineIds = new Set();

function getLoggedInUser() {
    try {
        return JSON.parse(localStorage.getItem("loggedInUser")) || null;
    } catch {
        return null;
    }
}

function createText(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text ?? "";
    return element;
}

async function readResponse(response) {
    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok || !data.success) {
        throw new Error(data.message || `Request failed (${response.status}).`);
    }

    return data;
}

// DATE HELPER
// Date string ni timezone conversion lekunda YYYY-MM-DD format-lo unchutundi.
function normalizeDate(value) {
    if (!value) return "";

    const text = String(value).trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

    return match ? match[1] : "";
}

// ========================================
// LOAD MEDICINES
// ========================================

async function loadMedicines() {
    const user = getLoggedInUser();

    if (!user || !user.id) {
        alert("Please login again to view your medicines.");
        window.location.href = "login.html";
        return;
    }

    try {
        medicineList.replaceChildren(
            createText("p", "Loading medicines...")
        );

        emptyMessage.style.display = "none";

        const response = await fetch(
            `${API_URL}/api/medicines/${user.id}`
        );

        const data = await readResponse(response);

        allMedicines = data.medicines || [];
        displayMedicines();

    } catch (error) {
        console.error("Load medicines error:", error);

        medicineList.replaceChildren(
            createText(
                "p",
                "Unable to load medicines. Please check the backend server and try again."
            )
        );

        emptyMessage.style.display = "none";
    }
}

// ========================================
// DISPLAY MEDICINES
// ========================================

function displayMedicines() {
    medicineList.replaceChildren();

    const medicines = allMedicines.filter(medicine =>
        String(medicine.status || "Active").toLowerCase() !== "inactive"
    );

    if (medicines.length === 0) {
        emptyMessage.style.display = "flex";
        return;
    }

    emptyMessage.style.display = "none";

    medicines.forEach(medicine => {
        const card = document.createElement("div");
        card.className = "medicine-card";

        card.append(
            createText("h3", `💊 ${medicine.medicine_name || "Medicine"}`),
            createText("p", `Dosage: ${medicine.dosage || "Not specified"}`),
            createText(
                "p",
                `Reminder Time: ${String(medicine.reminder_time || "").slice(0, 5) || "Not set"}`
            ),
            createText("p", `Frequency: ${medicine.frequency || "Daily"}`),
            createText(
                "p",
                `Food Timing: ${medicine.food_timing || "Not specified"}`
            ),
            createText(
                "p",
                `Start Date: ${normalizeDate(medicine.start_date) || "Not specified"}`
            ),
            createText(
                "p",
                `End Date: ${normalizeDate(medicine.end_date) || "Not specified"}`
            ),
            createText("p", `Status: ${medicine.status || "Active"}`)
        );

        if (medicine.notes) {
            card.appendChild(createText("p", `Notes: ${medicine.notes}`));
        }

        const actions = document.createElement("div");
        actions.className = "medicine-actions";

        const editButton = createText("button", "✏️ Edit");
        editButton.type = "button";
        editButton.className = "edit-medicine-btn";

        editButton.addEventListener("click", () => {
            if (savingMedicineIds.has(String(medicine.id))) return;
            showEditForm(medicine, card);
        });

        const deactivateButton = createText("button", "Deactivate");
        deactivateButton.type = "button";
        deactivateButton.className = "delete-medicine-btn";

        deactivateButton.addEventListener("click", () => {
            deactivateMedicine(medicine);
        });

        actions.append(editButton, deactivateButton);
        card.appendChild(actions);
        medicineList.appendChild(card);
    });
}

// ========================================
// EDIT FORM
// ========================================

function showEditForm(medicine, card) {
    if (card.querySelector(".medicine-edit-form")) return;

    const form = document.createElement("form");
    form.className = "medicine-edit-form";

    function addField(labelText, name, value, type = "text", required = false) {
        const wrapper = document.createElement("label");
        wrapper.className = "medicine-edit-field";
        wrapper.appendChild(document.createTextNode(labelText));

        const input = document.createElement("input");
        input.name = name;
        input.type = type;
        input.required = required;

        if (type === "date") {
            input.value = normalizeDate(value);
        } else if (type === "time") {
            input.value = String(value || "").slice(0, 5);
        } else {
            input.value = value ?? "";
        }

        wrapper.appendChild(input);
        form.appendChild(wrapper);

        return input;
    }

    addField(
        "Medicine Name",
        "medicine_name",
        medicine.medicine_name,
        "text",
        true
    );

    addField(
        "Dosage",
        "dosage",
        medicine.dosage,
        "text",
        true
    );

    addField(
        "Reminder Time",
        "reminder_time",
        medicine.reminder_time,
        "time",
        true
    );

    // FREQUENCY
    const frequencyLabel = document.createElement("label");
    frequencyLabel.className = "medicine-edit-field";
    frequencyLabel.appendChild(document.createTextNode("Frequency"));

    const frequencySelect = document.createElement("select");
    frequencySelect.name = "frequency";
    frequencySelect.required = true;

    const frequencies = [
        "Daily",
        "Once Daily",
        "Twice Daily",
        "Three Times Daily",
        "Weekly",
        "As Needed"
    ];

    const currentFrequency = medicine.frequency || "Daily";

    if (!frequencies.includes(currentFrequency)) {
        frequencies.push(currentFrequency);
    }

    frequencies.forEach(frequency => {
        const option = document.createElement("option");
        option.value = frequency;
        option.textContent = frequency;
        option.selected = frequency === currentFrequency;
        frequencySelect.appendChild(option);
    });

    frequencyLabel.appendChild(frequencySelect);
    form.appendChild(frequencyLabel);

    // FOOD TIMING
    const foodLabel = document.createElement("label");
    foodLabel.className = "medicine-edit-field";
    foodLabel.appendChild(document.createTextNode("Food Timing"));

    const foodSelect = document.createElement("select");
    foodSelect.name = "food_timing";

    const foodOptions = [
        "Before Food",
        "After Food",
        "With Food",
        "Any Time"
    ];

    const currentFoodTiming = medicine.food_timing || "Any Time";

    if (!foodOptions.includes(currentFoodTiming)) {
        foodOptions.push(currentFoodTiming);
    }

    foodOptions.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = value === currentFoodTiming;
        foodSelect.appendChild(option);
    });

    foodLabel.appendChild(foodSelect);
    form.appendChild(foodLabel);

    // DATE FIELDS
    const startDateInput = addField(
        "Start Date",
        "start_date",
        medicine.start_date,
        "date",
        true
    );

    const endDateInput = addField(
        "End Date",
        "end_date",
        medicine.end_date,
        "date"
    );

    startDateInput.addEventListener("change", () => {
        endDateInput.min = startDateInput.value;
    });

    endDateInput.addEventListener("change", () => {
        if (
            endDateInput.value &&
            startDateInput.value &&
            endDateInput.value < startDateInput.value
        ) {
            alert("End date cannot be earlier than start date.");
            endDateInput.value = "";
        }
    });

    endDateInput.min = startDateInput.value || "";

    addField("Notes", "notes", medicine.notes || "");

    const saveButton = createText("button", "Save Changes");
    saveButton.type = "submit";

    const cancelButton = createText("button", "Cancel");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => form.remove());

    form.append(saveButton, cancelButton);

    // SAVE FORM
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const formData = new FormData(form);
        const updatedMedicine = Object.fromEntries(formData.entries());

        // Read date values directly from the input controls.
        updatedMedicine.start_date = startDateInput.value;
        updatedMedicine.end_date = endDateInput.value || null;

        // Diagnostic logs: browser Console lo date values chupistayi.
        console.log("Selected Start Date:", startDateInput.value);
        console.log("Selected End Date:", endDateInput.value);
        console.log("Dates being sent to backend:", {
            start_date: updatedMedicine.start_date,
            end_date: updatedMedicine.end_date
        });

        if (
            updatedMedicine.end_date &&
            updatedMedicine.end_date < updatedMedicine.start_date
        ) {
            alert("End date cannot be earlier than start date.");
            return;
        }

        if (savingMedicineIds.has(String(medicine.id))) return;

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
            await updateMedicine(medicine.id, updatedMedicine);
        } catch (error) {
            console.error("Update medicine error:", error);
            alert(error.message || "Unable to update medicine.");
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
        }
    });

    card.appendChild(form);
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ========================================
// UPDATE MEDICINE
// ========================================

async function updateMedicine(medicineId, updatedMedicine) {
    const user = getLoggedInUser();

    if (!user || !user.id) {
        throw new Error("Please login again.");
    }

    const id = String(medicineId);

    if (savingMedicineIds.has(id)) return;

    savingMedicineIds.add(id);

    try {
        const response = await fetch(
            `${API_URL}/api/medicines/${medicineId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: user.id,
                    ...updatedMedicine
                })
            }
        );

        await readResponse(response);

        await loadMedicines();
        alert("Medicine updated successfully!");

    } finally {
        savingMedicineIds.delete(id);
    }
}

// ========================================
// DEACTIVATE MEDICINE
// ========================================

async function deactivateMedicine(medicine) {
    const user = getLoggedInUser();

    if (!user || !user.id) {
        alert("Please login again.");
        return;
    }

    const id = String(medicine.id);

    if (deactivatingMedicineIds.has(id)) return;

    const confirmed = confirm(
        `Deactivate ${medicine.medicine_name}?\n\n` +
        "This will hide it from My Medicines. Existing history will be preserved."
    );

    if (!confirmed) return;

    deactivatingMedicineIds.add(id);

    try {
        const response = await fetch(
            `${API_URL}/api/medicines/${medicine.id}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: user.id,
                    status: "Inactive"
                })
            }
        );

        await readResponse(response);

        await loadMedicines();
        alert("Medicine deactivated successfully!");

    } catch (error) {
        console.error("Deactivate medicine error:", error);
        alert(error.message || "Unable to deactivate medicine.");
    } finally {
        deactivatingMedicineIds.delete(id);
    }
}

// ========================================
// START
// ========================================

loadMedicines();