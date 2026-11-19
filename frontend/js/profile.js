
// ========================================
// PROFILE PAGE
// ========================================

const profileForm = document.getElementById("profileForm");
const cancelBtn = document.getElementById("cancelBtn");
const logoutBtn = document.getElementById("logoutBtn");

let originalUser = {};

// ========================================
// GET LOGGED-IN USER
// ========================================

function getLoggedInUser() {
    try {
        return JSON.parse(
            localStorage.getItem("loggedInUser")
        ) || {};
    } catch (error) {
        console.error("Unable to read user details:", error);
        return {};
    }
}

// ========================================
// LOAD PROFILE FROM DATABASE
// ========================================

async function loadProfile() {
    const loggedInUser = getLoggedInUser();

    if (!loggedInUser.id) {
        alert("User details not found. Please sign in again.");
        return;
    }

    try {
        const response = await fetch(
            `http://localhost:5000/api/profile/${loggedInUser.id}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load profile.");
        }

        originalUser = data.user;

        // Update browser storage
        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(data.user)
        );

        localStorage.setItem(
            "medicineReminderUser",
            JSON.stringify(data.user)
        );

        displayProfile(data.user);

    } catch (error) {
        console.error("Profile loading error:", error);
        alert(
            "Profile load avvaledu. Backend server and database check cheyyi."
        );
    }
}

// ========================================
// DISPLAY PROFILE
// ========================================

function displayProfile(user) {
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const ageInput = document.getElementById("age");
    const addressInput = document.getElementById("address");

    if (nameInput) nameInput.value = user.name || "";
    if (emailInput) emailInput.value = user.email || "";
    if (phoneInput) phoneInput.value = user.phone || "";
    if (ageInput) ageInput.value = user.age || "";
    if (addressInput) addressInput.value = user.address || "";

    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profileAvatar = document.getElementById("profileAvatar");

    if (profileName) {
        profileName.textContent = user.name || "User";
    }

    if (profileEmail) {
        profileEmail.textContent = user.email || "";
    }

    if (profileAvatar) {
        profileAvatar.textContent = user.name
            ? user.name.charAt(0).toUpperCase()
            : "U";
    }
}

// ========================================
// SAVE PROFILE TO DATABASE
// ========================================

if (profileForm) {
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const loggedInUser = getLoggedInUser();

        if (!loggedInUser.id) {
            alert("Please sign in again.");
            return;
        }

        const updatedUser = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            age: document.getElementById("age").value.trim(),
            address: document.getElementById("address").value.trim()
        };

        if (!updatedUser.name || !updatedUser.email) {
            alert("Name and email are required.");
            return;
        }

        const saveButton = profileForm.querySelector(
            'button[type="submit"]'
        );

        if (saveButton) {
            saveButton.disabled = true;
        }

        try {
            const response = await fetch(
                `http://localhost:5000/api/profile/${loggedInUser.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(updatedUser)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Unable to save profile.");
            }

            originalUser = data.user;

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(data.user)
            );

            localStorage.setItem(
                "medicineReminderUser",
                JSON.stringify(data.user)
            );

            displayProfile(data.user);

            alert("Profile updated successfully!");

        } catch (error) {
            console.error("Profile save error:", error);
            alert(error.message || "Unable to save profile.");
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
            }
        }
    });
}

// ========================================
// CANCEL CHANGES
// ========================================

if (cancelBtn) {
    cancelBtn.addEventListener("click", function (event) {
        event.preventDefault();
        displayProfile(originalUser);
    });
}

// ========================================
// LOGOUT
// ========================================

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        const confirmLogout = confirm(
            "Are you sure you want to logout?"
        );

        if (confirmLogout) {
            localStorage.removeItem("loggedInUser");
            localStorage.removeItem("medicineReminderUser");
            window.location.href = "index.html";
        }
    });
}

// ========================================
// INITIAL LOAD
// ========================================

loadProfile();