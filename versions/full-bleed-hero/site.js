(function () {
  var btn = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".primary-nav");
  var mqMobile = window.matchMedia("(max-width: 640px)");

  function closeAllDropdowns() {
    document.querySelectorAll(".nav-dropdown.is-open").forEach(function (dd) {
      dd.classList.remove("is-open");
      var t = dd.querySelector(".nav-dropdown-trigger");
      if (t) {
        t.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) {
        closeAllDropdowns();
      }
    });
  }

  document.querySelectorAll(".nav-dropdown-trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function (e) {
      if (!mqMobile.matches) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      var li = trigger.closest(".nav-dropdown");
      if (!li) {
        return;
      }
      var opening = !li.classList.contains("is-open");
      closeAllDropdowns();
      if (opening) {
        li.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeAllDropdowns();
    }
  });

  var path = (window.location.pathname.split("/").pop() || "").toLowerCase();
  if (!path || path === "") {
    path = "index.html";
  }

  var hrefForActive = {
    "index.html": "./index.html",
    "biography.html": "./biography.html",
    "nostalgic-knights.html": "./nostalgic-knights.html",
    "evan-vance.html": "./evan-vance.html",
    "nostalgic-days.html": "./nostalgic-days.html",
    "alter-egos.html": "./alter-egos.html",
    "gallery.html": "./gallery.html",
    "news.html": "./news.html",
    "contact.html": "./contact.html",
  };

  var target = hrefForActive[path];
  if (target && nav) {
    nav.querySelectorAll("a").forEach(function (a) {
      if (a.getAttribute("href") === target) {
        a.classList.add("is-active");
      }
    });
    var activeLink = nav.querySelector("a.is-active");
    if (activeLink) {
      var drop = activeLink.closest(".nav-dropdown");
      if (drop) {
        drop.classList.add("has-active-child");
      }
    }
  }
})();
