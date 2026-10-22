#!/usr/bin/env python3
"""Injects approved curriculum bundles (content/*.json) into index.html
between @@BUNDLE-START@@ / @@BUNDLE-END@@. Run after adding/editing content files,
then run tools/build_admin.py to propagate to admin.html."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
files = sorted((root / "content").glob("*.json"))
bundles = []
for f in files:
    data = json.loads(f.read_text(encoding="utf-8"))
    bundles.append({"bundleCode": data["bundleCode"], "rev": data.get("rev", 1), "payload": data["payload"]})
idx_path = root / "index.html"
src = idx_path.read_text(encoding="utf-8")
js = json.dumps(bundles, ensure_ascii=False, indent=1)
pattern = "const CURRICULUM_BUNDLE=" + "[\\s\\S]*?" + ";" + "\n" + "(/\\* @@BUNDLE-END@@ \\*/)"
if not re.search(pattern, src):
    raise SystemExit("ERROR: bundle injection pattern not matched")
new = re.sub(pattern,
             lambda m: "const CURRICULUM_BUNDLE=" + js + ";\n" + m.group(1),
             src, count=1)
idx_path.write_text(new, encoding="utf-8")
print(f"Injected {len(bundles)} bundle(s) into index.html")
