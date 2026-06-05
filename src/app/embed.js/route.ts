import { NextResponse } from "next/server"

const embedScript = String.raw`
(function () {
  var currentScript = document.currentScript;
  if (!currentScript) return;

  var slug = currentScript.getAttribute("data-slug");
  if (!slug) return;

  var baseUrl = currentScript.getAttribute("data-base-url") || new URL(currentScript.src).origin;
  var mode = currentScript.getAttribute("data-mode") || "button";
  var color = currentScript.getAttribute("data-color") || "#059669";
  var text = currentScript.getAttribute("data-text") || "Book now";
  var bookingUrl = baseUrl.replace(/\/$/, "") + "/book/" + encodeURIComponent(slug);
  var target = currentScript.parentElement || document.body;

  function createButton() {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "min-height:44px",
      "padding:12px 20px",
      "border:0",
      "border-radius:8px",
      "background:" + color,
      "color:#fff",
      "font:600 15px/1.2 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "cursor:pointer",
      "box-shadow:0 8px 20px rgba(5,150,105,.18)"
    ].join(";");
    return button;
  }

  function createFrame() {
    var iframe = document.createElement("iframe");
    iframe.src = bookingUrl + "?embedded=1";
    iframe.title = "Book an appointment";
    iframe.loading = "lazy";
    iframe.style.cssText = [
      "display:block",
      "width:100%",
      "min-width:280px",
      "height:760px",
      "border:1px solid #e5e7eb",
      "border-radius:8px",
      "background:#fff"
    ].join(";");
    return iframe;
  }

  function openPopup() {
    var overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:20px",
      "background:rgba(15,23,42,.56)"
    ].join(";");

    var shell = document.createElement("div");
    shell.style.cssText = "position:relative;width:min(960px,100%);height:min(820px,92vh);";

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close booking");
    close.style.cssText = "position:absolute;right:10px;top:10px;z-index:1;width:36px;height:36px;border:0;border-radius:999px;background:#111827;color:#fff;font-size:24px;line-height:1;cursor:pointer;";

    var frame = createFrame();
    frame.style.height = "100%";
    frame.style.boxShadow = "0 24px 70px rgba(15,23,42,.28)";

    close.addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) overlay.remove();
    });

    shell.appendChild(close);
    shell.appendChild(frame);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
  }

  if (mode === "inline") {
    target.insertBefore(createFrame(), currentScript);
    return;
  }

  var button = createButton();
  if (mode === "link") {
    button.addEventListener("click", function () { window.location.href = bookingUrl; });
  } else {
    button.addEventListener("click", openPopup);
  }
  target.insertBefore(button, currentScript);
}());
`

export function GET() {
  return new NextResponse(embedScript, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
