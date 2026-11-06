#!/usr/bin/env python3
"""Copies the app into a clean `www/` folder for the Android (Capacitor) build.

  python tools/make_www.py

The result is the folder to publish on GitHub Pages (the PWA needs sw.js and manifest.json)
and the folder the Android build wraps. In the APK the service worker is not used, because the
app skips it when running inside Capacitor. Tests, build tools and caches are left out.
"""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "www")
FILES = ["index.html", "manifest.json", "sw.js", "icon.png", "small-icon.png"]
DIRS = ["css", "js", "assets", "data"]


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for f in FILES:
        shutil.copy2(os.path.join(ROOT, f), os.path.join(OUT, f))
    for d in DIRS:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d),
                        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "README.txt"))
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    count = sum(len(fs) for _, _, fs in os.walk(OUT))
    print("www/ ready: %d files, %.1f MB" % (count, total / 1e6))
    if not os.path.exists(os.path.join(ROOT, "data", "meta.json")):
        print("Warning: data/meta.json is missing. Run tools/build_data.py first.", file=sys.stderr)


if __name__ == "__main__":
    main()
