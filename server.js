const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// Session setup
app.use(session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Database connection pool
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "academic_resources_system",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
    console.log("✅ Connected to MySQL database.");
    connection.release();
});

// File upload setup
const upload = multer({ dest: "uploads/" });

// Middleware to protect routes
function requireLogin(req, res, next) {
    if (!req.session.student_id) {
        return res.redirect("/login");
    }
    next();
}

// Routes
app.get("/", (req, res) => {
    if (req.session.student_id) {
        res.redirect("/dashboard");
    } else {
        res.redirect("/login");
    }
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// Register route
app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    console.log("Register attempt:", { name, email, password }); // Debug log
    try {
        if (!password) {
            return res.status(400).json({ message: "Password is required." });
        }
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
        console.error("Registration error:", err);
        res.status(500).json({ message: "Registration failed." });
    }
});

// Login route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await db.promise().query("SELECT * FROM students WHERE email = ?", [email]);
        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            req.session.student_id = results[0].id;
            res.json({ message: "Login successful!" });
        } else {
            res.status(401).json({ message: "Invalid email or password." });
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Login failed." });
    }
});

// Upload Notes
app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
    const { title } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded." });

    try {
        await db.promise().query(
            "INSERT INTO resources (student_id, title, filename, original_name) VALUES (?, ?, ?, ?)",
            [req.session.student_id, title, file.filename, file.originalname]
        );
        res.json({ message: "File uploaded successfully!" });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: "Upload failed." });
    }
});

// Search resources
app.get("/search", requireLogin, async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ message: "Search query is required." });

    try {
        const [results] = await db.promise().query(
            "SELECT * FROM resources WHERE title LIKE ? OR original_name LIKE ?",
            [`%${query}%`, `%${query}%`]
        );
        res.json(results);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ message: "Search failed." });
    }
});

// Download resources
app.get("/download/:id", requireLogin, async (req, res) => {
    const resourceId = req.params.id;
    try {
        const [results] = await db.promise().query("SELECT * FROM resources WHERE id = ?", [resourceId]);
        if (results.length === 0) return res.status(404).json({ message: "File not found." });

        const file = results[0];
        const filePath = path.join(__dirname, "uploads", file.filename);
        res.download(filePath, file.original_name);
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: "Download failed." });
    }
});

// Stats route for dashboard
app.get("/stats", async (req, res) => {
    try {
        const [students] = await db.promise().query("SELECT COUNT(*) AS totalStudents FROM students");
        const [resources] = await db.promise().query("SELECT COUNT(*) AS totalResources FROM resources");
        res.json({
            totalStudents: students[0].totalStudents,
            totalResources: resources[0].totalResources
        });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ message: "Failed to load stats" });
    }
});

// Test DB connection
app.get("/testdb", async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT 1 + 1 AS result");
        res.json({ message: "DB connected", result: rows[0].result });
    } catch (err) {
        console.error("DB connection failed:", err);
        res.status(500).json({ message: "DB connection failed", error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
