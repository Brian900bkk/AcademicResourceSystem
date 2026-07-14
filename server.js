
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");
const multer = require("multer");
const bcrypt = require("bcrypt");


const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));


const db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "academic_resources_system",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
    console.log("Connected to MySQL database");
    connection.release();
});

// =======================
// File upload setup
// =======================
const upload = multer({ dest: "uploads/" });

// =======================
// Auth middleware
// =======================
function requireLogin(req, res, next) {
    if (!req.session.student_id) {
        return res.redirect("/login");
    }
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.session.role === role) {
            next();
        } else {
            res.status(403).json({ message: "Access denied" });
        }
    };
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

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
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
// REGISTER (with invitation code check)
// =======================
app.post("/register", async (req, res) => {
    const { name, email, password, role, invitationCode } = req.body;

    try {
        // Check if email already exists
        const [existing] = await db.promise().query("SELECT * FROM students WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Require invitation code for manager or super_admin
        if (role === "manager" || role === "super_admin") {
            if (!invitationCode) {
                return res.status(403).json({ message: "Invitation code required for this role" });
            }

            const [codes] = await db.promise().query(
                "SELECT * FROM invitation_codes WHERE code = ? AND role = ? AND status = 'unused'",
                [invitationCode, role]
            );

            if (codes.length === 0) {
                return res.status(403).json({ message: "Invalid or expired invitation code" });
            }

            // Mark code as used
            await db.promise().query("UPDATE invitation_codes SET status = 'used' WHERE code = ?", [invitationCode]);
        }

        // Hash password and insert user
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.promise().query(
            "INSERT INTO students (name, email, password, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, role || "student"]
        );

        res.json({ message: "Registration successful" });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// =======================
// LOGIN
// =======================
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.promise().query(
            "SELECT * FROM students WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = users[0];

        // Debug logs
        console.log("Login attempt:", email, password);
        console.log("Stored hash:", user.password);

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        req.session.student_id = user.id;
        req.session.role = user.role;

        res.json({
            message: "Login successful",
            role: user.role
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// =======================
// UPLOAD
// =======================
app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
    const { title } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    try {
        await db.promise().query(
            "INSERT INTO resources (student_id, title, filename, original_name) VALUES (?, ?, ?, ?)",
            [req.session.student_id, title, req.file.filename, req.file.originalname]
        );

        res.json({ message: "Upload successful" });

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: "Upload failed" });
    }
});

// =======================
// SEARCH
// =======================
app.get("/search", requireLogin, async (req, res) => {
    const q = req.query.query;

    try {
        const [results] = await db.promise().query(
            "SELECT * FROM resources WHERE title LIKE ? OR original_name LIKE ?",
            [`%${q}%`, `%${q}%`]
        );

        res.json(results);

    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ message: "Search failed" });
    }
});

// =======================
// DOWNLOAD
// =======================
app.get("/download/:id", requireLogin, async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            "SELECT * FROM resources WHERE id = ?",
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "File not found" });
        }

        const file = rows[0];
        const filePath = path.join(__dirname, "uploads", file.filename);

        res.download(filePath, file.original_name || file.filename);

    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ message: "Download failed" });
    }
});

// =======================
// STATS
// =======================
app.get("/stats", requireLogin, async (req, res) => {
    try {
        const [students] = await db.promise().query(
            "SELECT COUNT(*) AS totalStudents FROM students"
        );

        const [resources] = await db.promise().query(
            "SELECT COUNT(*) AS totalResources FROM resources"
        );

        res.json({
            totalStudents: students[0].totalStudents,
            totalResources: resources[0].totalResources
        });

    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ message: "Failed to load stats" });
    }
});

// =======================
// DASHBOARDS
// =======================
app.get("/admin-dashboard", requireLogin, requireRole("super_admin"), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/manager-dashboard", requireLogin, requireRole("manager"), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "manager.html"));
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});
// =======================
// MANAGER ROUTES
// =======================

// Get all pending uploads (unapproved resources)
app.get("/pending-uploads", requireLogin, requireRole("manager"), async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            "SELECT * FROM resources WHERE approved = 0"
        );
        res.json(rows);
    } catch (err) {
        console.error("Pending uploads error:", err);
        res.status(500).json({ message: "Failed to load pending uploads" });
    }
});

// Approve a resource
app.post("/approve-upload/:id", requireLogin, requireRole("manager"), async (req, res) => {
    try {
        await db.promise().query(
            "UPDATE resources SET approved = 1 WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: "Upload approved successfully" });
    } catch (err) {
        console.error("Approve upload error:", err);
        res.status(500).json({ message: "Failed to approve upload" });
    }
});

// Get all resources
app.get("/resources", requireLogin, requireRole("manager"), async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            "SELECT * FROM resources"
        );
        res.json(rows);
    } catch (err) {
        console.error("Resources fetch error:", err);
        res.status(500).json({ message: "Failed to load resources" });
    }
});

// Delete a resource
app.delete("/delete-resource/:id", requireLogin, requireRole("manager"), async (req, res) => {
    try {
        await db.promise().query(
            "DELETE FROM resources WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: "Resource deleted successfully" });
    } catch (err) {
        console.error("Delete resource error:", err);
        res.status(500).json({ message: "Failed to delete resource" });
    }
    // =======================
// Update a resource (Manager only)
// =======================
app.put("/update-resource/:id", requireLogin, requireRole("manager"), async (req, res) => {
    const { title } = req.body;
    try {
        await db.promise().query(
            "UPDATE resources SET title = ? WHERE id = ?",
            [title, req.params.id]
        );
        res.json({ message: "Resource updated successfully" });
    } catch (err) {
        console.error("Update resource error:", err);
        res.status(500).json({ message: "Failed to update resource" });
    }
});

});
app.post("/create-user", requireRole("super_admin"), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (role !== "manager" && role !== "super_admin") {
        return res.status(400).json({ message: "Invalid role" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.promise().query(
        "INSERT INTO students (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, role]
    );
    res.json({ message: "User created successfully" });
});
// =======================
// Update a resource (Manager only)
// =======================
app.put("/update-resource/:id", requireLogin, requireRole("manager"), upload.single("file"), async (req, res) => {
    const { title, description } = req.body;
    const file = req.file;

    try {
        if (file) {
            // Update with new file
            await db.promise().query(
                "UPDATE resources SET title = ?, description = ?, filename = ?, original_name = ? WHERE id = ?",
                [title, description, file.filename, file.originalname, req.params.id]
            );
        } else {
            // Update only text fields
            await db.promise().query(
                "UPDATE resources SET title = ?, description = ? WHERE id = ?",
                [title, description, req.params.id]
            );
        }

        res.json({ message: "Resource updated successfully" });
    } catch (err) {
        console.error("Update resource error:", err);
        res.status(500).json({ message: "Failed to update resource" });
    }
});
// =======================
// Get all uploaded resources (Manager only)
// =======================
app.get("/resources", requireLogin, requireRole("manager"), async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT * FROM resources");
        res.json(rows);
    } catch (err) {
        console.error("Resources fetch error:", err);
        res.status(500).json({ message: "Failed to load resources" });
    }
});
// =======================
// Get resources with filter (Manager only)
// =======================
app.get("/resources", requireLogin, requireRole("manager"), async (req, res) => {
    const { status } = req.query; // "pending", "approved", or undefined

    let sql = "SELECT * FROM resources";
    let params = [];

    if (status === "pending") {
        sql += " WHERE approved = 0";
    } else if (status === "approved") {
        sql += " WHERE approved = 1";
    }

    try {
        const [rows] = await db.promise().query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Resources fetch error:", err);
        res.status(500).json({ message: "Failed to load resources" });
    }
});
// =======================
// Get resources with filter + search (Manager only)
// =======================
app.get("/resources", requireLogin, requireRole("manager"), async (req, res) => {
    const { status, q } = req.query; // status = "pending"/"approved"/undefined, q = search keyword

    let sql = "SELECT * FROM resources WHERE 1=1";
    let params = [];

    if (status === "pending") {
        sql += " AND approved = 0";
    } else if (status === "approved") {
        sql += " AND approved = 1";
    }

    if (q) {
        sql += " AND (title LIKE ? OR description LIKE ? OR original_name LIKE ?)";
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    try {
        const [rows] = await db.promise().query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Resources fetch error:", err);
        res.status(500).json({ message: "Failed to load resources" });
    }
});
// =======================
// Generate new invitation code (Admin only)
// =======================
app.post("/generate-code", requireLogin, requireRole("super_admin"), async (req, res) => {
    const code = "INV-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        await db.promise().query(
            "INSERT INTO invitation_codes (code, role, status) VALUES (?, 'manager', 'unused')",
            [code]
        );
        res.json({ message: "Code generated successfully", code });
    } catch (err) {
        console.error("Generate code error:", err);
        res.status(500).json({ message: "Failed to generate code" });
    }
});
app.get("/invitation-codes", requireLogin, requireRole("super_admin"), async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT * FROM invitation_codes");
        res.json(rows);
    } catch (err) {
        console.error("List codes error:", err);
        res.status(500).json({ message: "Failed to fetch codes" });
    }
});


// =======================
// List all codes (Admin only)
// =======================
app.get("/invitation-codes", requireLogin, requireRole("super_admin"), async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT * FROM invitation_codes");
        res.json(rows);
    } catch (err) {
        console.error("List codes error:", err);
        res.status(500).json({ message: "Failed to fetch codes" });
    }
});

// =======================
// Revoke a code (Admin only)
// =======================
app.delete("/invitation-codes/:id", requireLogin, requireRole("super_admin"), async (req, res) => {
    try {
        await db.promise().query("DELETE FROM invitation_codes WHERE id = ?", [req.params.id]);
        res.json({ message: "Code revoked successfully" });
    } catch (err) {
        console.error("Revoke code error:", err);
        res.status(500).json({ message: "Failed to revoke code" });
    }
});
