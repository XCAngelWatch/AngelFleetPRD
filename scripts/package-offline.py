"""Package the verified site with a classic script that browsers can load from disk."""

import json
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path


root = Path(__file__).resolve().parents[1]
esbuild = root / "node_modules" / ".bin" / ("esbuild.cmd" if os.name == "nt" else "esbuild")
site = root / "dist"
manifest = json.loads((site / "build-manifest.json").read_text(encoding="utf-8"))
name = f"AngelFleet-docs-v{manifest['version']}-{manifest['publicationDate']}"
module_script = re.compile(r'<script type="module" src="assets/site\.js\?v=[a-f0-9]+"></script>')

with tempfile.TemporaryDirectory(dir=site) as temporary:
    work = Path(temporary)
    for entry, filename, option in [
        ("src/site.js", "offline-reader.js", "--external:./mermaid.js"),
        ("src/mermaid.js", "offline-diagrams.js", "--global-name=AngelFleetDiagrams"),
    ]:
        subprocess.run([
            str(esbuild), entry, "--bundle", option,
            "--format=iife", "--target=es2022", "--minify", "--legal-comments=linked",
            f"--outfile={work / filename}",
        ], cwd=root, check=True)
    archive = work / (name + ".zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(site.rglob("*")):
            if not path.is_file() or work in path.parents:
                continue
            relative = path.relative_to(site)
            if any(part.startswith(".") for part in relative.parts):
                continue
            if relative.parts[0] == "assets" and path.suffix not in {".css", ".svg"}:
                continue
            if relative.parts[0] != "licenses" and path.suffix not in {".html", ".md", ".json", ".css", ".svg"}:
                continue
            if path.name == "404.html":
                continue
            target = f"{name}/{relative.as_posix()}"
            if path.suffix == ".html":
                html, count = module_script.subn('<script src="assets/offline-reader.js" data-diagram-library="assets/offline-diagrams.js"></script>',
                                                  path.read_text(encoding="utf-8"))
                if count != 1:
                    raise ValueError(f"Cannot locate the reader in {relative}")
                bundle.writestr(target, html)
            else:
                bundle.write(path, target)
        for asset in work.glob("offline-*.js*"):
            bundle.write(asset, f"{name}/assets/{asset.name}")
        bundle.writestr(f"{name}/离线阅读.txt", "请先解压整个文件夹，再用浏览器打开 index.html。\n"
                        "站内搜索、流程图、工单和 Markdown 均可离线使用。访问外部源码及官方资料需要网络。\n")
    archive.replace(site / archive.name)
print(site / (name + ".zip"))
