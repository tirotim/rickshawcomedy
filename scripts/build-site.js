#!/usr/bin/env node
/**
 * Build static HTML sections from content/*.json into versions/modern-gold/.
 * Run: node scripts/build-site.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "content", "pages");
const SITE = path.join(ROOT, "versions", "modern-gold");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, name), "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeAssetPath(value) {
  if (!value) {
    return "";
  }
  var cleaned = String(value).trim();
  if (!cleaned) {
    return "";
  }
  cleaned = cleaned.replace(/^\/+/, "");
  cleaned = cleaned.replace(/^versions\/modern-gold\//, "");
  if (!cleaned.startsWith("./") && !cleaned.startsWith("http")) {
    cleaned = "./" + cleaned;
  }
  return cleaned;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[''""]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function characterId(character) {
  return character.id || slugify(character.title);
}

function replaceBlock(filePath, startMarker, endMarker, content) {
  var html = fs.readFileSync(filePath, "utf8");
  var start = html.indexOf(startMarker);
  var end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Missing CMS markers in " + filePath);
  }
  var next = html.slice(0, start + startMarker.length) + "\n" + content + "\n          " + html.slice(end);
  fs.writeFileSync(filePath, next, "utf8");
}

function renderCaption(caption, emphasis) {
  if (!caption && !emphasis) {
    return "";
  }
  if (caption && emphasis) {
    return (
      '                  <p class="nd-caricature-caption">' +
      escapeHtml(caption) +
      " <em>" +
      escapeHtml(emphasis) +
      "</em></p>"
    );
  }
  if (emphasis) {
    return '                  <p class="nd-caricature-caption"><em>' + escapeHtml(emphasis) + "</em></p>";
  }
  return '                  <p class="nd-caricature-caption">' + escapeHtml(caption) + "</p>";
}

function renderTitle(title, link) {
  if (link) {
    return (
      '                  <h3 class="nd-caricature-title"><a href="' +
      escapeHtml(link) +
      '">' +
      escapeHtml(title) +
      "</a></h3>"
    );
  }
  return '                  <h3 class="nd-caricature-title">' + escapeHtml(title) + "</h3>";
}

function editimgBindAttr(bind) {
  if (!bind) {
    return "";
  }
  return ' data-editimg-bind="' + escapeHtml(bind) + '"';
}

function renderFigure(image, title, bind) {
  var alt = escapeHtml(title + " caricature");
  var bindAttr = editimgBindAttr(bind);
  if (image) {
    return (
      "                <figure class=\"nd-caricature-figure\">\n" +
      '                  <img src="' +
      escapeHtml(image) +
      '"' +
      bindAttr +
      ' alt="' +
      alt +
      '" width="400" height="500" loading="lazy" decoding="async" />\n' +
      "                </figure>"
    );
  }
  return (
    "                <figure class=\"nd-caricature-figure\">\n" +
    '                  <div class="nd-caricature-placeholder" aria-hidden="true"></div>\n' +
    "                </figure>"
  );
}

function renderSongTitle(songTitle) {
  if (!songTitle) {
    return "";
  }
  return '                  <p class="nd-caricature-song"><em>\'' + escapeHtml(songTitle) + "'</em></p>";
}

function audioBindFromImageBind(bind) {
  if (!bind) {
    return "";
  }
  return bind.replace(/\.image$/, ".audio");
}

function renderAudioPlayer(character, bind) {
  if (character.comingSoon) {
    return '                  <p class="nd-caricature-status">Coming soon</p>';
  }

  var audioSrc = normalizeAssetPath(character.audio);
  var bindAttr = editimgBindAttr(bind);
  if (!audioSrc) {
    return (
      '                  <div class="nd-audio-player nd-audio-player--missing">\n' +
      (bind
        ? '                    <audio class="nd-audio-el" preload="none" hidden' + bindAttr + "></audio>\n"
        : "") +
      '                    <button type="button" class="nd-audio-btn" disabled aria-label="Audio sample unavailable for ' +
      escapeHtml(character.title) +
      '">\n' +
      '                      <span class="nd-audio-btn-label">Audio unavailable</span>\n' +
      "                    </button>\n" +
      "                  </div>"
    );
  }

  return (
    '                  <div class="nd-audio-player">\n' +
    '                    <audio class="nd-audio-el" preload="none" src="' +
    escapeHtml(audioSrc) +
    '"' +
    bindAttr +
    '></audio>\n' +
    '                    <button type="button" class="nd-audio-btn" aria-pressed="false" aria-label="Play audio for ' +
    escapeHtml(character.title) +
    '">\n' +
    '                      <span class="nd-audio-btn-icon" aria-hidden="true"></span>\n' +
    '                      <span class="nd-audio-btn-label">Play</span>\n' +
    "                    </button>\n" +
    "                  </div>"
  );
}

function renderCharacter(character, bind) {
  var image = normalizeAssetPath(character.image);
  var link = normalizeAssetPath(character.link);
  var classes = "nd-caricature";
  if (character.featured) {
    classes += " nd-caricature--feature";
  }
  if (character.comingSoon) {
    classes += " nd-caricature--coming-soon";
  }

  return (
    '              <article class="' +
    classes +
    '" id="' +
    escapeHtml(characterId(character)) +
    '">\n' +
    renderFigure(image, character.title, bind) +
    "\n" +
    '                <div class="nd-caricature-meta">\n' +
    renderTitle(character.title, link) +
    "\n" +
    renderCaption(character.caption, character.captionEmphasis) +
    "\n" +
    renderSongTitle(character.songTitle) +
    "\n" +
    renderAudioPlayer(character, audioBindFromImageBind(bind)) +
    "\n" +
    "                </div>\n" +
    "              </article>"
  );
}

function renderSidebarNavLink(character) {
  return (
    "                <li><a href=\"#" +
    escapeHtml(characterId(character)) +
    "\">" +
    escapeHtml(character.title) +
    "</a></li>"
  );
}

function renderSidebarNav(characters, heading) {
  if (!characters || !characters.length) {
    return "";
  }
  return (
    '              <p class="show-sidebar-nav-heading">' +
    escapeHtml(heading) +
    "</p>\n" +
    '              <ul class="show-sidebar-nav-list">\n' +
    characters.map(renderSidebarNavLink).join("\n") +
    "\n              </ul>"
  );
}

function renderNkComedyCaption(character) {
  if (character.comingSoon) {
    return escapeHtml(character.title) + ' — <abbr title="To be announced">TBA</abbr>';
  }
  if (character.captionNote) {
    return (
      escapeHtml(character.title) +
      " — as " +
      escapeHtml(character.imitates) +
      ' <span class="character-note">(' +
      escapeHtml(character.captionNote) +
      ")</span>"
    );
  }
  if (character.imitates) {
    return escapeHtml(character.title) + " — as " + escapeHtml(character.imitates);
  }
  return escapeHtml(character.title);
}

function renderNkMusicalCaption(character) {
  if (character.comingSoon && character.songTitle) {
    return (
      escapeHtml(character.title) +
      ' — <span class="character-tba">' +
      escapeHtml(character.songTitle) +
      "</span>"
    );
  }
  var caption = escapeHtml(character.title);
  if (character.captionExtra) {
    caption += " (" + escapeHtml(character.captionExtra) + ")";
  }
  if (character.imitates) {
    caption += " — as " + escapeHtml(character.imitates);
  }
  if (character.songTitle) {
    caption += " · <em>" + escapeHtml(character.songTitle) + "</em>";
  }
  return caption;
}

function renderNkFeatured(character, bind) {
  var image = normalizeAssetPath(character.image);
  var bindAttr = editimgBindAttr(bind);
  return (
    '              <article class="nk-character nk-character--featured" id="' +
    escapeHtml(characterId(character)) +
    '">\n' +
    '                <h4 class="nk-character-title">' +
    escapeHtml(character.title) +
    "</h4>\n" +
    '                <figure class="nk-character-figure">\n' +
    '                  <img src="' +
    escapeHtml(image) +
    '"' +
    bindAttr +
    ' alt="Caricature of ' +
    escapeHtml(character.title) +
    '." width="800" height="1000" loading="lazy" decoding="async" />\n' +
    '                  <figcaption class="nk-character-caption">' +
    renderNkComedyCaption(character) +
    "</figcaption>\n" +
    "                </figure>\n" +
    '                <div class="nk-character-copy">\n' +
    "                  <p>" +
    escapeHtml(character.paragraph1) +
    "</p>\n" +
    "                  <p>" +
    escapeHtml(character.paragraph2) +
    "</p>\n" +
    "                </div>\n" +
    "              </article>"
  );
}

function renderNkMusical(character, bind) {
  var image = normalizeAssetPath(character.image);
  var bindAttr = editimgBindAttr(bind);
  return (
    '              <article class="nk-character nk-character--compact" id="' +
    escapeHtml(characterId(character)) +
    '">\n' +
    '                <figure class="nk-character-figure">\n' +
    '                  <img src="' +
    escapeHtml(image) +
    '"' +
    bindAttr +
    ' alt="' +
    escapeHtml(character.title) +
    ' character visual." width="800" height="1000" loading="lazy" decoding="async" />\n' +
    "                </figure>\n" +
    '                <div class="nk-character-meta">\n' +
    '                  <h4 class="nk-character-title">' +
    escapeHtml(character.title) +
    "</h4>\n" +
    '                  <p class="nk-character-caption">' +
    renderNkMusicalCaption(character) +
    "</p>\n" +
    "                </div>\n" +
    "              </article>"
  );
}

function renderNcsQuotes(quotes) {
  if (!quotes || !quotes.length) {
    return "";
  }
  return (
    '                  <ul class="ncs-quotes">\n' +
    quotes
      .map(function (quote) {
        return "                    <li>" + escapeHtml(quote) + "</li>";
      })
      .join("\n") +
    "\n                  </ul>"
  );
}

function renderNcsAudio(show, bind) {
  var audioSrc = normalizeAssetPath(show.audio);
  if (audioSrc) {
    return renderAudioPlayer(show, bind);
  }
  return (
    '                  <div class="nd-audio-player nd-audio-player--missing">\n' +
    (bind
      ? '                    <audio class="nd-audio-el" preload="none" hidden' + editimgBindAttr(bind) + "></audio>\n"
      : "") +
    '                    <button type="button" class="nd-audio-btn" disabled aria-label="Audio for ' +
    escapeHtml(show.title) +
    '">\n' +
    '                      <span class="nd-audio-btn-icon" aria-hidden="true"></span>\n' +
    '                      <span class="nd-audio-btn-label">Audio</span>\n' +
    "                    </button>\n" +
    "                  </div>"
  );
}

function renderNcsShow(show, bind, jsonFile, field) {
  var image = normalizeAssetPath(show.image);
  var bindAttr = editimgBindAttr(bind);
  var figure;
  if (image) {
    figure =
      '                <figure class="ncs-figure">\n' +
      '                  <img src="' +
      escapeHtml(image) +
      '"' +
      bindAttr +
      ' alt="" width="400" height="500" loading="lazy" decoding="async" />\n' +
      "                </figure>";
  } else {
    figure =
      '                <figure class="ncs-figure">\n' +
      '                  <div class="ncs-placeholder" aria-hidden="true"></div>\n' +
      "                </figure>";
  }

  return (
    '              <article class="ncs-card" id="' +
    escapeHtml(show.id || characterId(show)) +
    '">\n' +
    figure +
    '\n                <div class="ncs-meta">\n' +
    '                  <h3 class="ncs-title">' +
    escapeHtml(show.title) +
    "</h3>\n" +
    renderNcsQuotes(show.quotes) +
    "\n" +
    renderNcsAudio(show, audioBindFromImageBind(bind)) +
    "\n                </div>\n              </article>"
  );
}

function renderNcsGrid(shows, jsonFile, fieldName) {
  if (!shows || !shows.length) {
    return "";
  }
  return shows
    .map(function (show, index) {
      return renderNcsShow(show, jsonFile + ":" + fieldName + "." + index + ".image", jsonFile, fieldName);
    })
    .join("\n\n");
}

function renderLiveFeaturedFigure(item, bind) {
  var image = normalizeAssetPath(item.image);
  var bindAttr = editimgBindAttr(bind);
  if (image) {
    return (
      '                <figure class="live-featured-figure">\n' +
      '                  <img src="' +
      escapeHtml(image) +
      '"' +
      bindAttr +
      ' alt="" width="480" height="320" loading="lazy" decoding="async" />\n' +
      "                </figure>"
    );
  }
  return (
    '                <figure class="live-featured-figure">\n' +
    '                  <div class="live-featured-placeholder" aria-hidden="true"></div>\n' +
    "                </figure>"
  );
}

function renderLiveFeaturedCard(item, bind) {
  return (
    '              <article class="live-featured-card" id="' +
    escapeHtml(characterId(item)) +
    '">\n' +
    renderLiveFeaturedFigure(item, bind) +
    '\n                <div class="live-featured-meta">\n' +
    '                  <h3 class="live-featured-title">' +
    escapeHtml(item.title) +
    "</h3>\n" +
    renderAudioPlayer(item, audioBindFromImageBind(bind)) +
    "\n                </div>\n              </article>"
  );
}

function renderLiveFeaturedGrid(items, jsonFile, fieldName) {
  if (!items || !items.length) {
    return "";
  }
  return items
    .map(function (item, index) {
      return renderLiveFeaturedCard(item, jsonFile + ":" + fieldName + "." + index + ".image");
    })
    .join("\n\n");
}

function renderGenreItem(item, bind) {
  return (
    '                  <li class="genres-item" id="' +
    escapeHtml(characterId(item)) +
    '">\n' +
    '                    <span class="genres-item-title">' +
    escapeHtml(item.title) +
    "</span>\n" +
    renderAudioPlayer(item, bind) +
    "\n                  </li>"
  );
}

function renderGenresColumn(items, jsonFile, fieldName) {
  if (!items || !items.length) {
    return "";
  }
  return (
    '              <ul class="genres-list">\n' +
    items
      .map(function (item, index) {
        return renderGenreItem(item, jsonFile + ":" + fieldName + "." + index + ".audio");
      })
      .join("\n") +
    "\n              </ul>"
  );
}

function buildEvanVance() {
  var data = readJson("evan-vance.json");
  var html = fs.readFileSync(path.join(SITE, "evan-vance.html"), "utf8");

  html = html.replace(
    /<h1 id="ev-heading" class="show-page-title">[\s\S]*?<\/h1>/,
    '<h1 id="ev-heading" class="show-page-title">' + escapeHtml(data.pageTitle) + "</h1>"
  );
  html = html.replace(
    /<p class="show-page-lede">[\s\S]*?<\/p>/,
    '<p class="show-page-lede">' + escapeHtml(data.lede) + "</p>"
  );
  fs.writeFileSync(path.join(SITE, "evan-vance.html"), html, "utf8");

  var block =
    '            <div class="live-featured-grid" aria-label="Featured Evan Vance sets">\n' +
    renderLiveFeaturedGrid(data.featuredSets, "evan-vance.json", "featuredSets") +
    "\n            </div>\n" +
    (data.genresLinkUrl
      ? '            <p class="genres-page-link-wrap">\n' +
        '              <a class="btn btn-secondary" href="' +
        escapeHtml(normalizeAssetPath(data.genresLinkUrl)) +
        '">' +
        escapeHtml(data.genresLinkLabel || "Browse all genres") +
        "</a>\n            </p>"
      : "");

  replaceBlock(
    path.join(SITE, "evan-vance.html"),
    "<!-- cms:evan-vance:start -->",
    "<!-- cms:evan-vance:end -->",
    block
  );
}

function buildGenres() {
  var data = readJson("genres.json");
  var html = fs.readFileSync(path.join(SITE, "genres.html"), "utf8");

  html = html.replace(
    /<h1 id="genres-heading" class="show-page-title">[\s\S]*?<\/h1>/,
    '<h1 id="genres-heading" class="show-page-title">' + escapeHtml(data.pageTitle) + "</h1>"
  );
  html = html.replace(
    /<p class="show-page-lede">[\s\S]*?<\/p>/,
    '<p class="show-page-lede">' + escapeHtml(data.lede) + "</p>"
  );
  fs.writeFileSync(path.join(SITE, "genres.html"), html, "utf8");

  var block =
    '            <div class="live-featured-grid live-featured-grid--genres" aria-label="Featured live sets">\n' +
    renderLiveFeaturedGrid(data.featuredLive, "genres.json", "featuredLive") +
    "\n            </div>\n" +
    '            <div class="genres-catalog" aria-label="Genre catalogue">\n' +
    '              <div class="genres-columns">\n' +
    '                <div class="genres-col">\n' +
    renderGenresColumn(data.genresLeft, "genres.json", "genresLeft") +
    "\n                </div>\n" +
    '                <div class="genres-col">\n' +
    renderGenresColumn(data.genresRight, "genres.json", "genresRight") +
    "\n                </div>\n" +
    "              </div>\n" +
    "            </div>";

  replaceBlock(path.join(SITE, "genres.html"), "<!-- cms:genres:start -->", "<!-- cms:genres:end -->", block);
}

function buildNostalgicComedySeries() {
  var data = readJson("nostalgic-comedy-series.json");
  var html = fs.readFileSync(path.join(SITE, "nostalgic-comedy-series.html"), "utf8");

  html = html.replace(
    /<h1 id="ncs-heading" class="show-page-title">[\s\S]*?<\/h1>/,
    '<h1 id="ncs-heading" class="show-page-title">' + escapeHtml(data.pageTitle) + "</h1>"
  );
  html = html.replace(
    /<p class="show-page-lede">[\s\S]*?<\/p>/,
    '<p class="show-page-lede">' + escapeHtml(data.lede) + "</p>"
  );
  fs.writeFileSync(path.join(SITE, "nostalgic-comedy-series.html"), html, "utf8");

  var block =
    (data.intro
      ? '            <p class="repertoire-lede">\n              ' + escapeHtml(data.intro) + "\n            </p>\n"
      : "") +
    '            <h2 class="repertoire-subhead">' +
    escapeHtml(data.mainSectionHeading || "Classic comedy series") +
    "</h2>\n" +
    '            <div class="ncs-grid" aria-label="Classic comedy series">\n' +
    renderNcsGrid(data.shows, "nostalgic-comedy-series.json", "shows") +
    "\n            </div>\n" +
    '            <h2 class="repertoire-subhead ncs-more-heading">' +
    escapeHtml(data.moreSectionHeading || "More comedy favourites") +
    "</h2>\n" +
    '            <div class="ncs-grid ncs-grid--more" aria-label="More comedy favourites">\n' +
    renderNcsGrid(data.moreShows, "nostalgic-comedy-series.json", "moreShows") +
    "\n            </div>";

  replaceBlock(
    path.join(SITE, "nostalgic-comedy-series.html"),
    "<!-- cms:nostalgic-comedy-series:start -->",
    "<!-- cms:nostalgic-comedy-series:end -->",
    block
  );
}

function updateShowsNav() {
  var ncsLink =
    '<li role="none"><a role="menuitem" href="./nostalgic-comedy-series.html">Nostalgic Comedy Series</a></li>';
  var ncsPattern =
    /<li role="none"><a role="menuitem" href="\.\/nostalgic-days\.html">Nostalgic Days<\/a><\/li>\n(?!\s*<li role="none"><a role="menuitem" href="\.\/nostalgic-comedy-series\.html">)/;
  var genresLink = '<li role="none"><a role="menuitem" href="./genres.html">Genres</a></li>';
  var genresPattern =
    /<li role="none"><a role="menuitem" href="\.\/evan-vance\.html">Evan Vance<\/a><\/li>\n(?!\s*<li role="none"><a role="menuitem" href="\.\/genres\.html">)/;

  function patchHtml(html) {
    var next = html;
    if (next.indexOf("nostalgic-comedy-series.html") === -1) {
      next = next.replace(ncsPattern, function (match) {
        return match + "                " + ncsLink + "\n";
      });
    }
    if (next.indexOf("genres.html") === -1) {
      next = next.replace(genresPattern, function (match) {
        return match + "                " + genresLink + "\n";
      });
    }
    return next;
  }

  fs.readdirSync(SITE).forEach(function (name) {
    if (!name.endsWith(".html")) {
      return;
    }
    var filePath = path.join(SITE, name);
    var html = fs.readFileSync(filePath, "utf8");
    var next = patchHtml(html);
    if (next !== html) {
      fs.writeFileSync(filePath, next, "utf8");
    }
  });

  var adminIndex = path.join(SITE, "admin", "index.html");
  if (fs.existsSync(adminIndex)) {
    var adminHtml = fs.readFileSync(adminIndex, "utf8");
    var nextAdmin = patchHtml(adminHtml.replace(/\.\/nostalgic-comedy-series\.html/g, "../nostalgic-comedy-series.html").replace(
      /\.\/nostalgic-days\.html/g,
      "../nostalgic-days.html"
    ));
    if (nextAdmin.indexOf("nostalgic-comedy-series.html") === -1) {
      nextAdmin = adminHtml.replace(
        /<li role="none"><a role="menuitem" href="\.\.\/nostalgic-days\.html">Nostalgic Days<\/a><\/li>\n(?!\s*<li role="none"><a role="menuitem" href="\.\.\/nostalgic-comedy-series\.html">)/,
        function (match) {
          return (
            match +
            '                <li role="none"><a role="menuitem" href="../nostalgic-comedy-series.html">Nostalgic Comedy Series</a></li>\n'
          );
        }
      );
    }
    if (nextAdmin !== adminHtml) {
      fs.writeFileSync(adminIndex, nextAdmin, "utf8");
    }
  }
}

function buildNostalgicKnights() {
  var data = readJson("nostalgic-knights.json");
  var html = fs.readFileSync(path.join(SITE, "nostalgic-knights.html"), "utf8");

  html = html.replace(
    /<h1 id="nk-hero-title" class="show-page-title">[\s\S]*?<\/h1>/,
    '<h1 id="nk-hero-title" class="show-page-title">' + escapeHtml(data.pageTitle) + "</h1>"
  );
  html = html.replace(
    /<p class="show-page-lede">[\s\S]*?<\/p>/,
    '<p class="show-page-lede">' + escapeHtml(data.lede) + "</p>"
  );
  fs.writeFileSync(path.join(SITE, "nostalgic-knights.html"), html, "utf8");

  var block =
    '            <p class="repertoire-lede">\n' +
    "              " +
    escapeHtml(data.intro) +
    "\n" +
    "            </p>\n" +
    '            <div class="nk-character-sections">\n' +
    data.comedyCharacters
      .map(function (character, index) {
        return renderNkFeatured(character, "nostalgic-knights.json:comedyCharacters." + index + ".image");
      })
      .join("\n\n") +
    "\n" +
    "            </div>\n" +
    '            <h3 class="repertoire-subhead" id="nk-musical">' +
    escapeHtml(data.musicalSectionHeading) +
    "</h3>\n" +
    '            <p class="repertoire-note">\n' +
    "              " +
    escapeHtml(data.musicalNote) +
    "\n" +
    "            </p>\n" +
    '            <div class="nk-character-grid">\n' +
    data.musicalCharacters
      .map(function (character, index) {
        return renderNkMusical(character, "nostalgic-knights.json:musicalCharacters." + index + ".image");
      })
      .join("\n\n") +
    "\n" +
    "            </div>";

  replaceBlock(
    path.join(SITE, "nostalgic-knights.html"),
    "<!-- cms:nostalgic-knights:start -->",
    "<!-- cms:nostalgic-knights:end -->",
    block
  );

  var sidebar =
    '            <nav class="show-sidebar-nav" aria-label="Character line-up">\n' +
    '              <p class="show-sidebar-nav-intro">Click a name to jump to that character.</p>\n' +
    renderSidebarNav(data.comedyCharacters, data.comedySectionHeading) +
    "\n" +
    renderSidebarNav(data.musicalCharacters, 'Musical "Sirs"') +
    "\n            </nav>";

  replaceBlock(
    path.join(SITE, "nostalgic-knights.html"),
    "<!-- cms:nk-sidebar:start -->",
    "<!-- cms:nk-sidebar:end -->",
    sidebar
  );
}

function buildNostalgicDays() {
  var data = readJson("nostalgic-days.json");
  var html = fs.readFileSync(path.join(SITE, "nostalgic-days.html"), "utf8");

  html = html.replace(
    /<h1 id="nd-heading" class="show-page-title">[\s\S]*?<\/h1>/,
    '<h1 id="nd-heading" class="show-page-title">' + escapeHtml(data.pageTitle) + "</h1>"
  );
  html = html.replace(
    /<p class="show-page-lede">[\s\S]*?<\/p>/,
    '<p class="show-page-lede">' + escapeHtml(data.lede) + "</p>"
  );
  fs.writeFileSync(path.join(SITE, "nostalgic-days.html"), html, "utf8");

  var block =
    '            <p class="repertoire-lede">\n' +
    "              " +
    escapeHtml(data.intro) +
    "\n" +
    "            </p>\n" +
    '            <h2 class="repertoire-subhead">' +
    escapeHtml(data.sectionHeading) +
    "</h2>\n" +
    '            <div class="nd-caricature-grid" aria-label="Rick Shaw caricatures">\n' +
    data.characters
      .map(function (character, index) {
        return renderCharacter(character, "nostalgic-days.json:characters." + index + ".image");
      })
      .join("\n\n") +
    "\n" +
    "            </div>\n" +
    '            <p class="repertoire-lede nd-music-intro">\n' +
    "              " +
    escapeHtml(data.musicIntro) +
    "\n" +
    "            </p>\n" +
    '            <h2 class="repertoire-subhead">' +
    escapeHtml(data.musicSectionHeading) +
    "</h2>\n" +
    '            <div class="nd-caricature-grid" aria-label="Musical mimic songs">\n' +
    data.musicCharacters
      .map(function (character, index) {
        return renderCharacter(character, "nostalgic-days.json:musicCharacters." + index + ".image");
      })
      .join("\n\n") +
    "\n" +
    "            </div>";

  replaceBlock(
    path.join(SITE, "nostalgic-days.html"),
    "<!-- cms:nostalgic-days:start -->",
    "<!-- cms:nostalgic-days:end -->",
    block
  );

  var sidebar =
    '            <nav class="show-sidebar-nav" aria-label="Character line-up">\n' +
    '              <p class="show-sidebar-nav-intro">Click a name to jump to that character.</p>\n' +
    renderSidebarNav(data.characters, data.sectionHeading) +
    "\n" +
    renderSidebarNav(data.musicCharacters, data.musicSectionHeading) +
    "\n            </nav>";

  replaceBlock(
    path.join(SITE, "nostalgic-days.html"),
    "<!-- cms:nd-sidebar:start -->",
    "<!-- cms:nd-sidebar:end -->",
    sidebar
  );
}

function renderNewsPost(post) {
  var block =
    '              <article class="news-post" id="' +
    escapeHtml(post.id || slugify(post.title)) +
    '">\n' +
    '                <h2 class="news-post-title">' +
    escapeHtml(post.title) +
    "</h2>\n" +
    '                <p class="news-post-body">' +
    escapeHtml(post.body) +
    "</p>\n";
  if (post.ctaUrl && post.ctaLabel) {
    block +=
      '                <a class="btn btn-secondary news-post-cta" href="' +
      escapeHtml(normalizeAssetPath(post.ctaUrl)) +
      '">' +
      escapeHtml(post.ctaLabel) +
      "</a>\n";
  }
  block += "              </article>";
  return block;
}

function buildNews() {
  var data = readJson("news.json");
  var block =
    '            <h1 class="section-heading">' +
    escapeHtml(data.heading) +
    "</h1>\n" +
    (data.body
      ? "            <p class=\"news-intro\">\n              " + escapeHtml(data.body) + "\n            </p>\n"
      : "");
  if (data.posts && data.posts.length) {
    block +=
      '            <div class="news-posts" aria-label="News posts">\n' +
      data.posts.map(renderNewsPost).join("\n\n") +
      "\n            </div>";
  }
  if (data.buttonUrl && data.buttonLabel) {
    block +=
      '\n            <a class="btn btn-secondary" href="' +
      escapeHtml(data.buttonUrl) +
      '">' +
      escapeHtml(data.buttonLabel) +
      "</a>";
  }

  replaceBlock(path.join(SITE, "news.html"), "<!-- cms:news:start -->", "<!-- cms:news:end -->", block);
}

var IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]);
var AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);
var EDITIMG_PAGES = [
  "index",
  "nostalgic-knights",
  "nostalgic-days",
  "nostalgic-comedy-series",
  "news",
  "contact",
  "gallery",
  "evan-vance",
  "genres",
  "alter-egos",
  "privacy",
];

function readImageOverrides() {
  var filePath = path.join(CONTENT, "image-overrides.json");
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function applyImageOverridesToHtml(html, pageFile, overrides) {
  var pageOverrides = overrides[pageFile];
  if (!pageOverrides) {
    return html;
  }
  Object.keys(pageOverrides).forEach(function (oldSrc) {
    var newSrc = pageOverrides[oldSrc];
    if (!oldSrc || !newSrc || oldSrc === newSrc) {
      return;
    }
    html = html.split('src="' + oldSrc + '"').join('src="' + newSrc + '"');
    html = html.split("src='" + oldSrc + "'").join("src='" + newSrc + "'");
  });
  return html;
}

function applyImageOverridesAll() {
  var overrides = readImageOverrides();
  fs.readdirSync(SITE).forEach(function (name) {
    if (!name.endsWith(".html")) {
      return;
    }
    var filePath = path.join(SITE, name);
    var html = fs.readFileSync(filePath, "utf8");
    var next = applyImageOverridesToHtml(html, name, overrides);
    if (next !== html) {
      fs.writeFileSync(filePath, next, "utf8");
    }
  });
}

function toPublicMediaPath(absPath) {
  var rel = path.relative(SITE, absPath).split(path.sep).join("/");
  return "./" + rel;
}

function scanMediaDir(dir, base, out, extSet, type) {
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanMediaDir(full, base, out, extSet, type);
      return;
    }
    var ext = path.extname(name).toLowerCase();
    if (!extSet.has(ext)) {
      return;
    }
    out.push({
      path: toPublicMediaPath(full),
      name: name,
      folder: path.relative(base, dir).split(path.sep).join("/") || "site root",
      type: type,
    });
  });
}

function buildMediaLibrary() {
  var items = [];
  scanMediaDir(path.join(SITE, "gallery"), SITE, items, IMAGE_EXT, "image");
  scanMediaDir(path.join(SITE, "audio"), SITE, items, AUDIO_EXT, "audio");
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
      path: toPublicMediaPath(full),
      name: name,
      folder: "site root",
      type: "image",
    });
  });
  items = items.filter(function (item, index, arr) {
    return arr.findIndex(function (other) {
      return other.path === item.path;
    }) === index;
  });
  items.sort(function (a, b) {
    return a.path.localeCompare(b.path);
  });
  fs.writeFileSync(path.join(SITE, "media-library.json"), JSON.stringify({ items: items }, null, 2) + "\n", "utf8");
}

function generateEditimgRoutes() {
  EDITIMG_PAGES.forEach(function (page) {
    var dir = path.join(SITE, page, "editimg");
    fs.mkdirSync(dir, { recursive: true });
    var target = "../../" + (page === "index" ? "index.html" : page + ".html") + "?editimg";
    var html =
      "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\" />\n" +
      "<title>Media edit mode</title>\n<script>location.replace(" +
      JSON.stringify(target) +
      ");</script>\n</head>\n<body></body>\n</html>\n";
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  });
}

function buildContact() {
  var data = readJson("contact.json");
  var form = data.form || {};
  var fields = Array.isArray(form.fields) ? form.fields : [];

  var block =
    '          <h1 class="section-heading">' +
    escapeHtml(data.heading) +
    "</h1>\n" +
    "          <p class=\"contact-intro\">" +
    escapeHtml(data.body) +
    "</p>";

  if (data.showEmail !== false && data.email) {
    block +=
      '\n          <p class="contact-email-line"><a class="contact-link" href="mailto:' +
      escapeHtml(data.email) +
      '">' +
      escapeHtml(data.email) +
      "</a></p>";
  }

  if (form.enabled !== false && fields.length) {
    block +=
      '\n          <div class="contact-form-wrap">' +
      (form.heading
        ? '<h2 class="contact-form-heading">' + escapeHtml(form.heading) + "</h2>"
        : "") +
      (form.intro ? '<p class="contact-form-intro">' + escapeHtml(form.intro) + "</p>" : "") +
      '<form id="contact-form" class="contact-form" action="#" method="post" novalidate>' +
      '<div class="contact-honeypot" aria-hidden="true">' +
      '<label for="contact-botcheck">Leave blank</label>' +
      '<input type="text" id="contact-botcheck" name="botcheck" tabindex="-1" autocomplete="off" />' +
      "</div>";

    fields.forEach(function (field) {
      block += renderContactField(field);
    });

    block +=
      '<div id="contact-turnstile" class="contact-turnstile"></div>' +
      '<button type="submit" class="btn btn-primary contact-submit">' +
      escapeHtml(form.submitLabel || "Send message") +
      "</button>" +
      '<p class="contact-form-status" role="status" aria-live="polite" hidden></p>' +
      "</form></div>" +
      '<script type="application/json" id="contact-form-config">' +
      JSON.stringify({
        web3formsAccessKey: form.web3formsAccessKey || "",
        turnstileSiteKey: form.turnstileSiteKey || "",
        successMessage: form.successMessage || "Thank you — your message has been sent.",
        errorMessage: form.errorMessage || "Sorry, something went wrong. Please try again.",
        subject: "Rick Shaw Comedy — website enquiry",
      }) +
      "</script>";
  }

  replaceBlock(path.join(SITE, "contact.html"), "<!-- cms:contact:start -->", "<!-- cms:contact:end -->", block);
}

function readSiteAuthConfig() {
  var filePath = path.join(ROOT, "content", "site-auth.json");
  if (!fs.existsSync(filePath)) {
    return { enabled: false };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeSiteAuthConfig() {
  var config = readSiteAuthConfig();
  var password = process.env.SITE_VIEW_PASSWORD || "RickShaw2026";
  var output = {
    enabled: !!config.enabled,
    title: config.title || "Rick Shaw Comedy",
    message: config.message || "Enter the preview password to continue.",
    passwordHash: crypto.createHash("sha256").update(password).digest("hex"),
  };
  if (!output.enabled) {
    delete output.passwordHash;
  }
  fs.writeFileSync(path.join(SITE, "site-auth-config.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
}

function injectSiteAuth() {
  var config = readSiteAuthConfig();
  if (!config.enabled) {
    return;
  }

  var snippet =
    '    <link rel="stylesheet" href="./site-auth.css?v=3" />\n' +
    '    <script src="./site-auth.js?v=3"></script>\n';

  function authAssetPrefix(filePath) {
    var depth = path.relative(SITE, path.dirname(filePath)).split(path.sep).filter(Boolean).length;
    return depth ? "../".repeat(depth) : "./";
  }

  function injectHtml(filePath) {
    var html = fs.readFileSync(filePath, "utf8");
    var prefix = authAssetPrefix(filePath);
    var localSnippet = snippet.replace(/\.\//g, prefix);
    html = html.replace(/^\s*<link rel="stylesheet" href="[^"]*site-auth\.css[^"]*" \/?>\s*$/gm, "");
    html = html.replace(/^\s*<script src="[^"]*site-auth\.js[^"]*"><\/script>\s*$/gm, "");
    html = html.replace("</head>", localSnippet + "  </head>");
    html = html.replace(/<html([^>]*)>/i, function (match, attrs) {
      if (/\bsite-auth-pending\b/.test(attrs)) {
        return match;
      }
      if (/\bclass="/.test(attrs)) {
        return match.replace(/class="([^"]*)"/, 'class="$1 site-auth-pending"');
      }
      return "<html" + attrs + ' class="site-auth-pending">';
    });
    fs.writeFileSync(filePath, html, "utf8");
  }

  fs.readdirSync(SITE).forEach(function (name) {
    var filePath = path.join(SITE, name);
    if (name.endsWith(".html") && fs.statSync(filePath).isFile()) {
      injectHtml(filePath);
      return;
    }
    if (!fs.statSync(filePath).isDirectory()) {
      return;
    }
    fs.readdirSync(filePath).forEach(function (nested) {
      if (nested.endsWith(".html")) {
        injectHtml(path.join(filePath, nested));
      }
    });
  });
}

function renderContactField(field) {
  var id = "contact-" + field.name;
  var required = field.required ? ' required aria-required="true"' : "";
  var placeholder = field.placeholder ? ' placeholder="' + escapeHtml(field.placeholder) + '"' : "";
  var label = '<label class="contact-label" for="' + id + '">' + escapeHtml(field.label) + "</label>";

  if (field.type === "textarea") {
    return (
      '<div class="contact-field">' +
      label +
      '<textarea class="contact-input contact-textarea" id="' +
      id +
      '" name="' +
      escapeHtml(field.name) +
      '" rows="5"' +
      required +
      placeholder +
      "></textarea></div>"
    );
  }

  return (
    '<div class="contact-field">' +
    label +
    '<input class="contact-input" id="' +
    id +
    '" name="' +
    escapeHtml(field.name) +
    '" type="' +
    escapeHtml(field.type || "text") +
    '"' +
    required +
    placeholder +
    " /></div>"
  );
}

buildNostalgicKnights();
buildNostalgicDays();
buildNostalgicComedySeries();
buildEvanVance();
buildGenres();
updateShowsNav();
buildNews();
buildContact();
buildMediaLibrary();
generateEditimgRoutes();
applyImageOverridesAll();
writeSiteAuthConfig();
injectSiteAuth();
console.log("Built site content into versions/modern-gold/");
