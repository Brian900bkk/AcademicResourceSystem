// =======================
// Register
// =======================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });

    const result = await response.json();
    alert(result.message);
    if (response.ok) {
        window.location.href = "/login";
    }
});

// =======================
// Login
// =======================
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    alert(result.message);

    if (response.ok) {
        // ✅ No need for localStorage — session is handled by backend
        window.location.href = "/dashboard";
    }
});

// =======================
// Upload Notes
// =======================
document.getElementById("uploadNotesForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", document.getElementById("noteTitle").value);
    formData.append("file", document.getElementById("noteFile").files[0]);

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
    if (!query) return;

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

    // ✅ Keep typed query visible
    queryInput.value = query;
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
        a.download = ""; // backend sets original name
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        alert("Download failed.");
    }
};
