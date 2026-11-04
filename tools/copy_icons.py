#!/usr/bin/env python3
"""Copies the icons Monarch needs from your local icon packs into assets/icons/.

  python tools/copy_icons.py --lucide  /path/to/lucide-main  --heroicons /path/to/heroicons-master

Lucide icons are read from <lucide>/icons/<name>.svg.
The one filled icon (star-filled) comes from Heroicons: <heroicons>/optimized/24/solid/star.svg
(older Heroicons downloads use <heroicons>/src/24/solid/star.svg, that works too).
Nothing is fetched from the internet. Existing files in assets/icons/ are replaced.
"""
import argparse
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, '..', 'assets', 'icons')

# keep in sync with ICON_NAMES in js/app.js
LUCIDE = ['settings', 'book-open', 'arrow-right-left', 'quote', 'graduation-cap', 'search', 'x',
          'arrow-left', 'chevron-right', 'volume-2', 'star', 'shuffle', 'copy', 'download',
          'trash-2', 'history', 'tag', 'clock', 'refresh-cw', 'list', 'languages', 'layers',
          'trending-up', 'type', 'key', 'circle-help', 'pilcrow', 'circle-alert']
HERO_SOLID = {'star-filled': 'star'}


def find(base, rels):
    for r in rels:
        p = os.path.join(base, *r.split('/'))
        if os.path.isfile(p):
            return p
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--lucide', help='folder of lucide-main (contains icons/)')
    ap.add_argument('--heroicons', help='folder of heroicons-master')
    a = ap.parse_args()
    if not a.lucide and not a.heroicons:
        ap.error('give --lucide and/or --heroicons')
    os.makedirs(DEST, exist_ok=True)
    missing = []
    if a.lucide:
        for n in LUCIDE:
            src = find(a.lucide, ['icons/%s.svg' % n, '%s.svg' % n])
            if src:
                shutil.copyfile(src, os.path.join(DEST, n + '.svg'))
            else:
                missing.append(n)
    if a.heroicons:
        for n, h in HERO_SOLID.items():
            src = find(a.heroicons, ['optimized/24/solid/%s.svg' % h, 'src/24/solid/%s.svg' % h])
            if src:
                shutil.copyfile(src, os.path.join(DEST, n + '.svg'))
            else:
                missing.append(n)
    print('Copied icons to', os.path.abspath(DEST))
    if missing:
        print('Not found (placeholder kept, if any):', ', '.join(missing))
        sys.exit(1)


if __name__ == '__main__':
    main()
