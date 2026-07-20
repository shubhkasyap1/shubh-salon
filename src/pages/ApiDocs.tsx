import { useEffect } from "react";

const SWAGGER_CSS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css";
const SWAGGER_BUNDLE = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
const SWAGGER_PRESET = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

function loadStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

export default function ApiDocs() {
  useEffect(() => {
    document.title = "API Documentation | SaloonBook";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "Interactive OpenAPI docs for SaloonBook edge functions and REST endpoints.");
    let cancelled = false;
    loadStylesheet(SWAGGER_CSS);
    (async () => {
      try {
        await loadScript(SWAGGER_BUNDLE);
        await loadScript(SWAGGER_PRESET);
        if (cancelled) return;
        // @ts-expect-error injected globals
        const SwaggerUIBundle = window.SwaggerUIBundle;
        // @ts-expect-error injected globals
        const SwaggerUIStandalonePreset = window.SwaggerUIStandalonePreset;
        SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "BaseLayout",
          tryItOutEnabled: true,
          persistAuthorization: true,
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">SaloonBook API Documentation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore and test every Edge Function and REST endpoint. Authorize with a Bearer JWT and the publishable apikey to try requests live.
          </p>
        </div>
      </header>
      <main>
        <div id="swagger-ui" className="bg-white" />
      </main>
    </div>
  );
}