const express = require("express");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "supersecretkey"; // change to a strong secret
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const db = mysql.createPool({
    host: "localhost",
    user: "root",          // XAMPP default
    password: "",          // empty password
    database: "academic_resources_system",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
        process.exit(1);
    }
    console.log("✅ Connected to MySQL database.");
    connection.release();
});

// Multer setup
const upload = multer({ dest: "uploads/" });

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Page routes
app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// =======================
// Registration
// =======================
app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [results] = await db.promise().query("SELECT * FROM students WHERE email = ?", [email]);
        if (results.length > 0) {
            return res.status(400).json({ message: "Email already in use." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.promise().query(
            "INSERT INTO students (name, email, password) VALUES (?, ?, ?)",
            [name, email, hashedPassword]
        );
        res.json({ message: "Registration successful! Please login." });
    } catch (err) {
        console.error("❌ Registration error:", err);
        res.status(500).json({ message: "Registration failed." });
    }
});

// =======================
// Login
// =======================
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await db.promise().query("SELECT * FROM students WHERE email = ?", [email]);
        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            res.json({ message: "Login successful!", student_id: results[0].id });
        } else {
            res.status(401).json({ message: "Invalid email or password." });
        }
    } catch (err) {
        console.error("Error logging in:", err.message);
        res.status(500).json({ message: "Login failed." });
    }
});

// =======================
// Upload Notes
// =======================
app.post("/upload", upload.single("file"), async (req, res) => {
    const { title } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded." });

    try {
        const student_id = 1; // hardcoded for now
        await db.promise().query(
            "INSERT INTO resources (student_id, title, filename, original_name) VALUES (?, ?, ?, ?)",
            [student_id, title, file.filename, file.originalname]
        );
        res.json({ message: "File uploaded successfully!" });
    } catch (err) {
        console.error("Error saving resource:", err.message);
        res.status(500).json({ message: "Upload failed." });
    }
});

// =======================
// Search Resources
// =======================
app.get("/search", async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ message: "Search query is required." });

    try {
        const [results] = await db.promise().query(
            "SELECT * FROM resources WHERE title LIKE ? OR original_name LIKE ?",
            [`%${query}%`, `%${query}%`]
        );
        res.json(results);
    } catch (err) {
        console.error("Error searching resources:", err.message);
        res.status(500).json({ message: "Search failed." });
    }
});

// =======================
// Download Resources
// =======================
app.get("/download/:id", async (req, res) => {
    const resourceId = req.params.id;
    try {
        const [results] = await db.promise().query("SELECT * FROM resources WHERE id = ?", [resourceId]);
        if (results.length === 0) return res.status(404).json({ message: "File not found." });

        const file = results[0];
        const filePath = path.join(__dirname, "uploads", file.filename);
        res.download(filePath, file.original_name);
    } catch (err) {
        console.error("Error downloading file:", err.message);
        res.status(500).json({ message: "Download failed." });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
