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
    secret: "supersecretkey",   // change to something secure
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }   // true if HTTPS
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: "localhost",
    user: "root",          // update if you set a password
    password: "",          // set your MySQL root password here
    database: "academic_resources_system",
    port: 3306,            // default MySQL port
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ✅ Test connection once at startup
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

// =======================
// Middleware to protect routes
// =======================
function requireLogin(req, res, next) {
    if (!req.session.student_id) {
        return res.redirect("/login");
    }
    next();
}

// =======================
// Routes
// =======================
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
            req.session.student_id = results[0].id;  // ✅ save session
            res.json({ message: "Login successful!" });
        } else {
            res.status(401).json({ message: "Invalid email or password." });
        }
    } catch (err) {
        res.status(500).json({ message: "Login failed." });
    }
});

// =======================
// Upload Notes (protected)
// =======================
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
        res.status(500).json({ message: "Upload failed." });
    }
});

// =======================
// Search Resources (protected)
// =======================
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
        res.status(500).json({ message: "Search failed." });
    }
});

// =======================
// Download Resources (protected)
// =======================
app.get("/download/:id", requireLogin, async (req, res) => {
    const resourceId = req.params.id;
    try {
        const [results] = await db.promise().query("SELECT * FROM resources WHERE id = ?", [resourceId]);
        if (results.length === 0) return res.status(404).json({ message: "File not found." });

        const file = results[0];
        const filePath = path.join(__dirname, "uploads", file.filename);
        res.download(filePath, file.original_name);
    } catch (err) {
        res.status(500).json({ message: "Download failed." });
    }
});
app.get("/testdb", async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT 1 + 1 AS result");
        res.json({ message: "✅ DB connected", result: rows[0].result });
    } catch (err) {
        res.status(500).json({ message: "❌ DB connection failed", error: err.message });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
app.get("/testdb", async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT 1 + 1 AS result");
        res.json({ message: "✅ DB connected", result: rows[0].result });
    } catch (err) {
        res.status(500).json({ message: "❌ DB connection failed", error: err.message });
    }
});
