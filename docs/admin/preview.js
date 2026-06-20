(function () {
  var PAGE_BY_COLLECTION = {
    nostalgic_knights: "nostalgic-knights.html",
    nostalgic_days: "nostalgic-days.html",
    news: "news.html",
    contact: "contact.html",
  };

  /* Site switches to desktop layout at 900px (see modern-gold-theme.css) */
  var DESKTOP_PREVIEW_WIDTH = 1280;

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
      return { view: "desktop", desktopScale: 1 };
    },
    componentDidMount: function () {
      var self = this;
      this._resizeHandler = function () {
        self.updateDesktopScale();
      };
      window.addEventListener("resize", this._resizeHandler);
      this.updateDesktopScale();
    },
    componentWillUnmount: function () {
      window.removeEventListener("resize", this._resizeHandler);
    },
    componentDidUpdate: function (_prevProps, prevState) {
      if (prevState.view !== this.state.view) {
        this.updateDesktopScale();
      }
    },
    setStageRef: function (el) {
      this._stageEl = el;
      this.updateDesktopScale();
    },
    updateDesktopScale: function () {
      if (!this._stageEl || this.state.view !== "desktop") {
        return;
      }
      var available = this._stageEl.clientWidth - 16;
      if (!available) {
        return;
      }
      var scale = Math.min(1, available / DESKTOP_PREVIEW_WIDTH);
      scale = Math.round(scale * 1000) / 1000;
      if (scale !== this.state.desktopScale) {
        this.setState({ desktopScale: scale });
      }
    },
    setView: function (view) {
      this.setState({ view: view }, this.updateDesktopScale);
    },
    renderDesktopFrame: function () {
      var scale = this.state.desktopScale;

      return h(
        "div",
        {
          className: "cms-page-preview-desktop-clip",
          style: {
            width: DESKTOP_PREVIEW_WIDTH * scale + "px",
            height: "calc((100vh - 3.75rem) * " + scale + ")",
          },
        },
        h(
          "div",
          {
            className: "cms-page-preview-scaler",
            style: {
              transform: "scale(" + scale + ")",
              transformOrigin: "top left",
            },
          },
          h("iframe", {
            src: previewUrl(this.props),
            title: "Page preview (desktop)",
            className: "cms-page-preview-frame",
          })
        )
      );
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
          {
            ref: this.setStageRef,
            className: "cms-page-preview-stage cms-page-preview-stage--" + view,
          },
          view === "desktop"
            ? this.renderDesktopFrame()
            : h("iframe", {
                src: previewUrl(this.props),
                title: "Page preview (mobile)",
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
