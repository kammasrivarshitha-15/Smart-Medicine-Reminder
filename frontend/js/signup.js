
const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Get form values
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;

    // Validate fields
    if (!name || !email || !password || !confirmPassword) {
        alert("Please fill in all fields.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        return;
    }

    // Disable button while submitting
    const submitButton = signupForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Creating Account...";

    try {
        // Send signup details to the backend
        const response = await fetch(
            "http://localhost:5000/api/auth/signup",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Unable to create account.");
            return;
        }

        alert("Account created successfully! Please login.");

        window.location.href = "login.html";

    } catch (error) {
        console.error("Signup error:", error);

        alert(
            "Cannot connect to the backend. Please make sure the server is running."
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Create Account";
    }
});
