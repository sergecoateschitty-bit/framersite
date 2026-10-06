import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

/**
 * `vite build --mode single` produces one self-contained index.html (all JS,
 * CSS and the pdf.js worker inlined) that can be opened from disk or hosted
 * anywhere as a single file.
 */
function inlineEverything(): Plugin {
    let outDir = "dist-single"
    return {
        name: "inline-everything",
        apply: "build",
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir)
        },
        // Runs after Vite has finished post-processing and writing chunks.
        closeBundle() {
            const htmlPath = join(outDir, "index.html")
            let html = readFileSync(htmlPath, "utf8")
            html = html.replace(/<script([^>]*) src="\.\/([^"]+)"[^>]*><\/script>/g, (_m, _attrs, file: string) => {
                const code = readFileSync(join(outDir, file), "utf8").replace(/<\/script/gi, "<\\/script")
                return `<script type="module">${code}</script>`
            })
            html = html.replace(/<link rel="stylesheet"[^>]* href="\.\/([^"]+)"[^>]*>/g, (_m, file: string) => {
                return `<style>${readFileSync(join(outDir, file), "utf8")}</style>`
            })
            // Drop the module preload hints for files that are now inline.
            html = html.replace(/<link rel="modulepreload"[^>]*>/g, "")
            writeFileSync(htmlPath, html)
            rmSync(join(outDir, "assets"), { recursive: true, force: true })
        },
    }
}

export default defineConfig(({ mode }) => {
    const single = mode === "single"
    return {
        base: "./",
        plugins: [react(), ...(single ? [inlineEverything()] : [])],
        build: {
            target: "es2022",
            outDir: single ? "dist-single" : "dist",
            chunkSizeWarningLimit: 4000,
            assetsInlineLimit: single ? 100_000_000 : 4096,
            rollupOptions: single ? { output: { inlineDynamicImports: true } } : {},
        },
        worker: { format: "es" },
    }
})
