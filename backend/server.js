require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const webpush = require("web-push");
const cron = require("node-cron");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
});

// Push notification configuration
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Async error handler
function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

// Date validation without timezone conversion
function isValidDateString(value) {
    if (typeof value !== "string") return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
    res.send("Smart Medicine Reminder Backend is Running!");
});

app.get("/api/health", asyncHandler(async (req, res) => {
    await pool.query("SELECT 1");

    res.json({
        success: true,
        message: "Backend and database connected"
    });
}));

// ========================================
// SIGNUP
// ========================================

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Name, email and password are required"
        });
    }

    if (String(password).length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must contain at least 6 characters"
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
    );

    if (existing.rows.length > 0) {
        return res.status(409).json({
            success: false,
            message: "Email already registered"
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [String(name).trim(), normalizedEmail, passwordHash]
    );

    res.status(201).json({
        success: true,
        message: "Signup successful",
        user: result.rows[0]
    });
}));

// ========================================
// LOGIN
// ========================================

app.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const result = await pool.query(
        `SELECT id, name, email, password_hash
         FROM users
         WHERE LOWER(email) = $1`,
        [String(email).trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    res.json({
        success: true,
        message: "Login successful",
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
}));

// ========================================
// GET PROFILE
// ========================================

app.get("/api/profile/:userId", asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT id, name, email, phone, age, address, created_at
         FROM users
         WHERE id = $1`,
        [req.params.userId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    res.json({
        success: true,
        user: result.rows[0]
    });
}));

// ========================================
// UPDATE PROFILE
// ========================================

app.put("/api/profile/:userId", asyncHandler(async (req, res) => {
    const { name, phone, age, address } = req.body;

    if (!name || !String(name).trim()) {
        return res.status(400).json({
            success: false,
            message: "Name is required"
        });
    }

    const result = await pool.query(
        `UPDATE users
         SET name = $1, phone = $2, age = $3, address = $4
         WHERE id = $5
         RETURNING id, name, email, phone, age, address, created_at`,
        [
            String(name).trim(),
            phone || null,
            age === "" || age == null ? null : Number(age),
            address || null,
            req.params.userId
        ]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    res.json({
        success: true,
        message: "Profile updated successfully",
        user: result.rows[0]
    });
}));

// ========================================
// ADD MEDICINE
// End date is optional.
// Same start and end date is allowed.
// Dates are sent as YYYY-MM-DD strings.
// ========================================

app.post("/api/medicines", asyncHandler(async (req, res) => {
    const {
        userId,
        medicineName,
        dosage,
        reminderTime,
        frequency,
        foodTiming,
        startDate,
        endDate,
        notes
    } = req.body;

    if (
        !userId ||
        !String(medicineName || "").trim() ||
        !String(dosage || "").trim() ||
        !reminderTime ||
        !frequency ||
        !foodTiming ||
        !startDate
    ) {
        return res.status(400).json({
            success: false,
            message: "Please fill all required medicine fields"
        });
    }

    if (!isValidDateString(startDate)) {
        return res.status(400).json({
            success: false,
            message: "Invalid start date. Use YYYY-MM-DD format."
        });
    }

    if (endDate && !isValidDateString(endDate)) {
        return res.status(400).json({
            success: false,
            message: "Invalid end date. Use YYYY-MM-DD format."
        });
    }

    if (endDate && endDate < startDate) {
        return res.status(400).json({
            success: false,
            message: "End date cannot be before start date."
        });
    }

    const result = await pool.query(
        `INSERT INTO medicines
         (
             user_id,
             medicine_name,
             dosage,
             reminder_time,
             frequency,
             food_timing,
             start_date,
             end_date,
             notes,
             status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, 'Active')
         RETURNING *`,
        [
            userId,
            String(medicineName).trim(),
            String(dosage).trim(),
            reminderTime,
            frequency,
            foodTiming,
            startDate,
            endDate || null,
            notes || null
        ]
    );

    res.status(201).json({
        success: true,
        message: "Medicine added successfully",
        medicine: result.rows[0]
    });
}));

// ========================================
// GET MEDICINES
// Return dates explicitly as YYYY-MM-DD.
// ========================================

app.get("/api/medicines/:userId", asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT
             id,
             user_id,
             medicine_name,
             dosage,
             reminder_time,
             frequency,
             food_timing,
             TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
             TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
             notes,
             status
         FROM medicines
         WHERE user_id = $1
         ORDER BY reminder_time ASC, id DESC`,
        [req.params.userId]
    );

    res.json({
        success: true,
        medicines: result.rows
    });
}));

// ========================================
// EDIT MEDICINE
// Accept both camelCase and snake_case fields.
// ========================================

app.put("/api/medicines/:medicineId", asyncHandler(async (req, res) => {
    const {
        userId,
        medicineName,
        medicine_name,
        dosage,
        reminderTime,
        reminder_time,
        frequency,
        foodTiming,
        food_timing,
        startDate,
        start_date,
        endDate,
        end_date,
        notes
    } = req.body;

    const finalMedicineName = medicineName ?? medicine_name;
    const finalReminderTime = reminderTime ?? reminder_time;
    const finalFoodTiming = foodTiming ?? food_timing;
    const finalStartDate = startDate ?? start_date;
    const finalEndDate = endDate ?? end_date ?? null;

    if (
        !userId ||
        !String(finalMedicineName || "").trim() ||
        !String(dosage || "").trim() ||
        !finalReminderTime ||
        !frequency ||
        !finalFoodTiming ||
        !finalStartDate
    ) {
        return res.status(400).json({
            success: false,
            message: "Please fill all required medicine fields"
        });
    }

    if (!isValidDateString(finalStartDate)) {
        return res.status(400).json({
            success: false,
            message: "Invalid start date. Use YYYY-MM-DD format."
        });
    }

    if (finalEndDate && !isValidDateString(finalEndDate)) {
        return res.status(400).json({
            success: false,
            message: "Invalid end date. Use YYYY-MM-DD format."
        });
    }

    if (finalEndDate && finalEndDate < finalStartDate) {
        return res.status(400).json({
            success: false,
            message: "End date cannot be before start date."
        });
    }

    console.log("Updating medicine dates:", {
        medicineId: req.params.medicineId,
        start_date: finalStartDate,
        end_date: finalEndDate
    });

    const result = await pool.query(
        `UPDATE medicines
         SET medicine_name = $1,
             dosage = $2,
             reminder_time = $3,
             frequency = $4,
             food_timing = $5,
             start_date = $6::date,
             end_date = $7::date,
             notes = $8
         WHERE id = $9
           AND user_id = $10
           AND status <> 'Inactive'
         RETURNING
             id,
             user_id,
             medicine_name,
             dosage,
             reminder_time,
             frequency,
             food_timing,
             TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
             TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
             notes,
             status`,
        [
            String(finalMedicineName).trim(),
            String(dosage).trim(),
            finalReminderTime,
            frequency,
            finalFoodTiming,
            finalStartDate,
            finalEndDate || null,
            notes || null,
            req.params.medicineId,
            userId
        ]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "Active medicine not found"
        });
    }

    res.json({
        success: true,
        message: "Medicine updated successfully",
        medicine: result.rows[0]
    });
}));

// ========================================
// DEACTIVATE MEDICINE
// ========================================

app.patch(
    "/api/medicines/:medicineId/status",
    asyncHandler(async (req, res) => {
        const { userId, status } = req.body;

        if (!userId || status !== "Inactive") {
            return res.status(400).json({
                success: false,
                message: "Invalid medicine status request"
            });
        }

        const result = await pool.query(
            `UPDATE medicines
             SET status = 'Inactive'
             WHERE id = $1 AND user_id = $2
             RETURNING id, medicine_name, status`,
            [req.params.medicineId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine not found"
            });
        }

        res.json({
            success: true,
            message: "Medicine deactivated successfully",
            medicine: result.rows[0]
        });
    })
);

// ========================================
// GET MEDICINE HISTORY
// ========================================

app.get("/api/history/:userId", asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT
             h.id,
             h.user_id,
             h.medicine_id,
             h.scheduled_time,
             h.status,
             h.recorded_at,
             m.medicine_name,
             m.dosage
         FROM medicine_history h
         LEFT JOIN medicines m ON m.id = h.medicine_id
         WHERE h.user_id = $1
         ORDER BY h.scheduled_time DESC, h.recorded_at DESC
         LIMIT 500`,
        [req.params.userId]
    );

    res.json({
        success: true,
        history: result.rows
    });
}));

// ========================================
// SAVE MEDICINE HISTORY
// Accept scheduledTime and scheduled_time.
// This fixes the Taken/Missed validation error.
// ========================================

app.post("/api/history", asyncHandler(async (req, res) => {
    const {
        userId,
        medicineId,
        scheduledTime,
        scheduled_time,
        status
    } = req.body;

    const finalScheduledTime = scheduledTime || scheduled_time;

    if (
        !userId ||
        !medicineId ||
        !finalScheduledTime ||
        !["Taken", "Missed"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid user, medicine, scheduled time and status are required"
        });
    }

    const medicineResult = await pool.query(
        `SELECT id
         FROM medicines
         WHERE id = $1 AND user_id = $2`,
        [medicineId, userId]
    );

    if (medicineResult.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "Medicine not found for this user"
        });
    }

    const result = await pool.query(
        `INSERT INTO medicine_history
         (user_id, medicine_id, scheduled_time, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, medicineId, finalScheduledTime, status]
    );

    res.status(201).json({
        success: true,
        message: "Medicine history saved",
        history: result.rows[0]
    });
}));

// ========================================
// PUSH NOTIFICATION PUBLIC KEY
// ========================================

app.get("/api/push/public-key", (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        return res.status(500).json({
            success: false,
            message: "Push notifications are not configured"
        });
    }

    res.json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
});

// ========================================
// SAVE PUSH SUBSCRIPTION
// ========================================

app.post("/api/push/subscribe", asyncHandler(async (req, res) => {
    const { userId, subscription } = req.body;

    if (
        !userId ||
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid push subscription and user ID are required"
        });
    }

    const userResult = await pool.query(
        "SELECT id FROM users WHERE id = $1",
        [userId]
    );

    if (userResult.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    const result = await pool.query(
        `INSERT INTO push_subscriptions (user_id, subscription)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id, subscription)
         DO UPDATE SET created_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId, JSON.stringify(subscription)]
    );

    res.status(201).json({
        success: true,
        message: "Push subscription saved",
        subscriptionId: result.rows[0].id
    });
}));

// ========================================
// TEST PUSH NOTIFICATION
// ========================================

app.post("/api/push/test", asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "User ID is required"
        });
    }

    const result = await pool.query(
        `SELECT id, subscription
         FROM push_subscriptions
         WHERE user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: "No push subscription found. Enable notifications first."
        });
    }

    const payload = JSON.stringify({
        title: "Smart Medicine Reminder",
        body: "Test notification successful!",
        url: "/dashboard.html"
    });

    const outcomes = await Promise.allSettled(
        result.rows.map(async row => {
            const subscription =
                typeof row.subscription === "string"
                    ? JSON.parse(row.subscription)
                    : row.subscription;

            try {
                await webpush.sendNotification(subscription, payload);
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await pool.query(
                        "DELETE FROM push_subscriptions WHERE id = $1",
                        [row.id]
                    );
                }

                throw error;
            }
        })
    );

    const sent = outcomes.filter(
        item => item.status === "fulfilled"
    ).length;

    if (sent === 0) {
        return res.status(502).json({
            success: false,
            message: "Notification could not be delivered"
        });
    }

    res.json({
        success: true,
        message: "Test notification sent",
        sent
    });
}));

// ========================================
// AUTOMATIC MEDICINE REMINDERS
// Runs every minute.
// ========================================

cron.schedule("* * * * *", async () => {
    try {
        const result = await pool.query(
            `SELECT
                 m.id AS medicine_id,
                 m.user_id,
                 m.medicine_name,
                 m.dosage,
                 m.reminder_time,
                 s.id AS subscription_id,
                 s.subscription
             FROM medicines m
             JOIN push_subscriptions s ON s.user_id = m.user_id
             WHERE m.status = 'Active'
               AND m.start_date <= CURRENT_DATE
               AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
               AND TO_CHAR(m.reminder_time, 'HH24:MI') =
                   TO_CHAR(CURRENT_TIMESTAMP, 'HH24:MI')`
        );

        for (const row of result.rows) {
            const payload = JSON.stringify({
                title: "Medicine Reminder",
                body: `Time to take ${row.medicine_name} (${row.dosage})`,
                url: "/dashboard.html"
            });

            try {
                const subscription =
                    typeof row.subscription === "string"
                        ? JSON.parse(row.subscription)
                        : row.subscription;

                await webpush.sendNotification(subscription, payload);
            } catch (error) {
                console.error(
                    "Push notification failed:",
                    error.message
                );

                if (error.statusCode === 404 || error.statusCode === 410) {
                    await pool.query(
                        "DELETE FROM push_subscriptions WHERE id = $1",
                        [row.subscription_id]
                    );
                }
            }
        }
    } catch (error) {
        console.error("Reminder scheduler error:", error.message);
    }
});

// ========================================
// ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
    console.error("API error:", err);

    if (err.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "This record already exists"
        });
    }

    if (err.code === "23503") {
        return res.status(400).json({
            success: false,
            message: "Related user or medicine was not found"
        });
    }

    res.status(500).json({
        success: false,
        message: "Server error. Check the backend terminal."
    });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
    console.log(
        `Smart Medicine Reminder backend running at http://localhost:${PORT}`
    );
});