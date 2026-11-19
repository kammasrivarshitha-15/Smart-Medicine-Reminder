
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err.message);
});

async function testConnection() {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database, NOW() AS server_time"
        );

        console.log("PostgreSQL connected successfully!");
        console.log("Database:", result.rows[0].database);
    } catch (error) {
        console.error("PostgreSQL connection failed:", error.message);
    }
}

testConnection();

module.exports = pool;
