
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = document.getElementById("role").value;

    const msg = document.getElementById("registerMessage");

    if (password !== confirmPassword) {
        msg.innerText = "Passwords do not match!";
        msg.style.color = "red";
        return;
    }

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await res.json();
        if (!res.ok) {
            msg.innerText = data.message;
            msg.style.color = "red";
            return;
        }

        msg.innerText = data.message;
        msg.style.color = "green";

        setTimeout(() => {
            window.location.href = "/login";
        }, 1500);

    } catch (err) {
        console.error("Register error:", err);
        msg.innerText = "Server error";
        msg.style.color = "red";
    }
});

// =======================
// LOGIN
// =======================
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const msg = document.getElementById("loginMessage");

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            msg.innerText = data.message;
            msg.style.color = "red";
            return;
        }

        // Save role in sessionStorage
        sessionStorage.setItem("role", data.role);

        msg.innerText = "Login successful!";
        msg.style.color = "green";

        setTimeout(() => {
            // Redirect based on role
            if (data.role === "super_admin") {
                window.location.href = "/admin-dashboard";
            } else if (data.role === "manager") {
                window.location.href = "/manager-dashboard";
            } else {
                window.location.href = "/dashboard";
            }
        }, 1000);

    } catch (err) {
        console.error("Login error:", err);
        msg.innerText = "Server error";
        msg.style.color = "red";
    }
});

// =======================
// UPLOAD
// =======================
document.getElementById("uploadNotesForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("noteTitle").value.trim();
    const file = document.getElementById("noteFile").files[0];

    if (!title || !file) {
        alert("Please provide a title and select a file.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    try {
        const res = await fetch("/upload", { method: "POST", body: formData });
        const data = await res.json();
        alert(data.message);
    } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed");
    }
});

// =======================
// SEARCH
// =======================
document.getElementById("searchForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const query = document.getElementById("searchQuery").value.trim();
    if (!query) return;

    try {
        const res = await fetch(`/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        const resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = "";

        if (data.length === 0) {
            resultsDiv.innerHTML = "<p>No results found</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.classList.add("resource-card");
            div.innerHTML = `
                <p><b>${item.title || "Untitled"}</b></p>
                <p>${item.original_name}</p>
                <button onclick="downloadFile(${item.id})">Download</button>
            `;
            resultsDiv.appendChild(div);
        });
    } catch (err) {
        console.error("Search error:", err);
        alert("Search failed");
    }
});

// =======================
// DOWNLOAD
// =======================
async function downloadFile(id) {
    try {
        const res = await fetch(`/download/${id}`);
        if (!res.ok) {
            alert("Download failed");
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (err) {
        console.error("Download error:", err);
        alert("Download failed");
    }
}
