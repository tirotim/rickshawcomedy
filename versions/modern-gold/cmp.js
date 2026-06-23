(function () {
  var STORAGE_KEY = "rsc_cookie_consent_v1";

  var CATEGORIES = [
    {
      id: "performance",
      label: "Performance cookies",
      description:
        "These cookies allow us to enumerate site visits so we can improve the usability of the site. They help us understand which pages are most popular and how visitors navigate the site. These cookies are anonymous. If you do not allow these cookies, we will not know when you have visited our site and therefore will not be able to monitor its performance.",
      optional: true,
      default: false,
    },
    {
      id: "advertising",
      label: "Advertising cookies",
      description:
        "These cookies do not directly store personal information, but they may be used by third parties to build a profile of your likes and dislikes. They uniquely identify your browser and interests. If you do not allow these cookies, you will receive much less targeted advertising or, in some cases, no advertising at all.",
      optional: true,
      default: false,
    },
    {
      id: "functional",
      label: "Functional cookies",
      description:
        "These cookies enable us to personalise the functionality of the site. They may be set by third parties whose own websites and contact details have been added to our site — for example, the charities we support. If you do not allow these cookies, some service functions on this website may not work properly.",
      optional: true,
      default: false,
    },
    {
      id: "access_storage",
      label: "Accessing and storing information",
      description:
        "Cookies and other online identifiers — including browser information, language, device type, screen size and supported technologies — may be read and stored on your device to recognise it when it connects to a website. You have complete autonomy to decline these cookies.",
      optional: true,
      default: false,
    },
    {
      id: "personalise",
      label: "Personalise advertising and content measurement",
      description:
        "This includes audience research and website services development. Limited data from your device, non-precise location, device type and viewed content could be used for more specific targeted advertising. If you decline, your profile and interests will not be continually personalised and your precise location will not be used.",
      optional: true,
      default: false,
    },
    {
      id: "device_scanning",
      label: "Device scanning for identification purposes",
      description:
        "Only with your acceptance will certain characteristics specific to your device be requested and used to distinguish it from other devices, in support of the purposes explained in our privacy notice.",
      optional: true,
      default: false,
    },
    {
      id: "necessary",
      label: "Necessary cookies",
      description:
        "These cookies are always active and are necessary for our website to function properly. They respond to requests you make for information, tickets, services or form filling. Necessary cookies do not store identifiable information.",
      optional: false,
    },
    {
      id: "security",
      label: "Security, prevention and fraud detection",
      description:
        "We monitor and prevent unusual usage that could indicate fraudulent activity — for example, advertising clicks by bots — and ensure our processes and systems work properly and securely.",
      optional: false,
    },
    {
      id: "data_matching",
      label: "Data matching and linked devices",
      description:
        "Information relating to you may originate from different sources. Your device may be linked to other devices on the same internet connection and distinguished by automatic information such as IP address, connection type or browser.",
      optional: false,
    },
    {
      id: "communicating",
      label: "Communicating and saving privacy choices",
      description:
        "The choices you make regarding this website are saved and made available as digital signals so we can honour your preferences across visits.",
      optional: false,
    },
  ];

  function defaultChoices() {
    var choices = {};
    CATEGORIES.forEach(function (cat) {
      choices[cat.id] = cat.optional ? !!cat.default : true;
    });
    return choices;
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.choices) {
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeConsent(choices) {
    var payload = {
      version: 1,
      updated: new Date().toISOString(),
      choices: choices,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    applyConsent(choices);
  }

  function applyConsent(choices) {
    document.documentElement.setAttribute("data-cmp-performance", choices.performance ? "granted" : "denied");
    document.documentElement.setAttribute("data-cmp-advertising", choices.advertising ? "granted" : "denied");
    document.documentElement.setAttribute("data-cmp-functional", choices.functional ? "granted" : "denied");
    document.dispatchEvent(
      new CustomEvent("rsc:consent", {
        detail: { choices: choices },
      })
    );
  }

  function mergeChoices(partial) {
    var merged = defaultChoices();
    var existing = readConsent();
    if (existing && existing.choices) {
      Object.keys(existing.choices).forEach(function (key) {
        merged[key] = existing.choices[key];
      });
    }
    Object.keys(partial).forEach(function (key) {
      merged[key] = partial[key];
    });
    return merged;
  }

  function setAllOptional(value) {
    var choices = mergeChoices({});
    CATEGORIES.forEach(function (cat) {
      if (cat.optional) {
        choices[cat.id] = value;
      }
    });
    return choices;
  }

  function buildCategoryHtml(cat, choices) {
    if (cat.optional) {
      var checked = choices[cat.id] ? " checked" : "";
      return (
        '<div class="cmp-category cmp-category--toggle">' +
        '<div class="cmp-category-head">' +
        '<h3 class="cmp-category-title">' +
        cat.label +
        "</h3>" +
        '<label class="cmp-switch">' +
        '<input type="checkbox" class="cmp-switch-input" data-cmp-category="' +
        cat.id +
        '"' +
        checked +
        " />" +
        '<span class="cmp-switch-ui" aria-hidden="true"></span>' +
        '<span class="cmp-switch-label">Off</span>' +
        "</label>" +
        "</div>" +
        '<p class="cmp-category-text">' +
        cat.description +
        "</p>" +
        "</div>"
      );
    }

    return (
      '<div class="cmp-category cmp-category--required">' +
      '<div class="cmp-category-head">' +
      '<h3 class="cmp-category-title">' +
      cat.label +
      "</h3>" +
      '<span class="cmp-badge">Always active</span>' +
      "</div>" +
      '<p class="cmp-category-text">' +
      cat.description +
      "</p>" +
      "</div>"
    );
  }

  function renderPanelCategories(choices) {
    return CATEGORIES.map(function (cat) {
      return buildCategoryHtml(cat, choices);
    }).join("");
  }

  function syncSwitchLabels(root) {
    root.querySelectorAll(".cmp-switch-input").forEach(function (input) {
      var label = input.closest(".cmp-switch");
      if (!label) {
        return;
      }
      var text = label.querySelector(".cmp-switch-label");
      if (text) {
        text.textContent = input.checked ? "On" : "Off";
      }
    });
  }

  function readPanelChoices(panel) {
    var choices = mergeChoices({});
    panel.querySelectorAll(".cmp-switch-input").forEach(function (input) {
      var id = input.getAttribute("data-cmp-category");
      if (id) {
        choices[id] = input.checked;
      }
    });
    return choices;
  }

  function trapFocus(container) {
    var focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) {
      return function () {};
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    function onKeyDown(e) {
      if (e.key !== "Tab") {
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return function () {
      container.removeEventListener("keydown", onKeyDown);
    };
  }

  var releaseBannerTrap = null;
  var releasePanelTrap = null;
  var lastFocus = null;

  function openBanner() {
    var banner = document.getElementById("cmp-banner");
    if (!banner) {
      return;
    }
    lastFocus = document.activeElement;
    banner.hidden = false;
    document.body.classList.add("cmp-open");
    releaseBannerTrap = trapFocus(banner);
    var btn = banner.querySelector("[data-cmp-accept-all]");
    if (btn) {
      btn.focus();
    }
  }

  function closeBanner() {
    var banner = document.getElementById("cmp-banner");
    if (!banner) {
      return;
    }
    banner.hidden = true;
    if (!document.getElementById("cmp-panel") || document.getElementById("cmp-panel").hidden) {
      document.body.classList.remove("cmp-open");
    }
    if (releaseBannerTrap) {
      releaseBannerTrap();
      releaseBannerTrap = null;
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function openPanel() {
    var panel = document.getElementById("cmp-panel");
    if (!panel) {
      return;
    }
    var choices = mergeChoices(readConsent() ? readConsent().choices : {});
    var list = panel.querySelector(".cmp-category-list");
    if (list) {
      list.innerHTML = renderPanelCategories(choices);
      syncSwitchLabels(panel);
    }
    lastFocus = document.activeElement;
    panel.hidden = false;
    document.body.classList.add("cmp-open");
    closeBanner();
    releasePanelTrap = trapFocus(panel);
    var btn = panel.querySelector("[data-cmp-confirm]");
    if (btn) {
      btn.focus();
    }
  }

  function closePanel() {
    var panel = document.getElementById("cmp-panel");
    if (!panel) {
      return;
    }
    panel.hidden = true;
    document.body.classList.remove("cmp-open");
    if (releasePanelTrap) {
      releasePanelTrap();
      releasePanelTrap = null;
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  function mount() {
    if (document.getElementById("cmp-root")) {
      return;
    }

    var root = document.createElement("div");
    root.id = "cmp-root";
    root.innerHTML =
      '<div id="cmp-banner" class="cmp-banner" role="dialog" aria-modal="true" aria-labelledby="cmp-banner-title" hidden>' +
      '<div class="cmp-banner-inner">' +
      '<p class="cmp-kicker">Rick Shaw Comedy</p>' +
      '<h2 id="cmp-banner-title" class="cmp-title">We really care about your privacy</h2>' +
      '<p class="cmp-lede">Rick Shaw Comedy may store and access personal data if you give us permission. This may include browsing data and unique identifiers on your device.</p>' +
      '<p class="cmp-copy">Selecting <strong>Accept all</strong> enables tracking technologies to support this website. Selecting <strong>Reject all</strong> or withdrawing consent disables them. Many optional cookies are off by default.</p>' +
      '<p class="cmp-copy">You can change your choices at any time. See our <a href="./privacy.html#cookie-consent">privacy notice</a>.</p>' +
      '<div class="cmp-actions">' +
      '<button type="button" class="btn btn-primary" data-cmp-accept-all>Accept all</button>' +
      '<button type="button" class="btn btn-secondary" data-cmp-reject-all>Reject all</button>' +
      '<button type="button" class="btn btn-secondary" data-cmp-manage>Manage preferences</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div id="cmp-panel" class="cmp-panel" role="dialog" aria-modal="true" aria-labelledby="cmp-panel-title" hidden>' +
      '<div class="cmp-panel-inner">' +
      '<button type="button" class="cmp-close" data-cmp-close aria-label="Close cookie settings">&times;</button>' +
      '<p class="cmp-kicker">Rick Shaw Comedy</p>' +
      '<h2 id="cmp-panel-title" class="cmp-title">Managing consent preferences</h2>' +
      '<p class="cmp-copy">Please note that you may change your choices or withdraw your consent at any time.</p>' +
      '<div class="cmp-category-list"></div>' +
      '<div class="cmp-actions cmp-actions--panel">' +
      '<button type="button" class="btn btn-primary" data-cmp-accept-all>Accept all</button>' +
      '<button type="button" class="btn btn-secondary" data-cmp-confirm>Confirm my choices</button>' +
      '<button type="button" class="btn btn-secondary" data-cmp-reject-all>Reject all</button>' +
      '<a class="cmp-unsubscribe" href="./contact.html">Unsubscribe from this site</a>' +
      "</div>" +
      "</div>" +
      "</div>";

    document.body.appendChild(root);

    root.addEventListener("click", function (e) {
      var target = e.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.matches("[data-cmp-accept-all]")) {
        writeConsent(setAllOptional(true));
        closePanel();
        closeBanner();
        return;
      }

      if (target.matches("[data-cmp-reject-all]")) {
        writeConsent(setAllOptional(false));
        closePanel();
        closeBanner();
        return;
      }

      if (target.matches("[data-cmp-manage]")) {
        openPanel();
        return;
      }

      if (target.matches("[data-cmp-confirm]")) {
        var panel = document.getElementById("cmp-panel");
        if (panel) {
          writeConsent(readPanelChoices(panel));
        }
        closePanel();
        return;
      }

      if (target.matches("[data-cmp-close]")) {
        closePanel();
        return;
      }
    });

    root.addEventListener("change", function (e) {
      var target = e.target;
      if (target instanceof HTMLInputElement && target.matches(".cmp-switch-input")) {
        syncSwitchLabels(root);
      }
    });

    document.addEventListener("click", function (e) {
      var target = e.target;
      if (target instanceof Element && target.closest("[data-cmp-open]")) {
        e.preventDefault();
        openPanel();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closePanel();
        closeBanner();
      }
    });
  }

  mount();

  var stored = readConsent();
  if (stored) {
    applyConsent(mergeChoices(stored.choices));
  } else {
    applyConsent(defaultChoices());
    openBanner();
  }

  window.RSC_CMP = {
    openSettings: openPanel,
    readConsent: readConsent,
    writeConsent: writeConsent,
  };
})();
