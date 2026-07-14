// ===========================
// REGISTER
// ===========================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const name = document.getElementById("name").value.trim();

        const email = document.getElementById("registerEmail").value.trim();

        const password = document.getElementById("registerPassword").value;

        const confirmPassword = document.getElementById("confirmPassword").value;

        const role = document.getElementById("role").value;

        const invitationCode =
            document.getElementById("invitationCode") ?
            document.getElementById("invitationCode").value.trim() :
            "";

        const message = document.getElementById("registerMessage");

        if (password !== confirmPassword) {

            message.style.color = "red";

            message.innerText = "Passwords do not match.";

            return;

        }

        try {

            const response = await fetch("/register", {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    name,

                    email,

                    password,

                    role,

                    invitationCode

                })

            });

            const data = await response.json();

            if (!response.ok) {

                message.style.color = "red";

                message.innerText = data.message;

                return;

            }

            message.style.color = "green";

            message.innerText = data.message;

            setTimeout(() => {

                location.href = "/login";

            }, 1500);

        }

        catch (err) {

            console.log(err);

            message.style.color = "red";

            message.innerText = "Server error.";

        }

    });

}

// ===========================
// LOGIN
// ===========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();

        const password = document.getElementById("loginPassword").value;

        const message = document.getElementById("loginMessage");

        try {

            const response = await fetch("/login", {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    email,

                    password

                })

            });

            const data = await response.json();

            if (!response.ok) {

                message.style.color = "red";

                message.innerText = data.message;

                return;

            }

            sessionStorage.setItem("role", data.role);

            sessionStorage.setItem("name", data.name);

            message.style.color = "green";

            message.innerText = data.message;

            setTimeout(() => {

                if (data.role === "super_admin") {

                    location.href = "/admin-dashboard";

                }

                else if (data.role === "manager") {

                    location.href = "/manager-dashboard";

                }

                else {

                    location.href = "/dashboard";

                }

            }, 1000);

        }

        catch (err) {

            console.log(err);

            message.style.color = "red";

            message.innerText = "Server error.";

        }

    });

}

// ===========================
// UPLOAD
// ===========================

const uploadForm = document.getElementById("uploadNotesForm");

if (uploadForm) {

    uploadForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const title = document.getElementById("noteTitle").value;

        const file = document.getElementById("noteFile").files[0];

        if (!file) {

            alert("Please select a file.");

            return;

        }

        const formData = new FormData();

        formData.append("title", title);

        formData.append("file", file);

        try {

            const response = await fetch("/upload", {

                method: "POST",

                body: formData

            });

            const data = await response.json();

            alert(data.message);

            uploadForm.reset();

        }

        catch (err) {

            console.log(err);

            alert("Upload failed.");

        }

    });

}

// ===========================
// SEARCH
// ===========================

const searchForm = document.getElementById("searchForm");

if (searchForm) {

    searchForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const keyword = document.getElementById("searchQuery").value.trim();

        const response = await fetch("/search?query=" + encodeURIComponent(keyword));

        const data = await response.json();

        const results = document.getElementById("results");

        results.innerHTML = "";

        if (data.length === 0) {

            results.innerHTML = "<p>No resources found.</p>";

            return;

        }

        data.forEach(resource => {

            results.innerHTML += `

            <<div class="resource-card">

    <h3>${resource.title}</h3>

    <p>${resource.original_name}</p>

    <div class="resource-actions">

        <button onclick="previewFile('${resource.filename}', '${resource.title}', ${resource.id})">
            👁 Preview
        </button>

        <button onclick="downloadFile(${resource.id})">
            ⬇ Download
        </button>

    </div>


            `;

        });

    });

}

// ===========================
// DOWNLOAD
// ===========================

function downloadFile(id) {

    window.location.href = "/download/" + id;

}
function previewPDF(filename, title, id){

    document.getElementById("pdfTitle").innerText = title;

    document.getElementById("pdfViewer").src =
        "/uploads/" + filename;

    document.getElementById("downloadBtn").href =
        "/download/" + id;

    document.getElementById("pdfModal").style.display =
        "block";

}

function closePDF(){

    document.getElementById("pdfModal").style.display =
        "none";

    document.getElementById("pdfViewer").src = "";

}// =======================
// PREV// =======================
// PREVIEW PDF
// =======================

function previewFile(filename, title, id) {

    document.getElementById("pdfTitle").innerText = title;

    document.getElementById("pdfViewer").src = "/uploads/" + filename;

    document.getElementById("downloadBtn").href = "/download/" + id;

    document.getElementById("pdfModal").style.display = "block";
}

// =======================
// CLOSE PDF PREVIEW
// =======================

function closePDF() {

    document.getElementById("pdfModal").style.display = "none";

    document.getElementById("pdfViewer").src = "";

}