# Third-party software

The documentation website is built with Markdown-it and esbuild, and renders diagrams with Mermaid. Exact dependency versions and their dependency tree are pinned in `package-lock.json`.

- [Markdown-it](https://github.com/markdown-it/markdown-it): MIT
- [Mermaid](https://github.com/mermaid-js/mermaid): MIT
- [esbuild](https://github.com/evanw/esbuild): MIT

The build preserves bundled third-party legal comments in linked `*.LEGAL.txt` files and copies available license and notice files for browser-bundled packages to `dist/licenses/`. The generated package inventory is available at `dist/licenses/README.md`.

These dependency licenses do not assign an additional license to the PRD content or this repository's original work.
