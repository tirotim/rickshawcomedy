/**
 * Version hub — inject live iframe previews when served over HTTP.
 * Falls back to static thumbnail images on file:// or if iframe fails.
 */
(function () {
  var isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";

  document.querySelectorAll(".version-preview[data-preview-src]").forEach(function (el) {
    var src = el.getAttribute("data-preview-src");
    if (!src) return;

    if (!isHttp) {
      el.classList.add("version-preview--iframe-fallback");
      return;
    }

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "Preview of " + src;
    iframe.loading = "lazy";
    iframe.setAttribute("tabindex", "-1");
    el.appendChild(iframe);
  });
})();
