#!/usr/bin/env node
/**
 * Local API for image edit mode (save overrides, list/upload media).
 * Run: node scripts/editimg-api.js  (default http://localhost:8082)
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "versions", "modern-gold");
const CONTENT = path.join(ROOT, "content", "pages");
const OVERRIDES_FILE = path.join(CONTENT, "image-overrides.json");
const PORT = Number(process.env.EDITIMG_PORT || 8082);

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]);

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
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

function toPublicPath(absPath) {
  var rel = path.relative(SITE, absPath).split(path.sep).join("/");
  return "./" + rel;
}

function scanDir(dir, base, out) {
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full, base, out);
      return;
    }
    var ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      return;
    }
    out.push({
      path: toPublicPath(full),
      name: name,
      folder: path.relative(base, dir).split(path.sep).join("/") || "site root",
    });
  });
}

function buildMediaList() {
  var items = [];
  scanDir(path.join(SITE, "gallery"), SITE, items);
  fs.readdirSync(SITE).forEach(function (name) {
    var full = path.join(SITE, name);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return;
    }
    var ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      return;
    }
    items.push({
      path: toPublicPath(full),
      name: name,
      folder: "site root",
    });
  });
  items.sort(function (a, b) {
    return a.path.localeCompare(b.path);
  });
  return items;
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function normalizeCmsImage(value) {
  if (!value) {
    return "";
  }
  var cleaned = String(value).trim().replace(/^\/+/, "");
  cleaned = cleaned.replace(/^\.\//, "");
  cleaned = cleaned.replace(/^versions\/modern-gold\//, "");
  if (cleaned.startsWith("gallery/")) {
    return cleaned;
  }
  return cleaned;
}

const server = http.createServer(async function (req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.method === "GET" && req.url === "/api/editimg/media") {
    send(res, 200, { items: buildMediaList() });
    return;
  }

  if (req.method === "POST" && req.url === "/api/editimg/save") {
    try {
      var payload = JSON.parse(await readBody(req));
      var page = payload.page;
      var changes = Array.isArray(payload.changes) ? payload.changes : [];
      if (!page) {
        send(res, 400, { error: "Missing page" });
        return;
      }

      var overrides = readJson(OVERRIDES_FILE, {});
      if (!overrides[page]) {
        overrides[page] = {};
      }

      var bindsByFile = {};

      changes.forEach(function (change) {
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
            bindsByFile[file].push({ key: key, value: normalizeCmsImage(change.to) });
          }
        }
      });

      writeJson(OVERRIDES_FILE, overrides);

      Object.keys(bindsByFile).forEach(function (file) {
        var filePath = path.join(CONTENT, file);
        if (!fs.existsSync(filePath)) {
          return;
        }
        var data = readJson(filePath, null);
        if (!data) {
          return;
        }
        bindsByFile[file].forEach(function (bind) {
          setByPath(data, bind.key, bind.value);
        });
        writeJson(filePath, data);
      });

      send(res, 200, { ok: true, message: "Saved. Run npm run build:site to refresh pages." });
    } catch (err) {
      send(res, 500, { error: err.message || "Save failed" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/editimg/upload") {
    try {
      var raw = await readBody(req);
      var upload = JSON.parse(raw);
      var filename = path.basename(String(upload.filename || "upload.jpg"));
      var data = upload.data || "";
      if (!filename || !data) {
        send(res, 400, { error: "Missing filename or data" });
        return;
      }
      var buffer = Buffer.from(data, "base64");
      var dest = path.join(SITE, "gallery", filename);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buffer);
      send(res, 200, { ok: true, path: toPublicPath(dest) });
    } catch (err) {
      send(res, 500, { error: err.message || "Upload failed" });
    }
    return;
  }

  send(res, 404, { error: "Not found" });
});

server.listen(PORT, function () {
  console.log("Image edit API on http://localhost:" + PORT);
});
