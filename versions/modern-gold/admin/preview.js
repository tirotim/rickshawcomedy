(function () {
  var PAGE_BY_COLLECTION = {
    nostalgic_knights: "nostalgic-knights.html",
    nostalgic_days: "nostalgic-days.html",
    news: "news.html",
    contact: "contact.html",
  };

  function siteRoot() {
    var path = window.location.pathname;
    var adminIndex = path.indexOf("/admin");
    if (adminIndex !== -1) {
      return path.slice(0, adminIndex + 1);
    }
    return "/";
  }

  function collectionName(props) {
    var collection = props.collection;
    if (!collection) {
      return "";
    }
    if (typeof collection.get === "function") {
      return collection.get("name") || "";
    }
    return collection.name || "";
  }

  function previewUrl(props) {
    var page = PAGE_BY_COLLECTION[collectionName(props)] || "index.html";
    return siteRoot() + page;
  }

  var PagePreview = createClass({
    displayName: "PagePreview",
    getInitialState: function () {
      return { view: "desktop" };
    },
    setView: function (view) {
      this.setState({ view: view });
    },
    render: function () {
      var view = this.state.view;
      var self = this;

      return h(
        "div",
        { className: "cms-page-preview" },
        h(
          "div",
          { className: "cms-page-preview-toolbar", role: "toolbar", "aria-label": "Preview size" },
          h(
            "button",
            {
              type: "button",
              className:
                "cms-page-preview-mode" + (view === "desktop" ? " cms-page-preview-mode--active" : ""),
              onClick: function () {
                self.setView("desktop");
              },
            },
            "Desktop"
          ),
          h(
            "button",
            {
              type: "button",
              className:
                "cms-page-preview-mode" + (view === "mobile" ? " cms-page-preview-mode--active" : ""),
              onClick: function () {
                self.setView("mobile");
              },
            },
            "Mobile"
          )
        ),
        h(
          "div",
          { className: "cms-page-preview-stage cms-page-preview-stage--" + view },
          h("iframe", {
            src: previewUrl(this.props),
            title: "Page preview (" + view + ")",
            className: "cms-page-preview-frame",
          })
        )
      );
    },
  });

  ["page", "nostalgic_knights", "nostalgic_days", "news", "contact"].forEach(function (name) {
    CMS.registerPreviewTemplate(name, PagePreview);
  });

  CMS.registerPreviewStyle("./preview-pane.css");
})();
