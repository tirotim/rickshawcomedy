(function () {
  var API_BASE = window.RSC_EDITIMG_API || "http://localhost:8082";
  var TOKEN_KEY = "rsc-editimg-token";
  var GITHUB = {
    owner: "tirotim",
    repo: "rickshawcomedy",
    branch: "main",
  };

  function isEditImgMode() {
    var path = window.location.pathname || "";
    var search = window.location.search || "";
    var hash = window.location.hash || "";
    return (
      /(?:^|[?&])editimg(?:[=&]|$)/.test(search) ||
      hash === "#editimg" ||
      /\/editimg\/?$/.test(path)
    );
  }

  if (!isEditImgMode()) {
    return;
  }

  var isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "";

  var page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page || page === "" || page === "editimg") {
    page = "index.html";
  }
  var exitHref = page === "index.html" ? "./" : "./" + page.replace(/\.html$/, "") + ".html";

  var pending = [];
  var activeTarget = null;
  var pickerMode = "image";
  var mediaItems = [];
  var githubToken = null;
  var saving = false;

  function normalizeSrc(src) {
    if (!src) {
      return "";
    }
    try {
      var url = new URL(src, window.location.href);
      var path = url.pathname;
      var base = window.location.pathname.replace(/[^/]+$/, "");
      if (base && path.indexOf(base) === 0) {
        path = path.slice(base.length);
      }
      return path.startsWith("./") ? path : "./" + path.replace(/^\/+/, "");
    } catch (err) {
      return src;
    }
  }

  function normalizeCmsImage(value) {
    if (!value) {
      return "";
    }
    var cleaned = String(value).trim().replace(/^\/+/, "");
    cleaned = cleaned.replace(/^\.\//, "");
    cleaned = cleaned.replace(/^versions\/modern-gold\//, "");
    return cleaned;
  }

  function normalizeCmsAudio(value) {
    if (!value) {
      return "";
    }
    var cleaned = String(value).trim().replace(/^\/+/, "");
    cleaned = cleaned.replace(/^\.\//, "");
    cleaned = cleaned.replace(/^versions\/modern-gold\//, "");
    return cleaned;
  }

  function normalizeCmsValueForBind(value, bind) {
    if (bind && String(bind).endsWith(".audio")) {
      return normalizeCmsAudio(value);
    }
    return normalizeCmsImage(value);
  }

  function pendingLabel(count) {
    return count ? count + " change(s) ready to save." : "No pending changes.";
  }

  function setByPath(obj, dotPath, value) {
    var parts = dotPath.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      var idx = Number(key);
      if (!Number.isNaN(idx) && String(idx) === key) {
        if (!Array.isArray(cur)) {
          return false;
        }
        cur = cur[idx];
      } else {
        if (!cur[key] || typeof cur[key] !== "object") {
          cur[key] = {};
        }
        cur = cur[key];
      }
    }
    var last = parts[parts.length - 1];
    var lastIdx = Number(last);
    if (!Number.isNaN(lastIdx) && String(lastIdx) === last) {
      cur[lastIdx] = value;
    } else {
      cur[last] = value;
    }
    return true;
  }

  function decodeGithubContent(b64) {
    var binary = atob(String(b64 || "").replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  function encodeGithubContent(text) {
    var bytes = new TextEncoder().encode(String(text));
    var binary = "";
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function readDecapToken() {
    var keys = ["netlify-cms-user", "decap-cms-user"];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) {
          continue;
        }
        var user = JSON.parse(raw);
        if (user && user.token) {
          return user.token;
        }
      } catch (err) {
        /* ignore */
      }
    }
    return null;
  }

  function getAuthToken() {
    if (githubToken) {
      return githubToken;
    }
    try {
      var stored = sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        githubToken = stored;
        return githubToken;
      }
    } catch (err) {
      /* ignore */
    }
    var decap = readDecapToken();
    if (decap) {
      githubToken = decap;
      return githubToken;
    }
    return null;
  }

  function clearAuthToken() {
    githubToken = null;
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function githubApi(token, method, apiPath, body) {
    return fetch("https://api.github.com" + apiPath, {
      method: method,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var message = (data && data.message) || "GitHub API error";
          if (res.status === 401) {
            clearAuthToken();
            updateAuthUi();
          }
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function getRepoFile(repoPath, token) {
    var encoded = repoPath
      .split("/")
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join("/");
    return fetch(
      "https://api.github.com/repos/" +
        GITHUB.owner +
        "/" +
        GITHUB.repo +
        "/contents/" +
        encoded +
        "?ref=" +
        encodeURIComponent(GITHUB.branch),
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    ).then(function (res) {
      if (res.status === 404) {
        return null;
      }
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error((data && data.message) || "Could not read " + repoPath);
        }
        return data;
      });
    });
  }

  function putRepoFile(repoPath, contentBase64, sha, message, token) {
    var encoded = repoPath
      .split("/")
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join("/");
    var payload = {
      message: message,
      content: contentBase64,
      branch: GITHUB.branch,
    };
    if (sha) {
      payload.sha = sha;
    }
    return githubApi(
      token,
      "PUT",
      "/repos/" + GITHUB.owner + "/" + GITHUB.repo + "/contents/" + encoded,
      payload
    );
  }

  function shouldEditImage(img) {
    if (!(img instanceof HTMLImageElement)) {
      return false;
    }
    if (img.closest(".editimg-ignore")) {
      return false;
    }
    if (img.classList.contains("brand-logo")) {
      return false;
    }
    if (img.closest(".editimg-toolbar")) {
      return false;
    }
    var rect = img.getBoundingClientRect();
    if (rect.width < 40 && rect.height < 40) {
      return false;
    }
    return true;
  }

  function shouldEditAudio(player) {
    if (!(player instanceof HTMLElement) || !player.classList.contains("nd-audio-player")) {
      return false;
    }
    if (player.closest(".editimg-ignore") || player.closest(".editimg-toolbar")) {
      return false;
    }
    var audio = player.querySelector("audio.nd-audio-el");
    if (!audio || !audio.getAttribute("data-editimg-bind")) {
      return false;
    }
    return true;
  }

  function enableAudioPlayer(player) {
    if (!player) {
      return;
    }
    player.classList.remove("nd-audio-player--missing");
    var btn = player.querySelector(".nd-audio-btn");
    if (!btn) {
      return;
    }
    btn.disabled = false;
    btn.setAttribute("aria-pressed", "false");
    if (!btn.querySelector(".nd-audio-btn-icon")) {
      var icon = document.createElement("span");
      icon.className = "nd-audio-btn-icon";
      icon.setAttribute("aria-hidden", "true");
      btn.insertBefore(icon, btn.firstChild);
    }
    var label = btn.querySelector(".nd-audio-btn-label");
    if (label) {
      label.textContent = "Play";
    }
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setStatus(message, isError) {
    var el = document.querySelector("[data-editimg-status]");
    if (!el) {
      return;
    }
    el.textContent = message;
    el.classList.toggle("is-error", !!isError);
  }

  function updateAuthUi() {
    var connectBtn = document.querySelector("[data-editimg-connect]");
    var saveBtn = document.querySelector("[data-editimg-save]");
    if (!connectBtn || !saveBtn) {
      return;
    }
    if (isLocal || getAuthToken()) {
      connectBtn.hidden = true;
      saveBtn.disabled = false;
    } else {
      connectBtn.hidden = false;
      saveBtn.disabled = true;
    }
  }

  function mountToolbar() {
    var note = isLocal
      ? 'Run <code>npm run editimg:api</code> locally to save.'
      : "Connect GitHub to save. The live site rebuilds automatically after each save.";
    var bar = document.createElement("div");
    bar.className = "editimg-toolbar";
    bar.innerHTML =
      '<div class="editimg-toolbar-inner">' +
      '<p class="editimg-toolbar-title"><strong>Media edit mode</strong> — click Replace on any image or audio sample</p>' +
      '<div class="editimg-toolbar-actions">' +
      '<button type="button" class="btn btn-secondary" data-editimg-connect hidden>Connect GitHub</button>' +
      '<button type="button" class="btn btn-primary" data-editimg-save>Save changes</button>' +
      '<a class="btn btn-secondary" href="' +
      escapeAttr(exitHref) +
      '">Exit</a>' +
      "</div>" +
      '<p class="editimg-toolbar-note" data-editimg-status>' +
      note +
      "</p>" +
      "</div>";
    document.body.appendChild(bar);
    return bar;
  }

  function openAuthModal() {
    var modal = document.getElementById("editimg-auth-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "editimg-auth-modal";
      modal.className = "editimg-modal";
      modal.innerHTML =
        '<div class="editimg-modal-panel editimg-auth-panel" role="dialog" aria-modal="true" aria-labelledby="editimg-auth-title">' +
        '<button type="button" class="editimg-modal-close" data-editimg-auth-close aria-label="Close">&times;</button>' +
        '<h2 id="editimg-auth-title" class="editimg-modal-title">Connect GitHub</h2>' +
        '<p class="editimg-auth-copy">To save media changes on the live site, sign in with a GitHub token that can edit this repository.</p>' +
        '<ol class="editimg-auth-steps">' +
        "<li>Open <a href=\"https://github.com/settings/tokens/new?scopes=repo&amp;description=Rick%20Shaw%20Comedy%20image%20edit\" target=\"_blank\" rel=\"noopener\">GitHub token settings</a> and create a classic token with <strong>repo</strong> scope.</li>" +
        "<li>Paste the token below. It is kept only for this browser session.</li>" +
        "<li>Alternatively, log in at <a href=\"./admin/\">Edit site (CMS)</a> first, then reload this page.</li>" +
        "</ol>" +
        '<label class="editimg-auth-label">GitHub token<input type="password" class="editimg-auth-input" data-editimg-token autocomplete="off" /></label>' +
        '<div class="editimg-auth-actions">' +
        '<button type="button" class="btn btn-primary" data-editimg-auth-save>Connect</button>' +
        '<button type="button" class="btn btn-secondary" data-editimg-auth-close>Cancel</button>' +
        "</div>" +
        '<p class="editimg-auth-error" data-editimg-auth-error hidden></p>' +
        "</div>";
      document.body.appendChild(modal);

      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.closest("[data-editimg-auth-close]")) {
          closeAuthModal();
        }
      });

      modal.querySelector("[data-editimg-auth-save]").addEventListener("click", function () {
        var input = modal.querySelector("[data-editimg-token]");
        var token = (input && input.value ? input.value : "").trim();
        var errorEl = modal.querySelector("[data-editimg-auth-error]");
        if (!token) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = "Enter a GitHub token.";
          }
          return;
        }
        githubApi(token, "GET", "/user", null)
          .then(function () {
            githubToken = token;
            try {
              sessionStorage.setItem(TOKEN_KEY, token);
            } catch (err) {
              /* ignore */
            }
            if (input) {
              input.value = "";
            }
            if (errorEl) {
              errorEl.hidden = true;
            }
            closeAuthModal();
            updateAuthUi();
            setStatus("Connected to GitHub. You can save media changes now.");
          })
          .catch(function (err) {
            if (errorEl) {
              errorEl.hidden = false;
              errorEl.textContent = err.message || "Could not connect.";
            }
          });
      });
    }
    modal.hidden = false;
    document.body.classList.add("editimg-modal-open");
  }

  function closeAuthModal() {
    var modal = document.getElementById("editimg-auth-modal");
    if (modal) {
      modal.hidden = true;
    }
    if (!document.getElementById("editimg-modal") || document.getElementById("editimg-modal").hidden) {
      document.body.classList.remove("editimg-modal-open");
    }
  }

  function wrapImage(img) {
    if (img.closest(".editimg-wrap")) {
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "editimg-wrap";
    var original = normalizeSrc(img.getAttribute("src") || "");
    wrap.dataset.editimgOriginal = original;
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "editimg-replace-btn";
    btn.textContent = "Replace";
    btn.addEventListener("click", function () {
      openImagePicker(img, original);
    });
    wrap.appendChild(btn);
  }

  function wrapAudioPlayer(player) {
    if (player.closest(".editimg-wrap")) {
      return;
    }
    var audio = player.querySelector("audio.nd-audio-el");
    if (!audio) {
      return;
    }
    var wrap = document.createElement("div");
    wrap.className = "editimg-wrap editimg-wrap-audio";
    var original = normalizeSrc(audio.getAttribute("src") || "");
    wrap.dataset.editimgOriginal = original;
    wrap.dataset.editimgType = "audio";
    player.parentNode.insertBefore(wrap, player);
    wrap.appendChild(player);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "editimg-replace-btn editimg-replace-btn--audio";
    btn.textContent = "Replace audio";
    btn.addEventListener("click", function () {
      openPicker({
        type: "audio",
        el: audio,
        wrap: wrap,
        original: original,
        bind: audio.getAttribute("data-editimg-bind") || "",
      });
    });
    wrap.appendChild(btn);
  }

  function openPicker(target) {
    activeTarget = target;
    pickerMode = target.type || "image";
    var modal = document.getElementById("editimg-modal");
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.hidden = false;
    document.body.classList.add("editimg-modal-open");
    var uploadInput = modal.querySelector("[data-editimg-upload]");
    var uploadLabel = modal.querySelector("[data-editimg-upload-label]");
    if (uploadInput) {
      uploadInput.accept = pickerMode === "audio" ? "audio/*" : "image/*";
    }
    if (uploadLabel) {
      uploadLabel.textContent = pickerMode === "audio" ? "Upload audio" : "Upload image";
    }
    renderMediaGrid(modal.querySelector(".editimg-media-grid"));
    modal.querySelector(".editimg-modal-title").textContent =
      pickerMode === "audio" ? "Choose replacement audio" : "Choose replacement image";
  }

  function openImagePicker(img, original) {
    openPicker({
      type: "image",
      el: img,
      wrap: img.closest(".editimg-wrap"),
      original: original,
      bind: img.getAttribute("data-editimg-bind") || "",
    });
  }

  function closePicker() {
    var modal = document.getElementById("editimg-modal");
    if (modal) {
      modal.hidden = true;
    }
    if (!document.getElementById("editimg-auth-modal") || document.getElementById("editimg-auth-modal").hidden) {
      document.body.classList.remove("editimg-modal-open");
    }
    activeTarget = null;
    pickerMode = "image";
  }

  function buildModal() {
    var modal = document.createElement("div");
    modal.id = "editimg-modal";
    modal.className = "editimg-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="editimg-modal-panel" role="dialog" aria-modal="true" aria-labelledby="editimg-modal-title">' +
      '<button type="button" class="editimg-modal-close" data-editimg-close aria-label="Close">&times;</button>' +
      '<h2 id="editimg-modal-title" class="editimg-modal-title">Media library</h2>' +
      '<div class="editimg-modal-toolbar">' +
      '<label class="editimg-upload-btn btn btn-secondary"><span data-editimg-upload-label>Upload image</span><input type="file" accept="image/*" data-editimg-upload hidden /></label>' +
      "</div>" +
      '<div class="editimg-media-grid" aria-live="polite"></div>' +
      "</div>";

    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.closest("[data-editimg-close]")) {
        closePicker();
      }
    });

    modal.querySelector("[data-editimg-upload]").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) {
        return;
      }
      uploadMedia(file);
      e.target.value = "";
    });

    return modal;
  }

  function renderMediaGrid(grid) {
    if (!grid) {
      return;
    }
    var items = mediaItems.filter(function (item) {
      return (item.type || "image") === pickerMode;
    });
    if (!items.length) {
      grid.innerHTML =
        '<p class="editimg-empty">No ' +
        (pickerMode === "audio" ? "audio files" : "images") +
        " found. Upload one or run the build to refresh the library.</p>";
      return;
    }
    if (pickerMode === "audio") {
      grid.innerHTML = items
        .map(function (item) {
          return (
            '<button type="button" class="editimg-media-item editimg-media-item--audio" data-editimg-pick="' +
            escapeAttr(item.path) +
            '">' +
            '<span class="editimg-audio-icon" aria-hidden="true"></span>' +
            '<span class="editimg-media-name">' +
            escapeHtml(item.name) +
            "</span>" +
            "</button>"
          );
        })
        .join("");
    } else {
      grid.innerHTML = items
        .map(function (item) {
          return (
            '<button type="button" class="editimg-media-item" data-editimg-pick="' +
            escapeAttr(item.path) +
            '">' +
            '<img src="' +
            escapeAttr(item.path) +
            '" alt="" loading="lazy" decoding="async" />' +
            '<span class="editimg-media-name">' +
            escapeHtml(item.name) +
            "</span>" +
            "</button>"
          );
        })
        .join("");
    }

    grid.querySelectorAll("[data-editimg-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var picked = btn.getAttribute("data-editimg-pick");
        applyReplacement(activeTarget, picked);
        closePicker();
      });
    });
  }

  function applyReplacement(target, newSrc) {
    if (!target || !target.el) {
      return;
    }
    var wrap = target.wrap;
    var from = wrap ? wrap.dataset.editimgOriginal : target.original || "";
    var to = normalizeSrc(newSrc);
    var bind = target.bind || "";

    if (target.type === "audio") {
      var audio = target.el;
      var player = audio.closest(".nd-audio-player");
      audio.removeAttribute("hidden");
      audio.setAttribute("src", to);
      enableAudioPlayer(player);
    } else {
      target.el.setAttribute("src", to);
    }

    if (wrap) {
      wrap.classList.add("is-changed");
    }

    var existing = pending.findIndex(function (item) {
      if (bind && item.bind) {
        return item.bind === bind;
      }
      return item.from === from && !item.bind && !bind;
    });
    var entry = { from: from, to: to, bind: bind, type: target.type || "image" };
    if (existing >= 0) {
      pending[existing] = entry;
    } else {
      pending.push(entry);
    }
    setStatus(pendingLabel(pending.length));
  }

  function loadMedia() {
    if (isLocal) {
      return fetch(API_BASE + "/api/editimg/media")
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          mediaItems = (data && data.items) || [];
        })
        .catch(function () {
          return loadMediaFromJson();
        });
    }
    return loadMediaFromJson();
  }

  function loadMediaFromJson() {
    return fetch("./media-library.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        mediaItems = (data && data.items) || [];
      })
      .catch(function () {
        mediaItems = [];
      });
  }

  function uploadMediaLocal(file, base64) {
    return fetch(API_BASE + "/api/editimg/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, data: base64, type: pickerMode }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.path) {
          throw new Error((data && data.error) || "Upload failed");
        }
        return data.path;
      });
  }

  function uploadMediaGithub(file, base64, token) {
    var filename = String(file.name || (pickerMode === "audio" ? "upload.mp3" : "upload.jpg")).replace(
      /^.*[\\/]/,
      ""
    );
    var repoPath =
      pickerMode === "audio"
        ? "versions/modern-gold/audio/" + filename
        : "versions/modern-gold/gallery/" + filename;
    var publicPath = pickerMode === "audio" ? "./audio/" + filename : "./gallery/" + filename;
    return getRepoFile(repoPath, token).then(function (existing) {
      return putRepoFile(
        repoPath,
        base64,
        existing && existing.sha,
        "Upload " + (pickerMode === "audio" ? "audio" : "image") + " " + filename + " via editimg",
        token
      ).then(function () {
        return publicPath;
      });
    });
  }

  function uploadMedia(file) {
    var token = getAuthToken();
    if (!isLocal && !token) {
      setStatus("Connect GitHub before uploading new media.", true);
      openAuthModal();
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result || "").split(",")[1] || "";
      var uploadPromise = isLocal
        ? uploadMediaLocal(file, base64)
        : uploadMediaGithub(file, base64, token);

      uploadPromise
        .then(function (path) {
          mediaItems.unshift({
            path: path,
            name: file.name,
            folder: pickerMode === "audio" ? "audio" : "gallery",
            type: pickerMode,
          });
          renderMediaGrid(document.querySelector(".editimg-media-grid"));
          setStatus("Uploaded " + file.name);
        })
        .catch(function (err) {
          setStatus(err.message || "Upload failed.", true);
        });
    };
    reader.readAsDataURL(file);
  }

  function saveChangesLocal() {
    return fetch(API_BASE + "/api/editimg/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, changes: pending }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "Save failed");
        }
        return data.message || "Saved.";
      });
  }

  function saveChangesGithub(token) {
    var overridesPath = "content/pages/image-overrides.json";
    var bindsByFile = {};

    return getRepoFile(overridesPath, token)
      .then(function (overridesFile) {
        var overrides = {};
        if (overridesFile && overridesFile.content) {
          overrides = JSON.parse(decodeGithubContent(overridesFile.content));
        }
        if (!overrides[page]) {
          overrides[page] = {};
        }

        pending.forEach(function (change) {
          if (!change || !change.from || !change.to) {
            return;
          }
          overrides[page][change.from] = change.to;
          if (change.bind) {
            var parts = String(change.bind).split(":");
            if (parts.length === 2) {
              var file = parts[0];
              var key = parts[1];
              if (!bindsByFile[file]) {
                bindsByFile[file] = [];
              }
              bindsByFile[file].push({ key: key, value: normalizeCmsValueForBind(change.to, key) });
            }
          }
        });

        return putRepoFile(
          overridesPath,
          encodeGithubContent(JSON.stringify(overrides, null, 2) + "\n"),
          overridesFile && overridesFile.sha,
          "Update image overrides for " + page,
          token
        ).then(function () {
          var files = Object.keys(bindsByFile);
          var chain = Promise.resolve();
          files.forEach(function (file) {
            chain = chain.then(function () {
              var cmsPath = "content/pages/" + file;
              return getRepoFile(cmsPath, token).then(function (cmsFile) {
                if (!cmsFile || !cmsFile.content) {
                  return;
                }
                var data = JSON.parse(decodeGithubContent(cmsFile.content));
                bindsByFile[file].forEach(function (bind) {
                  setByPath(data, bind.key, bind.value);
                });
                return putRepoFile(
                  cmsPath,
                  encodeGithubContent(JSON.stringify(data, null, 2) + "\n"),
                  cmsFile.sha,
                  "Update media in " + file + " via editimg",
                  token
                );
              });
            });
          });
          return chain;
        });
      })
      .then(function () {
        return "Saved to GitHub. The live site rebuilds automatically in 1–2 minutes.";
      });
  }

  function clearChangedWraps() {
    document.querySelectorAll(".editimg-wrap.is-changed").forEach(function (wrap) {
      wrap.classList.remove("is-changed");
      if (wrap.dataset.editimgType === "audio") {
        var audio = wrap.querySelector("audio.nd-audio-el");
        wrap.dataset.editimgOriginal = normalizeSrc((audio && audio.getAttribute("src")) || "");
        return;
      }
      var img = wrap.querySelector("img");
      wrap.dataset.editimgOriginal = normalizeSrc((img && img.getAttribute("src")) || "");
    });
  }

  function saveChanges() {
    if (saving) {
      return;
    }
    if (!pending.length) {
      setStatus("No changes to save.");
      return;
    }

    if (isLocal) {
      saving = true;
      setStatus("Saving...");
      saveChangesLocal()
        .then(function (message) {
          pending = [];
          clearChangedWraps();
          setStatus(message);
        })
        .catch(function (err) {
          setStatus(err.message || "Save failed. Run: npm run editimg:api", true);
        })
        .finally(function () {
          saving = false;
        });
      return;
    }

    var token = getAuthToken();
    if (!token) {
      setStatus("Connect GitHub before saving.", true);
      openAuthModal();
      return;
    }

    saving = true;
    setStatus("Saving to GitHub...");
    saveChangesGithub(token)
      .then(function (message) {
        pending = [];
        clearChangedWraps();
        setStatus(message);
      })
      .catch(function (err) {
        setStatus(err.message || "Save failed.", true);
      })
      .finally(function () {
        saving = false;
      });
  }

  function loadGithubConfig() {
    return fetch("./editimg-config.json")
      .then(function (res) {
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) {
          return;
        }
        if (data.githubOwner) {
          GITHUB.owner = data.githubOwner;
        }
        if (data.githubRepo) {
          GITHUB.repo = data.githubRepo;
        }
        if (data.githubBranch) {
          GITHUB.branch = data.githubBranch;
        }
      })
      .catch(function () {
        /* defaults are fine */
      });
  }

  document.documentElement.classList.add("editimg-mode");
  var toolbar = mountToolbar();
  toolbar.querySelector("[data-editimg-save]").addEventListener("click", saveChanges);
  toolbar.querySelector("[data-editimg-connect]").addEventListener("click", openAuthModal);

  document.querySelectorAll("img").forEach(function (img) {
    if (shouldEditImage(img)) {
      wrapImage(img);
    }
  });

  document.querySelectorAll(".nd-audio-player").forEach(function (player) {
    if (shouldEditAudio(player)) {
      wrapAudioPlayer(player);
    }
  });

  loadGithubConfig().then(function () {
    updateAuthUi();
    return loadMedia();
  }).then(function () {
    if (isLocal) {
      setStatus("Media edit mode active.");
      return;
    }
    if (getAuthToken()) {
      setStatus("Media edit mode active. Connected to GitHub.");
      return;
    }
    setStatus("Media edit mode active. Connect GitHub to save changes on the live site.");
  });
})();
