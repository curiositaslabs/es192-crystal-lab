"""Build index.html (the GitHub Pages page) from crystal-lab.html (the source).

crystal-lab.html holds the styles, markup and script with no <html>/<head> wrapper.
This script wraps it in a document with a charset,
viewport, description and an inline favicon (without the favicon, GitHub Pages logs a /favicon.ico 404).

Usage, from the repo root:  python3 tools/build.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "crystal-lab.html")
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "index.html")

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%23a51c30' stroke-width='2'%3E%3Cellipse cx='16' cy='16' rx='14' ry='5.5'/%3E%3Cellipse cx='16' cy='16' rx='14' ry='5.5' transform='rotate(60 16 16)'/%3E%3Cellipse cx='16' cy='16' rx='14' ry='5.5' transform='rotate(120 16 16)'/%3E%3C/g%3E%3Ccircle cx='16' cy='16' r='3.2' fill='%23a51c30'/%3E%3C/svg%3E">
<meta name="description" content="Interactive bonding, crystal-structure, stacking, atom-raft, dislocation and phase-diagram models for ES 192, Harvard SEAS.">
<style>html{color-scheme:light}</style>
'''

s = open(src, encoding="utf-8").read()
i = s.index('<header class="bar">')   # everything before the top bar belongs in <head>
open(out, "w", encoding="utf-8").write(HEAD + s[:i] + "</head>\n<body>\n" + s[i:] + "\n</body>\n</html>\n")
print("wrote", os.path.relpath(out, ROOT))
