#!/usr/bin/env python3
"""Builds admin.html from tools/admin.template.html by injecting the shared
CSS and core JS extracted from index.html (between @@CORE-START@@/@@CORE-END@@).
Run after any change to the core engine in index.html."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
idx = (root / "index.html").read_text(encoding="utf-8")
tpl = (root / "tools/admin.template.html").read_text(encoding="utf-8")

style = re.search(r"<style>(.*?)</style>", idx, re.S).group(1)
m = re.search(r"/\* @@CORE-START@@.*?\*/\n(.*?)\n/\* @@CORE-END@@ \*/", idx, re.S)
if not m:
    sys.exit("ERROR: core markers not found in index.html")
core = m.group(1)
if "@@CORE@@" not in tpl or "@@STYLE@@" not in tpl:
    sys.exit("ERROR: placeholders missing in template")
out = tpl.replace("/* @@STYLE@@ */", style.strip()).replace("/* @@CORE@@ */", core.strip())
(root / "admin.html").write_text(out, encoding="utf-8")
print(f"admin.html built ({len(out)//1024} KB): core {len(core.splitlines())} lines injected")
