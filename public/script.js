// =======================
// Register with validation
// =======================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword")?.value; // add confirm field in HTML

    const messageDiv = document.getElementById("registerMessage");

    // Custom validation
    if (name.length < 2) {
        messageDiv.textContent = "Name must be at least 2 characters.";
        messageDiv.style.color = "red";
        return;
    }
    if (!email.includes("@") || !email.includes(".")) {
        messageDiv.textContent = "Please enter a valid email address.";
        messageDiv.style.color = "red";
        return;
    }
    if (password.length < 6) {
        messageDiv.textContent = "Password must be at least 6 characters.";
        messageDiv.style.color = "red";
        return;
    }
    if (confirmPassword && password !== confirmPassword) {
        messageDiv.textContent = "Passwords do not match.";
        messageDiv.style.color = "red";
        return;
    }

    // Proceed with backend call
    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });

    const result = await response.json();
    messageDiv.textContent = result.message;
    messageDiv.style.color = response.ok ? "green" : "red";

    if (response.ok) {
        setTimeout(() => { window.location.href = "/login"; }, 1500);
    }
});

// =======================
// Login
// =======================
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const messageDiv = document.getElementById("loginMessage");

    // Validation
    if (!email.includes("@") || !email.includes(".")) {
        messageDiv.textContent = "Please enter a valid email address.";
        messageDiv.style.color = "red";
        return;
    }
    if (password.length < 6) {
        messageDiv.textContent = "Password must be at least 6 characters.";
        messageDiv.style.color = "red";
        return;
    }

    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    messageDiv.textContent = result.message;
    messageDiv.style.color = response.ok ? "green" : "red";

    if (response.ok) {
        setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    }
});

// =======================
// Upload Notes
// =======================
document.getElementById("uploadNotesForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("noteTitle").value.trim();
    const file = document.getElementById("noteFile").files[0];

    if (!title) {
        alert("Please enter a resource title.");
        return;
    }
    if (!file) {
        alert("Please select a file to upload.");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    const response = await fetch("/upload", {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    alert(result.message);
});

// =======================
// Search Resources
// =======================
document.getElementById("searchForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const queryInput = document.getElementById("searchQuery");
    const query = queryInput.value.trim();
    if (!query) {
        alert("Please enter a search term.");
        return;
    }

    const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
    const results = await response.json();

    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "";

    if (results.length === 0) {
        resultsContainer.innerHTML = "<p>No resources found.</p>";
        return;
    }

    results.forEach(resource => {
        const item = document.createElement("div");
        item.classList.add("resource-item");

        item.innerHTML = `
            <p><strong>${resource.title || "Untitled"}</strong></p>
            <p>${resource.original_name}</p>
            <button onclick="downloadFile(${resource.id})">Download</button>
        `;
        resultsContainer.appendChild(item);
    });

    queryInput.value = "";
});

// =======================
// Download File
// =======================
const downloadFile = async (id) => {
    const response = await fetch(`/download/${id}`);
    if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        alert("Download failed.");
    }
};
