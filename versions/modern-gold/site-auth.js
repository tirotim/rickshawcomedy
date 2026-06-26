(function () {
  var SESSION_KEY = "rsc-site-auth-hash";
  var configUrl = "./site-auth-config.json";
  if (document.currentScript && document.currentScript.src) {
    configUrl = document.currentScript.src.replace(/[^/]+$/, "") + "site-auth-config.json";
  }
  var configPromise = fetch(configUrl, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) {
        throw new Error("missing config");
      }
      return res.json();
    })
    .catch(function () {
      return { enabled: false };
    });

  function sha256Fallback(text) {
    function rotr(n, x) {
      return (x >>> n) | (x << (32 - n));
    }
    function ch(x, y, z) {
      return (x & y) ^ (~x & z);
    }
    function maj(x, y, z) {
      return (x & y) ^ (x & z) ^ (y & z);
    }
    function sigma0(x) {
      return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
    }
    function sigma1(x) {
      return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
    }
    function gamma0(x) {
      return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
    }
    function gamma1(x) {
      return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
    }

    var bytes = new TextEncoder().encode(String(text));
    var bitLen = bytes.length * 8;
    var withOne = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
    withOne.set(bytes);
    withOne[bytes.length] = 0x80;
    new DataView(withOne.buffer).setUint32(withOne.length - 4, bitLen);

    var h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    var k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    for (var offset = 0; offset < withOne.length; offset += 64) {
      var w = new Uint32Array(64);
      for (var i = 0; i < 16; i++) {
        w[i] =
          (withOne[offset + i * 4] << 24) |
          (withOne[offset + i * 4 + 1] << 16) |
          (withOne[offset + i * 4 + 2] << 8) |
          withOne[offset + i * 4 + 3];
      }
      for (var j = 16; j < 64; j++) {
        w[j] = (gamma1(w[j - 2]) + w[j - 7] + gamma0(w[j - 15]) + w[j - 16]) >>> 0;
      }

      var a = h[0];
      var b = h[1];
      var c = h[2];
      var d = h[3];
      var e = h[4];
      var f = h[5];
      var g = h[6];
      var hh = h[7];

      for (var t = 0; t < 64; t++) {
        var t1 = (hh + sigma1(e) + ch(e, f, g) + k[t] + w[t]) >>> 0;
        var t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
        hh = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }

      h[0] = (h[0] + a) >>> 0;
      h[1] = (h[1] + b) >>> 0;
      h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0;
      h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0;
      h[7] = (h[7] + hh) >>> 0;
    }

    return h
      .map(function (word) {
        return word.toString(16).padStart(8, "0");
      })
      .join("");
  }

  function sha256(text) {
    if (window.crypto && window.crypto.subtle && window.isSecureContext) {
      var encoded = new TextEncoder().encode(String(text));
      return window.crypto.subtle.digest("SHA-256", encoded).then(function (digest) {
        return Array.from(new Uint8Array(digest))
          .map(function (byte) {
            return byte.toString(16).padStart(2, "0");
          })
          .join("");
      });
    }
    return Promise.resolve(sha256Fallback(text));
  }

  function unlock() {
    document.documentElement.classList.remove("site-auth-pending");
    var overlay = document.getElementById("site-auth-overlay");
    if (overlay) {
      overlay.hidden = true;
    }
  }

  function buildOverlay(config) {
    var overlay = document.createElement("div");
    overlay.id = "site-auth-overlay";
    overlay.className = "site-auth-overlay";
    overlay.innerHTML =
      '<div class="site-auth-panel" role="dialog" aria-modal="true" aria-labelledby="site-auth-title">' +
      "<h1 id=\"site-auth-title\">" +
      escapeHtml(config.title || "Password required") +
      "</h1>" +
      "<p>" +
      escapeHtml(config.message || "Enter the password to view this site.") +
      "</p>" +
      '<form class="site-auth-form">' +
      '<label class="site-auth-label">Password<input class="site-auth-input" type="password" autocomplete="current-password" required /></label>' +
      '<button type="submit" class="site-auth-submit">Enter site</button>' +
      '<p class="site-auth-error" aria-live="polite"></p>' +
      "</form></div>";
    document.body.appendChild(overlay);

    var form = overlay.querySelector(".site-auth-form");
    var input = overlay.querySelector(".site-auth-input");
    var error = overlay.querySelector(".site-auth-error");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      sha256(input.value)
        .then(function (hash) {
          if (hash !== config.passwordHash) {
            error.textContent = "Incorrect password.";
            input.select();
            return;
          }
          try {
            sessionStorage.setItem(SESSION_KEY, hash);
          } catch (err) {
            /* ignore */
          }
          unlock();
        })
        .catch(function (err) {
          error.textContent = err.message || "Could not verify password.";
        });
    });

    input.focus();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.documentElement.classList.add("site-auth-pending");

  configPromise.then(function (config) {
    if (!config || !config.enabled || !config.passwordHash) {
      unlock();
      return;
    }

    var stored = "";
    try {
      stored = sessionStorage.getItem(SESSION_KEY) || "";
    } catch (err) {
      /* ignore */
    }

    if (stored && stored === config.passwordHash) {
      unlock();
      return;
    }

    if (document.body) {
      buildOverlay(config);
      return;
    }

    document.addEventListener("DOMContentLoaded", function () {
      buildOverlay(config);
    });
  });
})();
