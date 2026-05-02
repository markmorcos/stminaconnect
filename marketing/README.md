# Marketing site — `stminaconnect.com`

Static site served by nginx. Deployed to the Raspberry-Pi cluster via the
`markmorcos/infrastructure` Helm chart (v0.4.7), kicked off by the workflow at
`.github/workflows/deploy-marketing.yml` on changes under `marketing/**`.

## Layout

```
marketing/
├── Dockerfile          # nginx:alpine, serves public/
├── nginx.conf          # security headers, gzip, /404 fallback
├── deployment.yaml     # Helm values (chart 0.4.7)
├── deno.jsonc          # `deno task render-legal`
├── scripts/
│   └── render-legal.ts # markdown → HTML for legal pages
├── templates/
│   └── legal.html      # wrapper used by render-legal.ts
└── public/             # everything that ends up under nginx html root
    ├── index.html      # landing page (hand-written, EN)
    ├── styles.css      # shared CSS for landing + legal + 404
    ├── 404.html
    ├── robots.txt
    ├── sitemap.xml
    ├── privacy/index.html        ← rendered from docs/legal/privacy.en.md
    ├── terms/index.html          ← rendered from docs/legal/terms.en.md
    ├── ar/privacy/index.html     ← docs/legal/privacy.ar.md
    ├── ar/terms/index.html       ← docs/legal/terms.ar.md
    ├── de/privacy/index.html     ← docs/legal/privacy.de.md
    └── de/terms/index.html       ← docs/legal/terms.de.md
```

## When the legal markdown changes

Re-render the HTML, commit both the markdown and the HTML together:

```bash
deno task render-legal
git add docs/legal marketing/public
git commit -m "legal: refresh privacy/terms after legal review"
git push
```

The deploy workflow only triggers on `marketing/**`, so committing the rendered
HTML is what kicks off the redeploy. (The markdown lives in `docs/legal/`,
outside `marketing/`, so it doesn't trigger by itself.)

## When the landing page changes

Edit `public/index.html` and `public/styles.css` directly. Push to main; deploy
fires automatically.

## Where things plug into the cluster

- **Image**: `ghcr.io/markmorcos/stminaconnect:<sha>` (built by the dispatcher).
- **Ingress host**: `stminaconnect.com` (DNS / cert handled cluster-side).
- **Trigger event**: `repository_dispatch` of type `deploy-stminaconnect`. The
  type is registered in `markmorcos/infrastructure/.github/workflows/deploy-app.yaml`
  under `on.repository_dispatch.types`.

## Local preview

```bash
docker build -t stminaconnect-marketing -f marketing/Dockerfile marketing
docker run --rm -p 8080:80 stminaconnect-marketing
# open http://localhost:8080/
```
