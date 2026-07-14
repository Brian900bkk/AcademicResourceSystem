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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
    session({
        secret: "academic_resource_secret_key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false
        }
    })
);



const db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "academic_resource_system_v2",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {

    if (err) {
        console.log("Database connection failed");
        console.log(err);
        process.exit(1);
    }

    console.log("================================");
    console.log(" Connected to MySQL Database");
    console.log(" Database : academic_resource_system_v2");
    console.log(" Server running on Port:", PORT);
    console.log("================================");

    connection.release();

});

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, "uploads/");

    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});

const upload = multer({
    storage: storage
});
function requireLogin(req, res, next) {

    if (!req.session.user_id) {

        return res.status(401).json({
            message: "Please login first"
        });

    }

    next();

}

function requireRole(role) {

    return (req, res, next) => {

        if (!req.session.user_id) {

            return res.status(401).json({
                message: "Please login"
            });

        }

        if (req.session.role !== role) {

            return res.status(403).json({
                message: "Access denied"
            });

        }

        next();

    };

}

app.get("/", (req, res) => {

    res.redirect("/login");

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

app.get("/manager-dashboard", requireLogin, requireRole("manager"), (req, res) => {

    res.sendFile(path.join(__dirname, "public", "manager.html"));

});

app.get("/admin-dashboard", requireLogin, requireRole("super_admin"), (req, res) => {

    res.sendFile(path.join(__dirname, "public", "admin.html"));

});

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/login");

    });

});
// =======================
// REGISTER
// =======================

app.post("/register", async (req, res) => {

    const {
        name,
        email,
        password,
        role,
        invitationCode
    } = req.body;

    try {

        const [existing] = await db.promise().query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {

            return res.status(400).json({
                message: "Email already exists"
            });

        }

        let userRole = role || "student";

        // Invitation code required for manager and super admin

        if (userRole === "manager" || userRole === "super_admin") {

            if (!invitationCode) {

                return res.status(403).json({
                    message: "Invitation code required"
                });

            }

            const [codes] = await db.promise().query(
                `SELECT * FROM invitation_codes
                 WHERE code = ?
                 AND role = ?
                 AND status = 'unused'`,
                [invitationCode, userRole]
            );

            if (codes.length === 0) {

                return res.status(403).json({
                    message: "Invalid invitation code"
                });

            }

            await db.promise().query(
                "UPDATE invitation_codes SET status='used' WHERE id=?",
                [codes[0].id]
            );

        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.promise().query(

            `INSERT INTO users
            (name,email,password,role)
            VALUES (?,?,?,?)`,

            [
                name,
                email,
                hashedPassword,
                userRole
            ]

        );

        res.json({

            message: "Registration successful"

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Server Error"

        });

    }

});

// =======================
// LOGIN
// =======================
app.post("/login", async (req, res) => {

    const { email, password } = req.body;

    try {

        const [users] = await db.promise().query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {

            console.log("❌ User not found:", email);

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        const user = users[0];

        console.log("====================================");
        console.log("LOGIN ATTEMPT");
        console.log("Email entered:", email);
        console.log("Password entered:", password);
        console.log("User found:", user.email);
        console.log("Stored hash:", user.password);

        const match = await bcrypt.compare(password, user.password);

        console.log("Password Match:", match);
        console.log("====================================");

        if (!match) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }

        req.session.user_id = user.id;
        req.session.role = user.role;
        req.session.name = user.name;

        res.json({
            message: "Login successful",
            role: user.role,
            name: user.name
        });

    } catch (err) {

        console.error("Login Error:", err);

        res.status(500).json({
            message: "Server Error"
        });

    }

});
// =======================
// CURRENT USER
// =======================

app.get("/me", requireLogin, async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT
                id,
                name,
                email,
                role,
                created_at
             FROM users
             WHERE id=?`,

            [req.session.user_id]

        );

        res.json(rows[0]);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Server Error"

        });

    }

});

// =======================
// SYSTEM STATS
// =======================

app.get("/stats", requireLogin, async (req, res) => {

    try {

        const [users] = await db.promise().query(

            "SELECT COUNT(*) totalUsers FROM users"

        );

        const [resources] = await db.promise().query(

            "SELECT COUNT(*) totalResources FROM resources"

        );

        res.json({

            totalStudents: users[0].totalUsers,

            totalResources: resources[0].totalResources

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Unable to load statistics"

        });

    }

});

// =======================
// UPLOAD RESOURCE
// =======================

app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({
                message: "Please select a file."
            });

        }

        const { title } = req.body;

        await db.promise().query(

            `INSERT INTO resources
            (user_id,title,filename,original_name,approved)
            VALUES(?,?,?,?,0)`,

            [
                req.session.user_id,
                title,
                req.file.filename,
                req.file.originalname
            ]

        );

        res.json({

            message: "Resource uploaded successfully. Waiting for manager approval."

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Upload failed."

        });

    }

});


app.get("/search", requireLogin, async (req, res) => {

    try {

        const keyword = req.query.query || "";

        const [rows] = await db.promise().query(

            `SELECT
                id,
                title,
                original_name,
                uploaded_at
             FROM resources
             WHERE approved = 1
             AND
             (
                title LIKE ?
                OR
                original_name LIKE ?
             )
             ORDER BY uploaded_at DESC`,

            [
                `%${keyword}%`,
                `%${keyword}%`
            ]

        );

        res.json(rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Search failed"

        });

    }

});


app.get("/download/:id", requireLogin, async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            "SELECT * FROM resources WHERE id=? AND approved=1",

            [req.params.id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                message: "File not found"

            });

        }

        const file = rows[0];

        await db.promise().query(

            `INSERT INTO downloads
            (resource_id,user_id)
            VALUES(?,?)`,

            [
                file.id,
                req.session.user_id
            ]

        );

        const filePath = path.join(

            __dirname,
            "uploads",
            file.filename

        );

        res.download(

            filePath,

            file.original_name

        );

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Download failed"

        });

    }

});



app.get("/resources", requireLogin, async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT
                resources.*,
                users.name
             FROM resources
             JOIN users
             ON users.id = resources.user_id
             ORDER BY uploaded_at DESC`

        );

        res.json(rows);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Unable to load resources"

        });

    }

});


app.delete("/delete-resource/:id", requireLogin, async (req, res) => {

    try {

        await db.promise().query(

            "DELETE FROM resources WHERE id=?",

            [req.params.id]

        );

        res.json({

            message: "Resource deleted successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Delete failed"

        });

    }

});


app.put("/update-resource/:id", requireLogin, upload.single("file"), async (req, res) => {

    try {

        const { title, description } = req.body;

        if (req.file) {

            await db.promise().query(

                `UPDATE resources
                 SET
                 title=?,
                 description=?,
                 filename=?,
                 original_name=?
                 WHERE id=?`,

                [
                    title,
                    description,
                    req.file.filename,
                    req.file.originalname,
                    req.params.id
                ]

            );

        } else {

            await db.promise().query(

                `UPDATE resources
                 SET
                 title=?,
                 description=?
                 WHERE id=?`,

                [
                    title,
                    description,
                    req.params.id
                ]

            );

        }

        res.json({

            message: "Resource updated successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Update failed."

        });

    }

});

app.get("/pending-uploads", requireLogin, requireRole("manager"), async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT
                resources.*,
                users.name
             FROM resources
             JOIN users
             ON users.id = resources.user_id
             WHERE approved = 0
             ORDER BY uploaded_at DESC`

        );

        res.json(rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to load pending uploads."
        });

    }

});


app.post("/approve-upload/:id", requireLogin, requireRole("manager"), async (req, res) => {

    try {

        await db.promise().query(

            "UPDATE resources SET approved=1 WHERE id=?",

            [req.params.id]

        );

        res.json({

            message: "Resource approved successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Approval failed."

        });

    }

});

app.get("/resources/filter", requireLogin, requireRole("manager"), async (req, res) => {

    try {

        const status = req.query.status;
        const search = req.query.q || "";

        let sql =
            `SELECT resources.*, users.name
             FROM resources
             JOIN users
             ON users.id=resources.user_id
             WHERE title LIKE ?`;

        const params = [`%${search}%`];

        if (status === "approved") {

            sql += " AND approved=1";

        }

        if (status === "pending") {

            sql += " AND approved=0";

        }

        sql += " ORDER BY uploaded_at DESC";

        const [rows] = await db.promise().query(sql, params);

        res.json(rows);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Unable to filter resources."

        });

    }

});


app.get("/manager-stats", requireLogin, requireRole("manager"), async (req, res) => {

    try {

        const [pending] = await db.promise().query(

            "SELECT COUNT(*) total FROM resources WHERE approved=0"

        );

        const [approved] = await db.promise().query(

            "SELECT COUNT(*) total FROM resources WHERE approved=1"

        );

        const [users] = await db.promise().query(

            "SELECT COUNT(*) total FROM users"

        );

        res.json({

            pending: pending[0].total,

            approved: approved[0].total,

            users: users[0].total

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Unable to load manager statistics."

        });

    }

});


app.delete("/manager/delete-resource/:id", requireLogin, requireRole("manager"), async (req, res) => {

    try {

        await db.promise().query(

            "DELETE FROM resources WHERE id=?",

            [req.params.id]

        );

        res.json({

            message: "Resource deleted successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            message: "Delete failed."

        });

    }

});


app.get("/users", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT
                id,
                name,
                email,
                role,
                created_at
            FROM users
            ORDER BY created_at DESC`

        );

        res.json(rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to load users."
        });

    }

});


app.post("/create-user", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        const { name, email, password, role } = req.body;

        const [existing] = await db.promise().query(

            "SELECT id FROM users WHERE email=?",

            [email]

        );

        if (existing.length > 0) {

            return res.status(400).json({
                message: "Email already exists."
            });

        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.promise().query(

            `INSERT INTO users
            (name,email,password,role)
            VALUES(?,?,?,?)`,

            [
                name,
                email,
                hashedPassword,
                role
            ]

        );

        res.json({
            message: "User created successfully."
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to create user."
        });

    }

});


app.delete("/delete-user/:id", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        if (Number(req.params.id) === req.session.user_id) {

            return res.status(400).json({
                message: "You cannot delete your own account."
            });

        }

        await db.promise().query(

            "DELETE FROM users WHERE id=?",

            [req.params.id]

        );

        res.json({
            message: "User deleted successfully."
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Delete failed."
        });

    }

});

app.post("/generate-code", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        const role = req.body.role || "manager";

        const code =
            Math.random().toString(36).substring(2, 8).toUpperCase() +
            "-" +
            Date.now().toString().slice(-4);

        await db.promise().query(

            `INSERT INTO invitation_codes
            (code,role,status)
            VALUES(?,?,?)`,

            [
                code,
                role,
                "unused"
            ]

        );

        res.json({
            code
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to generate code."
        });

    }

});


app.get("/invitation-codes", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        const [rows] = await db.promise().query(

            `SELECT *
            FROM invitation_codes
            ORDER BY created_at DESC`

        );

        res.json(rows);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to load invitation codes."
        });

    }

});


app.delete("/invitation-codes/:id", requireLogin, requireRole("super_admin"), async (req, res) => {

    try {

        await db.promise().query(

            "DELETE FROM invitation_codes WHERE id=?",

            [req.params.id]

        );

        res.json({
            message: "Invitation code deleted."
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Unable to delete invitation code."
        });

    }

});

app.listen(PORT, () => {

    console.log("");
    console.log("========================================");
    console.log(" Academic Resource Sharing System");
    console.log(" Running on:");
    console.log(` http://127.0.0.1:${PORT}`);
    console.log("========================================");
    console.log("");

});