(function () {
  var form = document.getElementById("contact-form");
  var configEl = document.getElementById("contact-form-config");
  if (!form || !configEl) {
    return;
  }

  var config;
  try {
    config = JSON.parse(configEl.textContent || "{}");
  } catch (err) {
    return;
  }

  var statusEl = form.querySelector(".contact-form-status");
  var submitBtn = form.querySelector(".contact-submit");
  var turnstileEl = document.getElementById("contact-turnstile");
  var turnstileWidgetId = null;
  var turnstileReady = false;

  function setStatus(message, isError) {
    if (!statusEl) {
      return;
    }
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.classList.toggle("is-success", !!message && !isError);
  }

  function loadTurnstile(siteKey, callback) {
    if (!siteKey || !turnstileEl) {
      callback();
      return;
    }

    function init() {
      if (!window.turnstile) {
        callback();
        return;
      }
      turnstileWidgetId = window.turnstile.render(turnstileEl, {
        sitekey: siteKey,
        theme: "light",
        callback: function () {
          turnstileReady = true;
        },
        "expired-callback": function () {
          turnstileReady = false;
        },
        "error-callback": function () {
          turnstileReady = false;
        },
      });
      callback();
    }

    if (window.turnstile) {
      init();
      return;
    }

    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = callback;
    document.head.appendChild(script);
  }

  loadTurnstile(config.turnstileSiteKey, function () {});

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setStatus("", false);

    if (!config.web3formsAccessKey) {
      setStatus("The contact form is not fully configured yet. Please try again later.", true);
      return;
    }

    var honeypot = form.querySelector('[name="botcheck"]');
    if (honeypot && honeypot.value) {
      setStatus(config.successMessage, false);
      form.reset();
      return;
    }

    if (config.turnstileSiteKey && window.turnstile) {
      var token = turnstileWidgetId !== null ? window.turnstile.getResponse(turnstileWidgetId) : "";
      if (!token) {
        setStatus("Please complete the security check before sending.", true);
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    var payload = {
      access_key: config.web3formsAccessKey,
      subject: config.subject || "Rick Shaw Comedy — website enquiry",
    };

    Array.prototype.forEach.call(form.elements, function (el) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
        return;
      }
      if (!el.name || el.name === "botcheck" || el.type === "submit") {
        return;
      }
      payload[el.name] = el.value;
    });

    if (config.turnstileSiteKey && window.turnstile && turnstileWidgetId !== null) {
      payload["cf-turnstile-response"] = window.turnstile.getResponse(turnstileWidgetId);
    }

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.success) {
          setStatus(config.successMessage, false);
          form.reset();
          if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
          }
          turnstileReady = false;
          return;
        }
        throw new Error((data && data.message) || "Submission failed");
      })
      .catch(function () {
        setStatus(config.errorMessage, true);
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      });
  });
})();
