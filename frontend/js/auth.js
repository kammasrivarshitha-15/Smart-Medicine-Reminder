
// Get the login form
const loginForm = document.getElementById("loginForm");

// Check whether the login form exists
if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Get email and password
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        // Validate input
        if (!email || !password) {
            alert("Please enter email and password.");
            return;
        }

        // Find the submit button
        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Signing in...";
            }

            // Send login details to the backend
            const response = await fetch(
                "http://localhost:5000/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const data = await response.json();

            // Handle login errors
            if (!response.ok || !data.success) {
                alert(data.message || "Login failed. Please try again.");
                return;
            }

            // Save the logged-in user's details
            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(data.user)
            );

            // Login successful
            alert("Login successful!");

            // Open dashboard
            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Login error:", error);

            alert(
                "Backend connection failed. Please check whether the server is running."
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Sign In";
            }
        }
    });
}
