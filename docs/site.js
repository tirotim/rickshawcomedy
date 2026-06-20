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

  /* Desktop: keep Shows menu open briefly while moving into the submenu */
  document.querySelectorAll(".nav-dropdown").forEach(function (dropdown) {
    var closeTimer = null;

    dropdown.addEventListener("mouseenter", function () {
      if (mqMobile.matches) {
        return;
      }
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      dropdown.classList.add("is-hover");
    });

    dropdown.addEventListener("mouseleave", function () {
      if (mqMobile.matches) {
        return;
      }
      closeTimer = window.setTimeout(function () {
        dropdown.classList.remove("is-hover");
        closeTimer = null;
      }, 280);
    });
  });

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
  if (nav) {
    if (path === "index.html" || path === "") {
      nav.querySelectorAll('a[href="./index.html"], a[href="./index.html#biography"]').forEach(function (a) {
        a.classList.add("is-active");
      });
    } else if (target) {
      nav.querySelectorAll("a").forEach(function (a) {
        if (a.getAttribute("href") === target) {
          a.classList.add("is-active");
        }
      });
    }

    var activeLink = nav.querySelector("a.is-active");
    if (activeLink) {
      var drop = activeLink.closest(".nav-dropdown");
      if (drop) {
        drop.classList.add("has-active-child");
      }
    }
  }
  var carousel = document.getElementById("shows-carousel");
  if (carousel) {
    var track = carousel.querySelector(".home-spotlight-carousel-track");
    var slides = carousel.querySelectorAll(".home-spotlight-slide");
    var prevBtn = carousel.querySelector("[data-carousel-prev]");
    var nextBtn = carousel.querySelector("[data-carousel-next]");
    var dots = carousel.querySelectorAll("[data-carousel-dot]");
    var status = carousel.querySelector(".home-spotlight-carousel-status");
    var index = 0;
    var titles = ["Nostalgic Knights", "Nostalgic Days", "Evan Vance", "Alter egos"];

    function goTo(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      track.style.transform = "translateX(-" + index * 100 + "%)";

      slides.forEach(function (slide, i) {
        var active = i === index;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", active ? "false" : "true");
        if ("inert" in slide) {
          slide.inert = !active;
        }
        slide.querySelectorAll("a, button").forEach(function (el) {
          if (active) {
            el.removeAttribute("tabindex");
          } else {
            el.setAttribute("tabindex", "-1");
          }
        });
      });

      dots.forEach(function (dot, i) {
        var active = i === index;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (status) {
        status.textContent = "Show " + (index + 1) + " of " + slides.length + ": " + titles[index];
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goTo(index - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goTo(index + 1);
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        var i = parseInt(dot.getAttribute("data-carousel-dot"), 10);
        if (!isNaN(i)) {
          goTo(i);
        }
      });
    });

    carousel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(index + 1);
      }
    });

    goTo(0);
  }

  var activeAudio = null;
  var activeButton = null;

  function resetAudioButton(btn) {
    if (!btn) {
      return;
    }
    btn.classList.remove("is-playing");
    btn.setAttribute("aria-pressed", "false");
    var label = btn.querySelector(".nd-audio-btn-label");
    if (label) {
      label.textContent = "Play";
    }
  }

  function setPlayingButton(btn) {
    if (!btn) {
      return;
    }
    btn.classList.add("is-playing");
    btn.setAttribute("aria-pressed", "true");
    var label = btn.querySelector(".nd-audio-btn-label");
    if (label) {
      label.textContent = "Pause";
    }
  }

  function stopActiveAudio() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    resetAudioButton(activeButton);
    activeAudio = null;
    activeButton = null;
  }

  document.querySelectorAll(".nd-audio-player").forEach(function (player) {
    var audio = player.querySelector(".nd-audio-el");
    var btn = player.querySelector(".nd-audio-btn");
    if (!audio || !btn || btn.disabled) {
      return;
    }

    btn.addEventListener("click", function () {
      if (activeAudio && activeAudio !== audio) {
        stopActiveAudio();
      }

      if (audio.paused) {
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(function () {
              activeAudio = audio;
              activeButton = btn;
              setPlayingButton(btn);
            })
            .catch(function () {
              resetAudioButton(btn);
              btn.disabled = true;
              var label = btn.querySelector(".nd-audio-btn-label");
              if (label) {
                label.textContent = "Unavailable";
              }
            });
        }
      } else {
        audio.pause();
        resetAudioButton(btn);
        activeAudio = null;
        activeButton = null;
      }
    });

    audio.addEventListener("ended", function () {
      resetAudioButton(btn);
      if (activeAudio === audio) {
        activeAudio = null;
        activeButton = null;
      }
    });

    audio.addEventListener("error", function () {
      resetAudioButton(btn);
      btn.disabled = true;
      var label = btn.querySelector(".nd-audio-btn-label");
      if (label) {
        label.textContent = "Unavailable";
      }
    });
  });
})();
