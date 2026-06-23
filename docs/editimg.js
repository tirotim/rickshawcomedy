(function () {
  var API_BASE = window.RSC_EDITIMG_API || "http://localhost:8082";

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

  var page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page || page === "" || page === "editimg") {
    page = "index.html";
  }
  var exitHref = page === "index.html" ? "./" : "./" + page.replace(/\.html$/, "") + ".html";

  var pending = [];
  var activeImg = null;
  var mediaItems = [];

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

  function mountToolbar() {
    var bar = document.createElement("div");
    bar.className = "editimg-toolbar";
    bar.innerHTML =
      '<div class="editimg-toolbar-inner">' +
      '<p class="editimg-toolbar-title"><strong>Image edit mode</strong> — click Replace on any image</p>' +
      '<div class="editimg-toolbar-actions">' +
      '<button type="button" class="btn btn-primary" data-editimg-save>Save changes</button>' +
      '<a class="btn btn-secondary" href="' +
      escapeAttr(exitHref) +
      '">Exit</a>' +
      "</div>" +
      '<p class="editimg-toolbar-note" data-editimg-status>Run <code>node scripts/editimg-api.js</code> locally to save.</p>' +
      "</div>";
    document.body.appendChild(bar);
    return bar;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
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
      openPicker(img, original);
    });
    wrap.appendChild(btn);
  }

  function openPicker(img, original) {
    activeImg = img;
    var modal = document.getElementById("editimg-modal");
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.hidden = false;
    document.body.classList.add("editimg-modal-open");
    renderMediaGrid(modal.querySelector(".editimg-media-grid"));
    modal.querySelector(".editimg-modal-title").textContent = "Choose replacement image";
  }

  function closePicker() {
    var modal = document.getElementById("editimg-modal");
    if (modal) {
      modal.hidden = true;
    }
    document.body.classList.remove("editimg-modal-open");
    activeImg = null;
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
      '<label class="editimg-upload-btn btn btn-secondary">Upload image<input type="file" accept="image/*" data-editimg-upload hidden /></label>' +
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
    if (!mediaItems.length) {
      grid.innerHTML = '<p class="editimg-empty">No images found. Upload one or run the build to refresh the library.</p>';
      return;
    }
    grid.innerHTML = mediaItems
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

    grid.querySelectorAll("[data-editimg-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var picked = btn.getAttribute("data-editimg-pick");
        applyReplacement(activeImg, picked);
        closePicker();
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function applyReplacement(img, newSrc) {
    if (!img) {
      return;
    }
    var wrap = img.closest(".editimg-wrap");
    var from = wrap ? wrap.dataset.editimgOriginal : normalizeSrc(img.getAttribute("src") || "");
    var to = normalizeSrc(newSrc);
    img.setAttribute("src", to);
    if (wrap) {
      wrap.classList.add("is-changed");
    }

    var bind = img.getAttribute("data-editimg-bind") || "";
    var existing = pending.findIndex(function (item) {
      if (bind && item.bind) {
        return item.bind === bind;
      }
      return item.from === from && !item.bind && !bind;
    });
    var entry = { from: from, to: to, bind: bind };
    if (existing >= 0) {
      pending[existing] = entry;
    } else {
      pending.push(entry);
    }
    setStatus(pending.length ? pending.length + " image(s) ready to save." : "No pending changes.");
  }

  function setStatus(message, isError) {
    var el = document.querySelector("[data-editimg-status]");
    if (!el) {
      return;
    }
    el.textContent = message;
    el.classList.toggle("is-error", !!isError);
  }

  function loadMedia() {
    return fetch(API_BASE + "/api/editimg/media")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        mediaItems = (data && data.items) || [];
      })
      .catch(function () {
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
      });
  }

  function uploadMedia(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result || "").split(",")[1] || "";
      fetch(API_BASE + "/api/editimg/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.path) {
            throw new Error((data && data.error) || "Upload failed");
          }
          mediaItems.unshift({ path: data.path, name: file.name, folder: "gallery" });
          renderMediaGrid(document.querySelector(".editimg-media-grid"));
          setStatus("Uploaded " + file.name);
        })
        .catch(function (err) {
          setStatus(err.message || "Upload failed. Is editimg-api running?", true);
        });
    };
    reader.readAsDataURL(file);
  }

  function saveChanges() {
    if (!pending.length) {
      setStatus("No changes to save.");
      return;
    }
    fetch(API_BASE + "/api/editimg/save", {
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
        pending = [];
        document.querySelectorAll(".editimg-wrap.is-changed").forEach(function (wrap) {
          wrap.classList.remove("is-changed");
          wrap.dataset.editimgOriginal = normalizeSrc(wrap.querySelector("img").getAttribute("src") || "");
        });
        setStatus(data.message || "Saved.");
      })
      .catch(function (err) {
        setStatus(err.message || "Save failed. Run: node scripts/editimg-api.js", true);
      });
  }

  document.documentElement.classList.add("editimg-mode");
  var toolbar = mountToolbar();
  toolbar.querySelector("[data-editimg-save]").addEventListener("click", saveChanges);

  document.querySelectorAll("img").forEach(function (img) {
    if (shouldEditImage(img)) {
      wrapImage(img);
    }
  });

  loadMedia().then(function () {
    setStatus("Image edit mode active.");
  });
})();
