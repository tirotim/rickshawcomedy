#!/usr/bin/env node
/**
 * Build static HTML sections from content/*.json into versions/modern-gold/.
 * Run: node scripts/build-site.js
 */
const fs = require("fs");
const path = require("path");

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

function renderFigure(image, title) {
  var alt = escapeHtml(title + " caricature");
  if (image) {
    return (
      "                <figure class=\"nd-caricature-figure\">\n" +
      '                  <img src="' +
      escapeHtml(image) +
      '" alt="' +
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

function renderAudioPlayer(character) {
  if (character.comingSoon) {
    return '                  <p class="nd-caricature-status">Coming soon</p>';
  }

  var audioSrc = normalizeAssetPath(character.audio);
  if (!audioSrc) {
    return (
      '                  <div class="nd-audio-player nd-audio-player--missing">\n' +
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
    '"></audio>\n' +
    '                    <button type="button" class="nd-audio-btn" aria-pressed="false" aria-label="Play audio sample for ' +
    escapeHtml(character.title) +
    '">\n' +
    '                      <span class="nd-audio-btn-icon" aria-hidden="true"></span>\n' +
    '                      <span class="nd-audio-btn-label">Play sample</span>\n' +
    "                    </button>\n" +
    "                  </div>"
  );
}

function renderCharacter(character) {
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
    renderFigure(image, character.title) +
    "\n" +
    '                <div class="nd-caricature-meta">\n' +
    renderTitle(character.title, link) +
    "\n" +
    renderCaption(character.caption, character.captionEmphasis) +
    "\n" +
    renderSongTitle(character.songTitle) +
    "\n" +
    renderAudioPlayer(character) +
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

function renderNkFeatured(character) {
  var image = normalizeAssetPath(character.image);
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
    '" alt="Caricature of ' +
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

function renderNkMusical(character) {
  var image = normalizeAssetPath(character.image);
  return (
    '              <article class="nk-character nk-character--compact" id="' +
    escapeHtml(characterId(character)) +
    '">\n' +
    '                <figure class="nk-character-figure">\n' +
    '                  <img src="' +
    escapeHtml(image) +
    '" alt="' +
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
    data.comedyCharacters.map(renderNkFeatured).join("\n\n") +
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
    data.musicalCharacters.map(renderNkMusical).join("\n\n") +
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
    '            <p class="repertoire-lede">\n' +
    "              " +
    escapeHtml(data.spoofNote) +
    "\n" +
    "            </p>\n" +
    '            <blockquote class="repertoire-callout repertoire-callout--secondary">\n' +
    "              <strong>" +
    escapeHtml(data.spoofExample.character) +
    "</strong> as " +
    escapeHtml(data.spoofExample.as) +
    " — <em>" +
    escapeHtml(data.spoofExample.song) +
    "</em>\n" +
    "            </blockquote>\n" +
    '            <h2 class="repertoire-subhead">' +
    escapeHtml(data.sectionHeading) +
    "</h2>\n" +
    '            <div class="nd-caricature-grid" aria-label="Rick Shaw caricatures">\n' +
    data.characters.map(renderCharacter).join("\n\n") +
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
    data.musicCharacters.map(renderCharacter).join("\n\n") +
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

function buildNews() {
  var data = readJson("news.json");
  var block =
    '            <h1 class="section-heading">' +
    escapeHtml(data.heading) +
    "</h1>\n" +
    "            <p>\n" +
    "              " +
    escapeHtml(data.body) +
    "\n" +
    "            </p>\n" +
    '            <a class="btn btn-secondary" href="' +
    escapeHtml(data.buttonUrl) +
    '">' +
    escapeHtml(data.buttonLabel) +
    "</a>";

  replaceBlock(path.join(SITE, "news.html"), "<!-- cms:news:start -->", "<!-- cms:news:end -->", block);
}

function buildContact() {
  var data = readJson("contact.json");
  var block =
    '          <h1 class="section-heading">' +
    escapeHtml(data.heading) +
    "</h1>\n" +
    "          <p>" +
    escapeHtml(data.body) +
    '</p>\n          <p><a class="contact-link" href="mailto:' +
    escapeHtml(data.email) +
    '">' +
    escapeHtml(data.email) +
    "</a></p>";

  replaceBlock(path.join(SITE, "contact.html"), "<!-- cms:contact:start -->", "<!-- cms:contact:end -->", block);
}

buildNostalgicKnights();
buildNostalgicDays();
buildNews();
buildContact();
console.log("Built site content into versions/modern-gold/");
