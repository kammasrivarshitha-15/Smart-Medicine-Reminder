
const pool = require("./db");

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS medicines (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                medicine_name VARCHAR(150) NOT NULL,
                dosage VARCHAR(100) NOT NULL,
                reminder_time TIME NOT NULL,
                frequency VARCHAR(50) NOT NULL,
                food_timing VARCHAR(50),
                start_date DATE NOT NULL,
                end_date DATE,
                notes TEXT,
                status VARCHAR(20) DEFAULT 'Upcoming',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS medicine_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                medicine_id INTEGER REFERENCES medicines(id) ON DELETE SET NULL,
                scheduled_time TIMESTAMPTZ NOT NULL,
                status VARCHAR(20) NOT NULL
                    CHECK (status IN ('Taken', 'Missed')),
                recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("All database tables created successfully!");
    } catch (error) {
        console.error("Table creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

initializeDatabase();
