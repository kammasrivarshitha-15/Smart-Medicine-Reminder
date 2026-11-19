
const medicineForm = document.getElementById("medicineForm");

if (medicineForm) {
    medicineForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Get logged-in user
        let user;

        try {
            user = JSON.parse(localStorage.getItem("loggedInUser"));
        } catch (error) {
            user = null;
        }

        if (!user || !user.id) {
            alert("Please login again before adding medicine.");
            window.location.href = "login.html";
            return;
        }

        // Get medicine details
        const medicine = {
            userId: Number(user.id),
            medicineName: document.getElementById("medicineName").value.trim(),
            dosage: document.getElementById("dosage").value.trim(),
            reminderTime: document.getElementById("time").value,
            frequency: document.getElementById("frequency").value,
            foodTiming: document.getElementById("foodTiming").value,
            startDate: document.getElementById("startDate").value,
            endDate: document.getElementById("endDate").value || null,
            notes: document.getElementById("notes").value.trim()
        };

        // Validate dates
        if (medicine.endDate && medicine.endDate < medicine.startDate) {
            alert("End date cannot be before start date.");
            return;
        }

        const saveButton = medicineForm.querySelector('button[type="submit"]');

        try {
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = "Saving...";
            }

            // Send medicine details to backend
            const response = await fetch(
                "http://localhost:5000/api/medicines",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(medicine)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to save medicine.");
            }

            alert("Medicine saved successfully!");

            // Clear form and return to dashboard
            medicineForm.reset();
            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Medicine save error:", error);
            alert(error.message || "Unable to connect to backend.");
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = "💾 Save Medicine";
            }
        }
    });
}
