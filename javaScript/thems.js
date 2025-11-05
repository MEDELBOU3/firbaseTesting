function setTheme(theme) {
    localStorage.setItem("theme", theme);
    const effectiveTheme = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    document.body.setAttribute("data-theme", effectiveTheme);
    if (window.monaco && window.editor) {
        const monacoTheme = effectiveTheme === "dark" ? "vs-dark" : "vs";
        monaco.editor.setTheme(monacoTheme);
    }
    const toggleThemeBtn = document.getElementById("toggleThemeBtn");
    if (toggleThemeBtn) {
        toggleThemeBtn.innerHTML = `<i class="bi bi-${effectiveTheme === "dark" ? "moon-fill" : "sun-fill"}" aria-hidden="true"></i> Thème`;
    }
}

function loadTheme() {
    const theme = localStorage.getItem("theme") || "system";
    setTheme(theme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (localStorage.getItem("theme") === "system") {
            setTheme("system");
        }
    });
}

document.addEventListener("DOMContentLoaded", loadTheme);

document.getElementById("toggleThemeBtn")?.addEventListener("click", () => {
    const currentTheme = localStorage.getItem("theme") || "system";
    const newTheme = currentTheme === "light" ? "dark" : currentTheme === "dark" ? "system" : "light";
    setTheme(newTheme);
});


