/* ==========================================================
   Sandbox Éditeur Pro+ — Full Advanced Logic with Project Management
   ========================================================== */

(() => {
    // ------------------------------
    // 🌐 GLOBAL STATE
    // ------------------------------
    let editor, currentFile = null, openTabs = [], projectData = null;
    let currentlySelectedNode = null;
    let currentlySelectedFolder = null;
    let currentContextNode = null;
    let currentProjectId = null;
    let projects = [];
    let autoSaveEnabled = false;
    let autoSaveInterval = null;
    let searchQuery = "";

    const PROJECTS_KEY = "sandbox_projects_v2";
    const CURRENT_PROJECT_ID_KEY = "sandbox_current_project_id_v2";
    const THEME_KEY = "theme";
    const SETTINGS_KEY = "editor_settings";

    // Sample snippets for Code Snippets Library
    const snippets = [
        { name: 'HTML Boilerplate', code: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>`, language: 'html' },
        { name: 'CSS Flexbox', code: `.container {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n}`, language: 'css' },
        { name: 'JS Event Listener', code: `document.addEventListener('click', (e) => {\n    console.log('Clicked!', e);\n});`, language: 'javascript' }
    ];

    // UI Elements
    const elements = {
        editorContainer: document.getElementById("editorContainer"),
        fileTree: document.getElementById("fileTree"),
        tabs: document.getElementById("tabs"),
        currentPath: document.getElementById("currentPath"),
        editorStatus: document.getElementById("editorStatus"),
        previewFrame: document.getElementById("previewFrame"),
        previewPanel: document.getElementById("previewPanel"),
        resizer: document.getElementById("resizer"),
        contextMenu: document.getElementById("ctx"),
        previewConsole: document.getElementById("previewConsole"),
        buttons: {
            projects: document.getElementById("projectsBtn"),
            newFile: document.getElementById("newFileBtn"),
            newFolder: document.getElementById("newFolderBtn"),
            saveFile: document.getElementById("saveFileBtn"),
            run: document.getElementById("runBtn"),
            format: document.getElementById("formatBtn"),
            downloadZip: document.getElementById("downloadZipBtn"),
            importZip: document.getElementById("importZipBtn"),
            clearStorage: document.getElementById("clearStorageBtn"),
            undo: document.getElementById("undoBtn"),
            togglePreview: document.getElementById("togglePreviewBtn"),
            toggleFullScreen: document.getElementById("toggleFullScreenBtn"),
            refreshPreview: document.getElementById("refreshPreview"),
            expandAll: document.getElementById("expandAll"),
            collapseAll: document.getElementById("collapseAll"),
            rename: document.getElementById("renameBtn"),
            closeTab: document.getElementById("closeTabBtn"),
            search: document.getElementById("searchBtn"),
            snippets: document.getElementById("snippetsBtn"),
            autoSave: document.getElementById("autoSaveBtn"),
            findReplace: document.getElementById("findReplaceBtn"),
            settings: document.getElementById("settingsBtn")
        },
    };

    let isPreviewVisible = true;
    let previewWidth = localStorage.getItem("previewWidth") || "50%";

    // ------------------------------
    // 🗂 INITIAL PROJECT STRUCTURE
    // ------------------------------
    const defaultProject = {
        name: "root",
        type: "folder",
        path: "/",
        children: [
            {
                name: "index.html",
                type: "file",
                path: "/index.html",
                content: "<!doctype html>\n<html>\n<head>\n<title>Sandbox</title>\n</head>\n<body>\n<h1>Hello World!</h1>\n</body>\n</html>",
            },
            {
                name: "style.css",
                type: "file",
                path: "/style.css",
                content: "body { font-family: sans-serif; background: #fafafa; }",
            },
            {
                name: "scripts",
                type: "folder",
                path: "/scripts",
                children: [
                    {
                        name: "app.js",
                        type: "file",
                        path: "/scripts/app.js",
                        content: "console.log('Nested script loaded');",
                    },
                ],
            },
        ],
    };

    // ------------------------------
    // 💾 STORAGE & PATH HANDLERS
    // ------------------------------
    function loadProjects() {
        const savedProjects = localStorage.getItem(PROJECTS_KEY);
        projects = savedProjects ? JSON.parse(savedProjects) : [];
        if (projects.length === 0) {
            projects.push({
                id: Date.now().toString(),
                name: "Project 1",
                data: JSON.parse(JSON.stringify(defaultProject)),
            });
        }
        currentProjectId = localStorage.getItem(CURRENT_PROJECT_ID_KEY) || projects[0].id;
        loadCurrentProject();
        renderProjectList();
    }

    function loadCurrentProject() {
        const currentProject = projects.find((p) => p.id === currentProjectId);
        if (currentProject) {
            projectData = assignPaths(currentProject.data);
            openTabs = [];
            elements.tabs.innerHTML = "";
            currentFile = null;
            if (editor) editor.setModel(null);
            elements.editorStatus.textContent = "Aucun fichier ouvert";
            elements.currentPath.textContent = "";
            elements.previewFrame.src = "about:blank";
            elements.previewConsole.innerHTML = "";
            renderFileTree();
            const htmlFile = findFirstHtmlFile(projectData);
            if (htmlFile) openFile(htmlFile, htmlFile.path);
        }
    }

    function saveProjects() {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
        localStorage.setItem(CURRENT_PROJECT_ID_KEY, currentProjectId);
    }

    function saveProject() {
        const currentProject = projects.find((p) => p.id === currentProjectId);
        if (currentProject) {
            currentProject.data = projectData;
            saveProjects();
        }
    }

    function clearStorage() {
        if (confirm("Voulez-vous vraiment effacer tous les projets du stockage local ? Cette action est irréversible.")) {
            localStorage.removeItem(PROJECTS_KEY);
            localStorage.removeItem(CURRENT_PROJECT_ID_KEY);
            localStorage.removeItem(SETTINGS_KEY);
            projects = [];
            currentProjectId = null;
            loadProjects();
            elements.editorStatus.textContent = "Stockage réinitialisé ✓";
        }
    }

    function createNewProject() {
        const name = prompt("Nom du nouveau projet:");
        if (!name || !name.trim()) return;
        const newId = Date.now().toString();
        projects.push({
            id: newId,
            name: name.trim(),
            data: JSON.parse(JSON.stringify(defaultProject)),
        });
        currentProjectId = newId;
        saveProjects();
        loadCurrentProject();
        renderProjectList();
    }

    function openProject(id) {
        if (id === currentProjectId) return;
        currentProjectId = id;
        saveProjects();
        loadCurrentProject();
        renderProjectList();
    }

    function renameProject(id) {
        const project = projects.find((p) => p.id === id);
        if (!project) return;
        const newName = prompt("Nouveau nom du projet:", project.name);
        if (newName && newName.trim()) {
            project.name = newName.trim();
            saveProjects();
            renderProjectList();
        }
    }

    function deleteProject(id) {
        if (projects.length <= 1) {
            alert("Impossible de supprimer le dernier projet.");
            return;
        }
        if (confirm("Êtes-vous sûr de vouloir supprimer ce projet?")) {
            projects = projects.filter((p) => p.id !== id);
            if (currentProjectId === id) {
                currentProjectId = projects[0].id;
                loadCurrentProject();
            }
            saveProjects();
            renderProjectList();
        }
    }

    function assignPaths(node, parentPath = "") {
        node.path = node.name === "root" ? "/" : `${parentPath}/${node.name}`.replace(/\/\/+/g, "/");
        if (node.type === "folder" && node.children) {
            node.children = node.children.map((child) => assignPaths(child, node.path === "/" ? "" : node.path));
        }
        return node;
    }

    // ------------------------------
    // 🧩 MONACO INITIALIZATION
    // ------------------------------
    require(["vs/editor/editor.main"], () => {
        const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { fontSize: 14, wordWrap: 'off' };
        editor = monaco.editor.create(elements.editorContainer, {
            value: "",
            language: "html",
            automaticLayout: true,
            theme: (localStorage.getItem(THEME_KEY) || "system") === "dark" ? "vs-dark" : "vs",
            minimap: { enabled: true },
            fontSize: savedSettings.fontSize,
            tabSize: 2,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            wordWrap: savedSettings.wordWrap
        });

        editor.onDidChangeModelContent(() => {
            if (currentFile && autoSaveEnabled) {
                saveProject();
                elements.editorStatus.textContent = "Auto-sauvegardé ✓";
            }
        });

        if (window.emmetMonaco) {
            emmetMonaco.emmetHTML(monaco, ["html", "htm"]);
            emmetMonaco.emmetCSS(monaco, ["css", "scss", "less"]);
            emmetMonaco.emmetJSX(monaco, ["jsx", "tsx"]);
        }

        loadProjects();
        bindUI();
        initDragAndDropHandlers();
        attachContextMenuHandlers();
        currentlySelectedFolder = projectData;

        const initialFile = findNodeByPath("/index.html");
        if (initialFile) openFile(initialFile, initialFile.path);
    });

    // ------------------------------
    // 🛠 UTILITY: PATH FINDERS & MUTATORS
    // ------------------------------
    function findNodeByPath(path) {
        if (path === "/") return projectData;
        const parts = path.split("/").filter((p) => p);
        let current = projectData;
        for (const part of parts) {
            if (!current || current.type !== "folder" || !current.children) return null;
            current = current.children.find((child) => child.name === part);
        }
        return current;
    }

    function getParentNode(path) {
        if (path === "/") return null;
        const parentPath = path.substring(0, path.lastIndexOf("/")) || "/";
        return findNodeByPath(parentPath);
    }

    function deleteNodeByPath(path) {
        const parent = getParentNode(path);
        if (parent && parent.children) {
            parent.children = parent.children.filter((n) => n.path !== path);
            saveProject();
            renderFileTree();
            if (currentFile?.path === path) {
                closeTab(path);
            }
        }
    }

    function resolveRelativePath(baseDir, relPath) {
        if (relPath.startsWith("/")) return relPath.replace(/\/\/+/g, "/");
        const baseParts = baseDir === "/" ? [] : baseDir.split("/").filter((p) => p);
        const relParts = relPath.split("/").filter((p) => p);
        const current = [...baseParts];
        for (const part of relParts) {
            if (part === ".") continue;
            if (part === "..") {
                if (current.length > 0) current.pop();
                continue;
            }
            current.push(part);
        }
        return "/" + current.join("/").replace(/\/\/+/g, "/");
    }

    function isTextFile(name) {
        const ext = name.split(".").pop().toLowerCase();
        return ["html", "htm", "css", "js", "mjs", "cjs", "ts", "tsx", "json", "md", "txt"].includes(ext);
    }

    function isImageFile(name) {
        const ext = name.split(".").pop().toLowerCase();
        return ["png", "jpg", "jpeg", "gif", "svg"].includes(ext);
    }

    // ------------------------------
    // 🧭 FILE TREE RENDERING & INTERACTION
    // ------------------------------
    function renderFileTree() {
        elements.fileTree.innerHTML = "";
        if (projectData && projectData.children) {
            const rootEl = document.createElement("div");
            rootEl.classList.add("node-wrapper", "root");
            rootEl.setAttribute("data-path", projectData.path);
            rootEl.setAttribute("data-type", projectData.type);
            const labelEl = document.createElement("div");
            labelEl.classList.add("node-label");
            if (projectData.path === currentlySelectedNode?.path) labelEl.classList.add("selected");
            labelEl.innerHTML = `
                <i class="bi bi-folder-fill i-folder"></i>
                <span>${projectData.name}</span>
            `;
            labelEl.addEventListener("click", (e) => {
                e.stopPropagation();
                selectNode(projectData);
            });
            labelEl.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                selectNode(projectData);
                showContextMenu(e, projectData);
            });
            rootEl.appendChild(labelEl);
            elements.fileTree.appendChild(rootEl);
            renderChildren(projectData.children, elements.fileTree, 0);
        }
    }

    function renderChildren(children, container, depth) {
        children.forEach((child) => {
            if (searchQuery && !child.name.toLowerCase().includes(searchQuery.toLowerCase()) && child.type !== "folder") return;
            renderNode(child, container, depth);
        });
    }

    function renderNode(node, container, depth = 0) {
        const nodeEl = document.createElement("div");
        nodeEl.classList.add("node-wrapper");
        nodeEl.setAttribute("data-path", node.path);
        nodeEl.setAttribute("data-type", node.type);
        nodeEl.setAttribute("draggable", "true");

        const isFolder = node.type === "folder";
        const isExpanded = node._expanded || false;

        const chevron = isFolder
            ? `<i class="bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"}" style="font-size:0.8rem;opacity:0.6;margin-right:4px;"></i>`
            : `<i style="width:12px;display:inline-block;"></i>`;

        const labelEl = document.createElement("div");
        labelEl.classList.add("node-label");
        if (node.path === currentFile?.path) labelEl.classList.add("active");
        if (node.path === currentlySelectedNode?.path) labelEl.classList.add("selected");
        labelEl.style.paddingLeft = `${depth * 14 + 6}px`;
        labelEl.innerHTML = `
            ${chevron}
            <i class="bi ${getFileIcon(node.name, node.type)}"></i>
            <span>${node.name}</span>
        `;
        nodeEl.appendChild(labelEl);
        container.appendChild(nodeEl);

        labelEl.addEventListener("click", (e) => {
            e.stopPropagation();
            selectNode(node);
            if (isFolder) toggleFolder(nodeEl, node);
            else openFile(node, node.path);
        });

        labelEl.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectNode(node);
            showContextMenu(e, node);
        });

        if (isFolder && node.children?.length) {
            const childrenEl = document.createElement("div");
            childrenEl.classList.add("children");
            if (!isExpanded) childrenEl.style.display = "none";
            if (searchQuery) {
                renderChildren(node.children, childrenEl, depth + 1);
            } else {
                node.children.forEach((child) => renderNode(child, childrenEl, depth + 1));
            }
            nodeEl.appendChild(childrenEl);
        }
    }

    function selectNode(node) {
        document.querySelectorAll(".node-label.selected").forEach((el) => el.classList.remove("selected"));
        currentlySelectedNode = node;
        currentlySelectedFolder = node.type === "folder" || node.name === "root" ? node : getParentNode(node.path);
        const el = elements.fileTree.querySelector(`[data-path="${node.path}"] .node-label`);
        if (el) el.classList.add("selected");
        if (node.type === "file" && editor) editor.focus();
    }

    function toggleFolder(el, node) {
        const childrenWrapper = el.querySelector(".children");
        const chevron = el.querySelector(".bi-chevron-down, .bi-chevron-right");
        if (!childrenWrapper || !chevron) return;
        node._expanded = !node._expanded;
        childrenWrapper.style.display = node._expanded ? "block" : "none";
        chevron.className = node._expanded ? "bi bi-chevron-down" : "bi bi-chevron-right";
        saveProject();
    }

    function getFileIcon(name, type) {
        if (type === "folder") return "bi-folder-fill i-folder";
        const ext = name.split(".").pop().toLowerCase();
        const map = {
            html: "bi-filetype-html i-html",
            css: "bi-filetype-css i-css",
            js: "bi-filetype-js i-js",
            ts: "bi-filetype-typescript i-ts",
            json: "bi-filetype-json i-json",
            md: "bi-markdown i-md",
            png: "bi-file-earmark-image i-image",
            jpg: "bi-file-earmark-image i-image",
            jpeg: "bi-file-earmark-image i-image",
            svg: "bi-file-earmark-image i-image",
        };
        return map[ext] || "bi-file-earmark-text";
    }

    // ------------------------------
    // 📝 OPEN & MANAGE FILES
    // ------------------------------
    function openFile(file, path) {
        if (file.type === "folder") return;
        if (!isTextFile(file.name)) {
            elements.editorStatus.textContent = "Fichier binaire ou image, édition non supportée.";
            return;
        }
        if (file.content === "// Chargement en cours...") {
            elements.editorStatus.textContent = "Le contenu du fichier est encore en cours de chargement.";
            return;
        }
        currentFile = file;
        elements.currentPath.textContent = path;
        elements.editorStatus.textContent = `Modification de ${file.name}`;
        selectNode(file);
        const model = getOrCreateModelForNode(file, path);
        editor.setModel(model);
        if (!openTabs.includes(path)) {
            openTabs.push(path);
        }
        renderTabs();
        editor.focus();
        if (detectLanguage(file.name) === "html" && isPreviewVisible) {
            generatePreview();
        }
    }

    function detectLanguage(filename) {
        if (!filename) return "plaintext";
        const ext = String(filename).split(".").pop().toLowerCase();
        switch (ext) {
            case "html":
            case "htm":
                return "html";
            case "css":
                return "css";
            case "js":
            case "mjs":
            case "cjs":
                return "javascript";
            case "ts":
            case "tsx":
                return "typescript";
            case "json":
                return "json";
            case "md":
                return "markdown";
            default:
                return "plaintext";
        }
    }

    function getOrCreateModelForNode(node, pathForUri) {
        if (!monaco?.editor) return { getValue: () => node.content || "", dispose: () => {} };
        const uriPath = pathForUri.replace(/\/\/+/g, "/");
        const uri = monaco.Uri.parse("inmemory://project" + uriPath);
        let model = monaco.editor.getModel(uri);
        if (!model) {
            const lang = detectLanguage(node.name);
            model = monaco.editor.createModel(node.content || "", lang, uri);
            model.onDidChangeContent(() => {
                node.content = model.getValue();
                if (detectLanguage(node.name) === "html" && isPreviewVisible) {
                    generatePreview();
                }
            });
        } else {
            if (model.getValue() !== (node.content || "")) {
                model.setValue(node.content || "");
            }
            monaco.editor.setModelLanguage(model, detectLanguage(node.name));
        }
        return model;
    }

    function renderTabs() {
        elements.tabs.innerHTML = "";
        openTabs.forEach((path) => {
            const file = findNodeByPath(path);
            if (!file) {
                openTabs = openTabs.filter((p) => p !== path);
                return;
            }
            const tab = document.createElement("div");
            tab.className = "tab" + (currentFile?.path === path ? " active" : "");
            tab.title = path;
            tab.innerHTML = `${file.name} <i class="bi bi-x"></i>`;
            tab.addEventListener("click", () => openFile(file, path));
            tab.querySelector("i").addEventListener("click", (e) => {
                e.stopPropagation();
                closeTab(path);
            });
            elements.tabs.appendChild(tab);
        });
    }

    function closeTab(path) {
        const uri = monaco.Uri.parse("inmemory://project" + path);
        const model = monaco.editor.getModel(uri);
        if (model) model.dispose();
        openTabs = openTabs.filter((p) => p !== path);
        if (currentFile?.path === path) {
            currentFile = null;
            editor.setModel(null);
            elements.editorStatus.textContent = "Aucun fichier ouvert";
            elements.currentPath.textContent = "";
            elements.previewFrame.src = "about:blank";
            elements.previewConsole.innerHTML = "";
            if (openTabs.length > 0) {
                const newPath = openTabs[openTabs.length - 1];
                const newFile = findNodeByPath(newPath);
                if (newFile) openFile(newFile, newPath);
            }
        }
        renderTabs();
        renderFileTree();
    }

    // ------------------------------
    // 📂 CREATION & DELETION LOGIC
    // ------------------------------
    function createNewFile() {
        const targetFolder = currentlySelectedFolder || projectData;
        const name = prompt(`Nom du nouveau fichier dans ${targetFolder.path}:`);
        if (!name) return;
        if (name.includes("/") || name.includes("\\")) {
            alert("Le nom ne doit pas contenir de chemins.");
            return;
        }
        const newPath = targetFolder.path === "/" ? `/${name}` : `${targetFolder.path}/${name}`;
        if (findNodeByPath(newPath)) {
            alert(`Le fichier ${name} existe déjà.`);
            return;
        }
        const newNode = { name, type: "file", path: newPath, content: "" };
        targetFolder.children = targetFolder.children || [];
        targetFolder.children.push(newNode);
        targetFolder._expanded = true;
        saveProject();
        renderFileTree();
        openFile(newNode, newPath);
    }

    function createNewFolder() {
        const targetFolder = currentlySelectedFolder || projectData;
        const name = prompt(`Nom du nouveau dossier dans ${targetFolder.path}:`);
        if (!name) return;
        if (name.includes("/") || name.includes("\\")) {
            alert("Le nom ne doit pas contenir de chemins.");
            return;
        }
        const newPath = targetFolder.path === "/" ? `/${name}` : `${targetFolder.path}/${name}`;
        if (findNodeByPath(newPath)) {
            alert(`Le dossier ${name} existe déjà.`);
            return;
        }
        targetFolder.children = targetFolder.children || [];
        targetFolder.children.push({ name, type: "folder", path: newPath, children: [], _expanded: true });
        targetFolder._expanded = true;
        saveProject();
        renderFileTree();
    }

    function deleteSelectedNode(node = currentContextNode) {
        if (!node || node.path === "/") {
            alert("Impossible de supprimer la racine.");
            return;
        }
        if (confirm(`Êtes-vous sûr de vouloir supprimer ${node.path}?`)) {
            deleteNodeByPath(node.path);
            currentlySelectedNode = null;
            currentContextNode = null;
            renderFileTree();
        }
    }

    function renameNode(node = currentlySelectedNode) {
        if (!node || node.path === "/") {
            alert("Impossible de renommer la racine.");
            return;
        }
        const oldName = node.name;
        const newName = prompt(`Renommer "${oldName}":`, oldName);
        if (!newName || newName === oldName) return;
        if (newName.includes("/") || newName.includes("\\")) {
            alert("Le nom ne doit pas contenir de chemins.");
            return;
        }
        const parent = getParentNode(node.path);
        if (parent && parent.children.some((child) => child.name === newName && child !== node)) {
            alert(`Un élément nommé "${newName}" existe déjà.`);
            return;
        }
        const oldPath = node.path;
        node.name = newName;
        const parentPath = parent.path === "/" ? "" : parent.path;
        const newPath = parentPath + "/" + newName;
        function updateNodePath(currentNode, oldPrefix, newPrefix) {
            currentNode.path = currentNode.path.replace(oldPrefix, newPrefix);
            if (currentNode.type === "folder" && currentNode.children) {
                currentNode.children.forEach((child) => updateNodePath(child, oldPrefix, newPrefix));
            }
        }
        updateNodePath(node, oldPath, newPath);
        openTabs = openTabs.map((tabPath) => (tabPath.startsWith(oldPath + "/") ? tabPath.replace(oldPath, newPath) : tabPath));
        if (currentFile && currentFile.path === oldPath) currentFile = node;
        saveProject();
        renderFileTree();
        renderTabs();
    }

    function duplicateNode(node = currentlySelectedNode) {
        if (!node) return;
        const parent = getParentNode(node.path);
        if (!parent) return;
        const baseName = node.name.replace(/(\.[^/.]+)?$/, "");
        const extension = node.name.match(/(\.[^/.]+)$/)?.[1] || "";
        let counter = 1;
        let newName = `${baseName} - copie${extension}`;
        while (parent.children.some((child) => child.name === newName)) {
            newName = `${baseName} - copie ${counter}${extension}`;
            counter++;
        }
        const newPath = parent.path === "/" ? `/${newName}` : `${parent.path}/${newName}`;
        const newNode = JSON.parse(JSON.stringify(node));
        newNode.name = newName;
        newNode.path = newPath;
        function updateDuplicatedPaths(currentNode, oldPrefix, newPrefix) {
            currentNode.path = currentNode.path.replace(oldPrefix, newPrefix);
            if (currentNode.type === "folder" && currentNode.children) {
                currentNode.children.forEach((child) => updateDuplicatedPaths(child, oldPrefix, newPrefix));
            }
        }
        updateDuplicatedPaths(newNode, node.path, newPath);
        parent.children.push(newNode);
        saveProject();
        renderFileTree();
        if (newNode.type === "file") openFile(newNode, newNode.path);
    }

    function downloadNode(node = currentlySelectedNode) {
        if (!node) return;
        if (node.type === "folder") {
            downloadFolderAsZip(node);
        } else {
            const blob = new Blob([node.content], { type: getMimeType(node.name) });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = node.name;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function downloadFolderAsZip(folder) {
        const zip = new JSZip();
        function addFolderToZip(currentFolder, zipFolder) {
            currentFolder.children?.forEach((item) => {
                if (item.type === "file") {
                    if (item.content.startsWith("data:")) {
                        const base64Data = item.content.split(",")[1];
                        zipFolder.file(item.name, base64Data, { base64: true });
                    } else {
                        zipFolder.file(item.name, item.content);
                    }
                } else if (item.type === "folder") {
                    const newZipFolder = zipFolder.folder(item.name);
                    addFolderToZip(item, newZipFolder);
                }
            });
        }
        const zipFolder = folder.name === "root" ? zip : zip.folder(folder.name);
        addFolderToZip(folder, zipFolder);
        zip.generateAsync({ type: "blob" }).then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${folder.name}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    function getMimeType(filename) {
        const ext = filename.split(".").pop().toLowerCase();
        const mimeTypes = {
            html: "text/html",
            css: "text/css",
            js: "application/javascript",
            json: "application/json",
            txt: "text/plain",
            md: "text/markdown",
        };
        return mimeTypes[ext] || "application/octet-stream";
    }

    function expandAll() {
        const expand = (node) => {
            if (node.type === "folder") {
                node._expanded = true;
                if (node.children) node.children.forEach(expand);
            }
        };
        expand(projectData);
        saveProject();
        renderFileTree();
    }

    function collapseAll() {
        const collapse = (node) => {
            if (node.type === "folder") {
                node._expanded = false;
                if (node.children) node.children.forEach(collapse);
            }
        };
        collapse(projectData);
        saveProject();
        renderFileTree();
    }

    // ------------------------------
    // 🖱 CONTEXT MENU
    // ------------------------------
    function showContextMenu(e, node) {
        if (!elements.contextMenu) return;
        currentContextNode = node;
        currentlySelectedNode = node;
        elements.contextMenu.style.display = "block";
        const menuWidth = elements.contextMenu.offsetWidth;
        const menuHeight = elements.contextMenu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let left = e.clientX;
        let top = e.clientY;
        if (left + menuWidth > viewportWidth) left = viewportWidth - menuWidth - 10;
        if (top + menuHeight > viewportHeight) top = viewportHeight - menuHeight - 10;
        elements.contextMenu.style.left = `${left}px`;
        elements.contextMenu.style.top = `${top}px`;
        e.preventDefault();
        e.stopPropagation();
    }

    function attachContextMenuHandlers() {
        elements.fileTree.addEventListener("contextmenu", (e) => {
            const nodeEl = e.target.closest(".node-wrapper");
            if (!nodeEl) return;
            const path = nodeEl.getAttribute("data-path");
            const node = findNodeByPath(path);
            if (node) showContextMenu(e, node);
        });
    }

    document.addEventListener("click", (e) => {
        if (elements.contextMenu && !elements.contextMenu.contains(e.target)) {
            elements.contextMenu.style.display = "none";
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && elements.contextMenu.style.display === "block") {
            elements.contextMenu.style.display = "none";
        }
    });

    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".node-wrapper")) {
            e.preventDefault();
            elements.contextMenu.style.display = "none";
        }
    });

    // ------------------------------
    // ⬆️ DRAG AND DROP
    // ------------------------------
    function initDragAndDropHandlers() {
        elements.fileTree.addEventListener("dragstart", (e) => {
            const nodeEl = e.target.closest(".node-wrapper");
            const path = nodeEl ? nodeEl.getAttribute("data-path") : null;
            if (path) {
                e.dataTransfer.setData("text/plain", path);
                e.dataTransfer.effectAllowed = "move";
                nodeEl.classList.add("dragging");
            }
        });

        elements.fileTree.addEventListener("dragend", (e) => {
            e.target.closest(".node-wrapper")?.classList.remove("dragging");
        });

        elements.fileTree.addEventListener("dragover", (e) => {
            e.preventDefault();
            const targetEl = e.target.closest(".node-wrapper");
            const isInternalDrag = e.dataTransfer.types.includes("text/plain");
            if (targetEl && targetEl.getAttribute("data-type") === "folder") {
                targetEl.classList.add("drag-over");
                e.dataTransfer.dropEffect = isInternalDrag ? "move" : "copy";
            } else {
                e.dataTransfer.dropEffect = "none";
            }
        });

        elements.fileTree.addEventListener("dragleave", (e) => {
            e.target.closest(".node-wrapper")?.classList.remove("drag-over");
        });

        elements.fileTree.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetEl = e.target.closest(".node-wrapper");
            targetEl?.classList.remove("drag-over");
            const sourcePath = e.dataTransfer.getData("text/plain");
            const targetPath = targetEl ? targetEl.getAttribute("data-path") : "/";
            const targetNode = findNodeByPath(targetPath);
            if (sourcePath && findNodeByPath(sourcePath)) {
                let finalTargetPath = targetPath;
                if (targetNode && targetNode.type === "file") {
                    finalTargetPath = getParentNode(targetPath).path;
                }
                moveNode(sourcePath, finalTargetPath);
                return;
            }
            if (targetNode && targetNode.type === "file") {
                handleDropUpload(e, getParentNode(targetNode.path));
            } else {
                handleDropUpload(e, targetNode || projectData);
            }
        });

        elements.editorContainer.addEventListener("dragover", (e) => e.preventDefault());
        elements.editorContainer.addEventListener("drop", (e) => {
            e.preventDefault();
            handleDropUpload(e, projectData);
        });
    }

    function moveNode(sourcePath, targetPath) {
        if (sourcePath === targetPath || sourcePath === "/" || targetPath.startsWith(sourcePath + "/")) return;
        const sourceNode = findNodeByPath(sourcePath);
        const targetFolder = findNodeByPath(targetPath);
        if (!sourceNode || !targetFolder || targetFolder.type !== "folder") return;
        const sourceParent = getParentNode(sourcePath);
        if (sourceParent) {
            sourceParent.children = sourceParent.children.filter((n) => n.path !== sourcePath);
        }
        const newName = sourceNode.name;
        if (targetFolder.children.some((c) => c.name === newName)) {
            alert(`Un fichier ou dossier nommé "${newName}" existe déjà.`);
            return;
        }
        const oldPrefix = sourcePath;
        const newPrefix = targetFolder.path === "/" ? `/${newName}` : `${targetFolder.path}/${newName}`;
        function updateChildPaths(node) {
            node.path = node.path.replace(oldPrefix, newPrefix);
            if (node.type === "folder" && node.children) {
                node.children.forEach(updateChildPaths);
            }
        }
        updateChildPaths(sourceNode);
        targetFolder.children.push(sourceNode);
        openTabs = openTabs.map((path) => (path.startsWith(oldPrefix) ? path.replace(oldPrefix, newPrefix) : path));
        targetFolder._expanded = true;
        saveProject();
        renderFileTree();
        renderTabs();
    }

    function readAllDirectoryEntries(reader) {
        return new Promise((resolve) => {
            let allEntries = [];
            const readChunk = () => {
                reader.readEntries(
                    (entries) => {
                        if (entries.length > 0) {
                            allEntries = allEntries.concat(entries);
                            readChunk();
                        } else {
                            resolve(allEntries);
                        }
                    },
                    (error) => {
                        console.error("Error reading directory chunk:", error);
                        resolve([]);
                    }
                );
            };
            readChunk();
        });
    }

    function readEntriesRecursively(entries, filePromises, currentParentNode, currentPathPrefix) {
        const structurePromises = entries.map(
            (entry) =>
                new Promise((resolve) => {
                    const newPath = `${currentPathPrefix}/${entry.name}`;
                    const normalizedPath = newPath.replace(/\/\/+/g, "/");
                    if (entry.isFile) {
                        entry.file(
                            (file) => {
                                if (file.size === 0) return resolve();
                                const newNode = { name: entry.name, type: "file", path: normalizedPath, content: "" };
                                currentParentNode.children = currentParentNode.children || [];
                                currentParentNode.children.push(newNode);
                                const contentPromise = new Promise((contentResolve, contentReject) => {
                                    const reader = new FileReader();
                                    if (isTextFile(entry.name)) {
                                        reader.readAsText(file);
                                    } else {
                                        reader.readAsDataURL(file);
                                    }
                                    reader.onload = (e) => {
                                        newNode.content = e.target.result;
                                        contentResolve();
                                    };
                                    reader.onerror = contentReject;
                                });
                                filePromises.push(contentPromise);
                                resolve();
                            },
                            () => resolve()
                        );
                    } else if (entry.isDirectory) {
                        const newFolderNode = {
                            name: entry.name,
                            type: "folder",
                            path: normalizedPath,
                            children: [],
                            _expanded: true,
                        };
                        currentParentNode.children = currentParentNode.children || [];
                        currentParentNode.children.push(newFolderNode);
                        const directoryReader = entry.createReader();
                        readAllDirectoryEntries(directoryReader)
                            .then((subEntries) => readEntriesRecursively(subEntries, filePromises, newFolderNode, newFolderNode.path))
                            .then(resolve)
                            .catch((err) => {
                                console.error(`Error processing directory ${entry.name}:`, err);
                                resolve();
                            });
                    } else {
                        resolve();
                    }
                })
        );
        return Promise.all(structurePromises);
    }

    function handleDropUpload(e, targetFolder) {
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;
        if (!targetFolder || targetFolder.type !== "folder") {
            alert("Erreur: Le contenu ne peut être déposé que dans un dossier.");
            return;
        }
        elements.editorStatus.textContent = "Téléchargement en cours...";
        const filePromises = [];
        const filesToProcess = [];
        [...items].forEach((item) => {
            const entry = item.webkitGetAsEntry();
            if (entry) filesToProcess.push(entry);
        });
        readEntriesRecursively(filesToProcess, filePromises, targetFolder, targetFolder.path === "/" ? "" : targetFolder.path)
            .then(() => Promise.all(filePromises))
            .then(() => {
                targetFolder._expanded = true;
                projectData = assignPaths(projectData);
                saveProject();
                renderFileTree();
                elements.editorStatus.textContent = "Téléchargement réussi ✓";
                const htmlFile = findFirstHtmlFile(targetFolder);
                if (htmlFile) openFile(htmlFile, htmlFile.path);
            })
            .catch((err) => {
                console.error("Erreur critique durant le téléchargement:", err);
                elements.editorStatus.textContent = "Erreur de téléchargement ✗";
                alert("Une erreur est survenue pendant le téléchargement des fichiers.");
            });
    }

    function processFileInput(files) {
        if (files.length === 0) return;
        elements.editorStatus.textContent = "Téléchargement en cours (0%)...";
        const targetFolder = currentlySelectedFolder || projectData;
        targetFolder.children = targetFolder.children || [];
        let processed = 0;
        const total = files.length;

        const processFile = (index) => {
            if (index >= total) {
                projectData = assignPaths(projectData);
                saveProject();
                renderFileTree();
                elements.editorStatus.textContent = `Téléchargement réussi : ${total} fichier(s)`;
                const htmlFile = findFirstHtmlFile(targetFolder);
                if (htmlFile) openFile(htmlFile, htmlFile.path);
                return;
            }

            const file = files[index];
            const relativePath = file.webkitRelativePath || file.name;
            const pathParts = relativePath.split("/").filter((part) => part.trim() !== "");
            let currentParent = targetFolder;

            for (let i = 0; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                let folder = currentParent.children.find((child) => child.name === folderName && child.type === "folder");
                if (!folder) {
                    const folderPath = currentParent.path === "/" ? `/${folderName}` : `${currentParent.path}/${folderName}`;
                    folder = { name: folderName, type: "folder", path: folderPath, children: [], _expanded: true };
                    currentParent.children.push(folder);
                }
                currentParent = folder;
            }

            const fileName = pathParts[pathParts.length - 1];
            const filePath = currentParent.path === "/" ? `/${fileName}` : `${currentParent.path}/${fileName}`;

            const reader = new FileReader();
            reader.onload = (e) => {
                const existingFile = currentParent.children.find((child) => child.name === fileName && child.type === "file");
                if (existingFile) {
                    existingFile.content = e.target.result;
                } else {
                    currentParent.children.push({ name: fileName, type: "file", path: filePath, content: e.target.result });
                }
                processed++;
                const progress = Math.round((processed / total) * 100);
                elements.editorStatus.textContent = `Téléchargement en cours (${progress}%)...`;
                if (processed % 10 === 0 || processed === total) {
                    projectData = assignPaths(projectData);
                    renderFileTree();
                    saveProject();
                }
                processFile(index + 1);
            };
            reader.onerror = () => {
                console.error(`Failed to read: ${fileName}`);
                processed++;
                processFile(index + 1);
            };
            if (isTextFile(fileName)) {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        };
        processFile(0);
    }

    // ------------------------------
    // 💾 RUN, SAVE, FORMAT, UNDO
    // ------------------------------
    function saveCurrentFile() {
        if (!currentFile) return;
        saveProject();
        elements.editorStatus.textContent = "Fichier sauvegardé ✓";
    }

    function runPreview() {
        if (!currentFile || detectLanguage(currentFile.name) !== "html") {
            const htmlFile = findFirstHtmlFile(projectData);
            if (htmlFile) {
                openFile(htmlFile, htmlFile.path);
                setTimeout(generatePreview, 100);
                return;
            }
            alert("Aucun fichier HTML trouvé. Ouvrez ou créez un fichier HTML pour prévisualiser.");
            return;
        }
        saveProject();
        generatePreview();
    }

    function undoEdit() {
        if (editor) {
            editor.trigger("keyboard", "undo");
            elements.editorStatus.textContent = "Modification annulée ✓";
        }
    }

    function findFirstHtmlFile(node) {
        if (node.type === "file" && detectLanguage(node.name) === "html") return node;
        if (node.type === "folder" && node.children) {
            for (const child of node.children) {
                const result = findFirstHtmlFile(child);
                if (result) return result;
            }
        }
        return null;
    }

    function generatePreview() {
        if (!currentFile || detectLanguage(currentFile.name) !== "html") {
            elements.previewFrame.src = "about:blank";
            elements.previewConsole.innerHTML = "";
            return;
        }
        if (currentFile.content === "// Chargement en cours...") {
            elements.editorStatus.textContent = "Le contenu du fichier est encore en cours de chargement.";
            return;
        }
        const html = currentFile.content;
        const baseDir = currentFile.path.substring(0, currentFile.path.lastIndexOf("/")) || "/";
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
            const href = link.getAttribute("href");
            if (!href || href.startsWith("http") || href.startsWith("//")) return;
            const resolvedPath = resolveRelativePath(baseDir, href);
            const cssNode = findNodeByPath(resolvedPath);
            if (cssNode && cssNode.type === "file" && detectLanguage(cssNode.name) === "css") {
                if (cssNode.content !== "// Chargement en cours...") {
                    const style = doc.createElement("style");
                    style.textContent = cssNode.content;
                    link.replaceWith(style);
                }
            }
        });
        doc.querySelectorAll("script[src]").forEach((script) => {
            const src = script.getAttribute("src");
            if (!src || src.startsWith("http") || src.startsWith("//")) return;
            const resolvedPath = resolveRelativePath(baseDir, src);
            const jsNode = findNodeByPath(resolvedPath);
            if (jsNode && jsNode.type === "file" && detectLanguage(jsNode.name) === "javascript") {
                if (jsNode.content !== "// Chargement en cours...") {
                    const inlineScript = doc.createElement("script");
                    inlineScript.textContent = jsNode.content;
                    script.replaceWith(inlineScript);
                }
            }
        });
        doc.querySelectorAll("img[src]").forEach((img) => {
            const src = img.getAttribute("src");
            if (!src || src.startsWith("http") || src.startsWith("//") || src.startsWith("data:")) return;
            const resolvedPath = resolveRelativePath(baseDir, src);
            const imgNode = findNodeByPath(resolvedPath);
            if (imgNode && imgNode.type === "file" && isImageFile(imgNode.name) && imgNode.content.startsWith("data:")) {
                img.setAttribute("src", imgNode.content);
            }
        });
        const interceptorScript = doc.createElement("script");
        interceptorScript.textContent = getConsoleInterceptor();
        doc.body.appendChild(interceptorScript);
        const finalContent = new XMLSerializer().serializeToString(doc);
        const blob = new Blob([finalContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        elements.previewFrame.src = url;
        elements.previewConsole.innerHTML = "";
        if (isPreviewVisible) {
            elements.previewConsole.style.display = "block";
        }
    }

    function getConsoleInterceptor() {
        return `
            (function() {
                const originalLog = console.log;
                const originalWarn = console.warn;
                const originalError = console.error;
                const originalInfo = console.info;
                function sendToParent(level, args) {
                    try {
                        parent.postMessage({
                            type: 'console',
                            level: level,
                            message: Array.from(args).map(arg => {
                                if (typeof arg === 'object') {
                                    try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
                                }
                                return String(arg);
                            }).join(' ')
                        }, '*');
                    } catch (e) {}
                }
                console.log = function(...args) { sendToParent('log', args); originalLog.apply(console, args); };
                console.warn = function(...args) { sendToParent('warn', args); originalWarn.apply(console, args); };
                console.error = function(...args) { sendToParent('error', args); originalError.apply(console, args); };
                console.info = function(...args) { sendToParent('info', args); originalInfo.apply(console, args); };
                window.addEventListener('error', (e) => {
                    sendToParent('error', [e.message + ' at ' + e.filename + ':' + e.lineno]);
                });
                window.addEventListener('unhandledrejection', (e) => {
                    sendToParent('error', ['Unhandled Promise Rejection: ' + e.reason]);
                });
            })();
        `;
    }

    // ------------------------------
    // 🪟 PREVIEW PANEL & FULLSCREEN
    // ------------------------------
    function setupPreviewAndResize() {
        const editorPanel = document.getElementById("editorPanel");
        let isResizing = false;

        elements.buttons.togglePreview.addEventListener("click", () => {
            isPreviewVisible = !isPreviewVisible;
            if (isPreviewVisible) {
                elements.previewPanel.style.display = "flex";
                elements.resizer.style.display = "block";
                editorPanel.style.width = `calc(100% - ${previewWidth})`;
                elements.previewPanel.style.width = previewWidth;
                elements.buttons.togglePreview.innerHTML = '<i class="bi bi-eye-slash" aria-hidden="true"></i> Aperçu';
                if (currentFile && detectLanguage(currentFile.name) === "html") generatePreview();
            } else {
                elements.previewPanel.style.display = "none";
                elements.resizer.style.display = "none";
                editorPanel.style.width = "100%";
                elements.buttons.togglePreview.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i> Aperçu';
            }
            if (editor) editor.layout();
        });

        elements.buttons.toggleFullScreen.addEventListener("click", async () => {
            const appContainer = document.querySelector(".app") || document.documentElement;
            if (!document.fullscreenElement) {
                try {
                    await appContainer.requestFullscreen();
                } catch (e) {
                    console.error("Failed to enter fullscreen:", e);
                    alert("Erreur: Le mode plein écran n'est pas supporté ou a été refusé.");
                }
            } else {
                await document.exitFullscreen();
            }
            if (editor) setTimeout(() => editor.layout(), 50);
        });

        elements.resizer.addEventListener("mousedown", () => {
            isResizing = true;
            document.body.style.cursor = "col-resize";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isResizing || !isPreviewVisible) return;
            const containerWidth = editorPanel.parentElement.offsetWidth;
            const newWidth = (e.clientX / containerWidth) * 100;
            if (newWidth > 15 && newWidth < 85) {
                editorPanel.style.width = `${newWidth}%`;
                elements.previewPanel.style.width = `${100 - newWidth}%`;
                previewWidth = `${100 - newWidth}%`;
            }
            if (editor) editor.layout();
        });

        document.addEventListener("mouseup", () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = "default";
                localStorage.setItem("previewWidth", previewWidth);
            }
        });
    }

    // ------------------------------
    // 🆕 NEW FEATURES
    // ------------------------------
    function showSnippetsModal() {
        const modal = document.createElement("div");
        modal.className = "snippets-modal";
        modal.innerHTML = `
            <div class="snippets-modal-content">
                <h2>Code Snippets</h2>
                <div class="snippets-list"></div>
                <button class="btn" id="closeSnippetsModal">Fermer</button>
            </div>
        `;
        document.body.appendChild(modal);
        const snippetsList = modal.querySelector(".snippets-list");
        snippets.forEach(snippet => {
            const item = document.createElement("div");
            item.className = "snippet-item";
            item.innerHTML = `<span>${snippet.name}</span>`;
            item.addEventListener("click", () => {
                if (!currentFile || !editor) {
                    elements.editorStatus.textContent = "Ouvrez un fichier pour insérer un snippet.";
                    return;
                }
                editor.executeEdits('', [{
                    range: editor.getSelection(),
                    text: snippet.code
                }]);
                monaco.editor.setModelLanguage(editor.getModel(), snippet.language);
                modal.remove();
                elements.editorStatus.textContent = `Snippet "${snippet.name}" inséré ✓`;
                saveProject();
            });
            snippetsList.appendChild(item);
        });
        modal.querySelector("#closeSnippetsModal").addEventListener("click", () => modal.remove());
        modal.style.display = "flex";
    }

    function toggleAutoSave() {
        autoSaveEnabled = !autoSaveEnabled;
        const btn = elements.buttons.autoSave;
        btn.classList.toggle("auto-save-on", autoSaveEnabled);
        btn.innerHTML = `<i class="bi bi-save2" aria-hidden="true"></i> Auto-Save ${autoSaveEnabled ? 'On' : 'Off'}`;
        if (autoSaveEnabled) {
            autoSaveInterval = setInterval(() => {
                if (currentFile) saveProject();
            }, 5000);
            elements.editorStatus.textContent = "Auto-Save activé ✓";
        } else {
            clearInterval(autoSaveInterval);
            elements.editorStatus.textContent = "Auto-Save désactivé";
        }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
            autoSave: autoSaveEnabled
        }));
    }

    function toggleFindReplace() {
        let panel = document.querySelector(".find-replace-panel");
        if (!panel) {
            panel = document.createElement("div");
            panel.className = "find-replace-panel";
            panel.innerHTML = `
                <input type="text" placeholder="Rechercher..." aria-label="Rechercher du texte">
                <input type="text" placeholder="Remplacer..." aria-label="Remplacer le texte">
                <button class="btn">Rechercher</button>
                <button class="btn">Remplacer</button>
                <button class="btn">Fermer</button>
            `;
            document.querySelector(".editorPanel").prepend(panel);
        }
        panel.classList.toggle("active");
        if (panel.classList.contains("active")) {
            const findInput = panel.querySelector('input[placeholder="Rechercher..."]');
            const replaceInput = panel.querySelector('input[placeholder="Remplacer..."]');
            const findBtn = panel.querySelectorAll(".btn")[0];
            const replaceBtn = panel.querySelectorAll(".btn")[1];
            const closeBtn = panel.querySelectorAll(".btn")[2];

            findBtn.addEventListener("click", () => {
                const query = findInput.value;
                if (query && editor) {
                    const model = editor.getModel();
                    const matches = model.findMatches(query, true, false, true, null, true);
                    if (matches.length) {
                        editor.setSelection(matches[0].range);
                        editor.revealRange(matches[0].range);
                        elements.editorStatus.textContent = `Trouvé ${matches.length} correspondance(s)`;
                    } else {
                        elements.editorStatus.textContent = "Aucune correspondance trouvée";
                    }
                }
            });

            replaceBtn.addEventListener("click", () => {
                const query = findInput.value;
                const replace = replaceInput.value;
                if (query && editor) {
                    const model = editor.getModel();
                    const matches = model.findMatches(query, true, false, true, null, true);
                    editor.pushUndoStop();
                    editor.executeEdits("replace", matches.map(m => ({
                        range: m.range,
                        text: replace
                    })));
                    elements.editorStatus.textContent = `Remplacé ${matches.length} occurrence(s)`;
                    saveProject();
                }
            });

            closeBtn.addEventListener("click", () => panel.classList.remove("active"));
            findInput.focus();
        }
    }

    function toggleSearchBar() {
        const searchBar = document.querySelector(".search-bar");
        if (!searchBar) {
            console.error("Search bar element not found. Please add <div class='search-bar'><input type='text' placeholder='Rechercher un fichier...'></div> to .explorer in HTML.");
            return;
        }
        searchBar.classList.toggle("active");
        const input = searchBar.querySelector("input");
        if (searchBar.classList.contains("active")) {
            input.focus();
            input.value = searchQuery;
            input.addEventListener("input", () => {
                searchQuery = input.value;
                expandAll();
                renderFileTree();
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    const firstFile = elements.fileTree.querySelector(".node-label:not(.root)");
                    if (firstFile) {
                        const path = firstFile.closest(".node-wrapper").getAttribute("data-path");
                        const node = findNodeByPath(path);
                        if (node && node.type === "file") openFile(node, path);
                    }
                } else if (e.key === "Escape") {
                    searchQuery = "";
                    input.value = "";
                    searchBar.classList.remove("active");
                    renderFileTree();
                }
            });
        } else {
            searchQuery = "";
            input.value = "";
            renderFileTree();
        }
    }

    function toggleSettingsPanel() {
        let panel = document.querySelector(".settings-panel");
        if (!panel) {
            panel = document.createElement("div");
            panel.className = "settings-panel";
            panel.innerHTML = `
                <h2>Paramètres de l'éditeur</h2>
                <label>Font Size:
                    <select id="fontSize">
                        <option value="12">12px</option>
                        <option value="14">14px</option>
                        <option value="16">16px</option>
                    </select>
                </label>
                <label>Word Wrap:
                    <input type="checkbox" id="wordWrap">
                </label>
                <button class="btn" id="closeSettingsPanel">Fermer</button>
            `;
            document.body.appendChild(panel);
        }
        panel.classList.toggle("active");
        if (panel.classList.contains("active")) {
            const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            const fontSizeSelect = panel.querySelector("#fontSize");
            const wordWrapCheckbox = panel.querySelector("#wordWrap");
            const closeBtn = panel.querySelector("#closeSettingsPanel");

            fontSizeSelect.value = savedSettings.fontSize || editor.getOptions().fontSize;
            wordWrapCheckbox.checked = savedSettings.wordWrap === "on";

            fontSizeSelect.addEventListener("change", () => {
                const fontSize = parseInt(fontSizeSelect.value);
                editor.updateOptions({ fontSize });
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                    ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
                    fontSize
                }));
                elements.editorStatus.textContent = "Taille de police mise à jour ✓";
            });

            wordWrapCheckbox.addEventListener("change", () => {
                const wordWrap = wordWrapCheckbox.checked ? "on" : "off";
                editor.updateOptions({ wordWrap });
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                    ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
                    wordWrap
                }));
                elements.editorStatus.textContent = "Retour à la ligne mis à jour ✓";
            });

            closeBtn.addEventListener("click", () => panel.classList.remove("active"));
        }
    }

    // ------------------------------
    // 🧠 UI BINDERS
    // ------------------------------
    function bindUI() {
        // Main toolbar buttons
        elements.buttons.projects.addEventListener("click", () => {
            renderProjectList();
            const modal = document.getElementById("projectListModal");
            if (modal) modal.style.display = "block";
        });
        elements.buttons.newFile.addEventListener("click", createNewFile);
        elements.buttons.newFolder.addEventListener("click", createNewFolder);
        elements.buttons.saveFile.addEventListener("click", saveCurrentFile);
        elements.buttons.run.addEventListener("click", runPreview);
        elements.buttons.format.addEventListener("click", () => {
            if (editor) editor.getAction("editor.action.formatDocument").run();
        });
        elements.buttons.downloadZip.addEventListener("click", () => downloadFolderAsZip(projectData));
        elements.buttons.importZip.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".zip";
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const zip = await JSZip.loadAsync(file);
                const tempRoot = { name: "root", type: "folder", children: [] };
                const nodeMap = { "": tempRoot };
                const files = Object.entries(zip.files).sort(([a], [b]) => a.localeCompare(b));
                for (let [path, obj] of files) {
                    path = path.startsWith("/") ? path.substring(1) : path;
                    const pathParts = path.split("/");
                    let currentPath = "";
                    let currentParentNode = tempRoot;
                    for (let i = 0; i < pathParts.length - (obj.dir ? 0 : 1); i++) {
                        const part = pathParts[i];
                        const parentPath = currentPath;
                        currentPath += (currentPath ? "/" : "") + part;
                        if (!nodeMap[currentPath]) {
                            const newFolder = { name: part, type: "folder", children: [], _expanded: true };
                            nodeMap[parentPath].children.push(newFolder);
                            nodeMap[currentPath] = newFolder;
                        }
                        currentParentNode = nodeMap[currentPath];
                    }
                    if (!obj.dir) {
                        let content;
                        if (isTextFile(path)) {
                            content = await obj.async("string");
                        } else {
                            const blob = await obj.async("blob");
                            content = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onload = (e) => resolve(e.target.result);
                                reader.readAsDataURL(blob);
                            });
                        }
                        const fileName = pathParts[pathParts.length - 1];
                        currentParentNode.children.push({ name: fileName, type: "file", content });
                    }
                }
                projectData = assignPaths(tempRoot);
                saveProject();
                renderFileTree();
                const htmlFile = findFirstHtmlFile(projectData);
                if (htmlFile) openFile(htmlFile, htmlFile.path);
            };
            input.click();
        });
        elements.buttons.clearStorage.addEventListener("click", clearStorage);
        elements.buttons.undo.addEventListener("click", undoEdit);
        elements.buttons.refreshPreview.addEventListener("click", runPreview);
        elements.buttons.expandAll.addEventListener("click", expandAll);
        elements.buttons.collapseAll.addEventListener("click", collapseAll);
        elements.buttons.rename.addEventListener("click", () => renameNode(currentFile));
        elements.buttons.closeTab.addEventListener("click", () => {
            if (currentFile) closeTab(currentFile.path);
        });
        elements.buttons.search.addEventListener("click", toggleSearchBar);
        elements.buttons.snippets?.addEventListener("click", showSnippetsModal);
        elements.buttons.autoSave?.addEventListener("click", toggleAutoSave);
        elements.buttons.findReplace?.addEventListener("click", toggleFindReplace);
        elements.buttons.settings?.addEventListener("click", toggleSettingsPanel);

        // File input
        const fileInput = document.getElementById("fileInput");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                if (e.target.files.length > 0) {
                    processFileInput(Array.from(e.target.files));
                }
                e.target.value = null;
            });
        }

        // Context menu actions
        const ctxActions = {
            open: () => {
                if (currentContextNode.type === "file") openFile(currentContextNode, currentContextNode.path);
            },
            rename: () => renameNode(currentContextNode),
            duplicate: () => duplicateNode(currentContextNode),
            delete: () => deleteSelectedNode(currentContextNode),
            download: () => downloadNode(currentContextNode),
        };

        document.querySelectorAll("#ctx button").forEach((btn) => {
            const act = btn.dataset.act;
            if (ctxActions[act]) {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    ctxActions[act]();
                    elements.contextMenu.style.display = "none";
                });
            }
        });

        // Console messages
        window.addEventListener("message", (e) => {
            if (e.data.type === "console") {
                const msgEl = document.createElement("div");
                msgEl.textContent = `[${e.data.level.toUpperCase()}] ${e.data.message}`;
                msgEl.style.color = e.data.level === "error" ? "red" : e.data.level === "warn" ? "orange" : "white";
                elements.previewConsole.appendChild(msgEl);
                elements.previewConsole.scrollTop = elements.previewConsole.scrollHeight;
            }
        });
    }

    // ------------------------------
    // 🗂 PROJECT MANAGEMENT UI
    // ------------------------------
    function renderProjectList() {
        let modal = document.getElementById("projectListModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "projectListModal";
            modal.className = "modal";
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>Projets</h2>
                    <button id="newProjectBtn" class="btn primary">Nouveau Projet</button>
                    <div id="projectList"></div>
                    <button id="closeProjectModal" class="btn">Fermer</button>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById("newProjectBtn").addEventListener("click", createNewProject);
            document.getElementById("closeProjectModal").addEventListener("click", () => (modal.style.display = "none"));
        }
        const list = document.getElementById("projectList");
        list.innerHTML = "";
        projects.forEach((project) => {
            const item = document.createElement("div");
            item.className = "project-item" + (project.id === currentProjectId ? " active" : "");
            item.innerHTML = `
                <span>${project.name}</span>
                <button class="rename-btn btn" data-project-id="${project.id}">Renommer</button>
                <button class="delete-btn btn" data-project-id="${project.id}">Supprimer</button>
            `;
            item.addEventListener("click", () => openProject(project.id));
            item.querySelector(".rename-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                renameProject(project.id);
            });
            item.querySelector(".delete-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteProject(project.id);
            });
            list.appendChild(item);
        });
        modal.style.display = "block";
    }

    // ------------------------------
    // ⌨️ KEYBOARD SHORTCUTS
    // ------------------------------
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "s") {
            e.preventDefault();
            saveCurrentFile();
        }
        if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            runPreview();
        }
        if (e.ctrlKey && e.key === "f") {
            e.preventDefault();
            if (editor) editor.getAction("editor.action.formatDocument").run();
        }
        if (e.ctrlKey && e.key === "z") {
            e.preventDefault();
            undoEdit();
        }
        if (e.ctrlKey && e.key === "h") {
            e.preventDefault();
            toggleFindReplace();
        }
    });

    // Initialize preview and resize handlers
    window.addEventListener("DOMContentLoaded", setupPreviewAndResize);
})();
