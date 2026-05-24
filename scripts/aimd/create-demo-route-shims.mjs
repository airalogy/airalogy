import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "../..")
const demoDist = path.resolve(projectRoot, "docs/aimd/.vitepress/dist/demo")
const routes = ["tutorial", "examples", "full", "core", "editor", "renderer", "recorder"]

function buildRedirectHtml(route) {
  const target = `../#/${route}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>AIMD Demo Redirect</title>
    <meta http-equiv="refresh" content="0;url=${target}" />
    <script>
      location.replace(${JSON.stringify(target)} + location.search + location.hash)
    </script>
  </head>
  <body>
    <p>Redirecting to demo route...</p>
    <p><a href="${target}">Continue</a></p>
  </body>
</html>
`
}

for (const route of routes) {
  const routeDir = path.join(demoDist, route)
  await mkdir(routeDir, { recursive: true })
  await writeFile(path.join(routeDir, "index.html"), buildRedirectHtml(route), "utf8")
}
