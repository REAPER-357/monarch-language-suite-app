# Monarch Language Suite

An offline dictionary, thesaurus, idiom finder and grammar guide. Canadian English is the default; US and UK
spelling are one tap away. Runs as a **GitHub Pages PWA** and as an **Android APK** (Capacitor) from the same files.

Made by REAPER-357.

| Tab | What it does |
| --- | --- |
| Dictionary | Words appear as you type. Wildcards (`c?t`, `un*able`), typo suggestions, and inflections (`ran` opens *run*). Definitions, examples, pronunciation, etymology, word of the day, favourites and history. |
| Thesaurus | Synonyms, antonyms and related words, grouped by meaning. Tap any word to jump to it. |
| Special Forms | Idioms, phrasal verbs, proverbs, similes, phrases, slang, abbreviations. |
| Basics | Parts of speech, the 12 verb tenses, a verb conjugator, irregular verbs, spelling differences, plurals, comparing adjectives, articles, modals, commonly confused words, punctuation. |

Settings: Canadian / American / British spelling, theme (Pure Black / Dark / Light), accent colour, text size,
pronunciation and etymology switches, and a "Download everything for offline use" button (PWA).

## IMPORTANT: the data pack

The `data/` folder in this project is a **tiny sample (91 words)** so the app can run and be tested. The banner in
Settings says "SAMPLE pack" until you build the real one. The full pack is built on your own computer from two free
downloads, then you copy the result into `data/`.

1. **Open English WordNet** (definitions, synonyms, antonyms): download the XML release from the
   `globalwordnet/english-wordnet` GitHub releases page. The file is named like `english-wordnet-2024.xml.gz`
   (a newer year is fine). Keep it gzipped, no need to unpack.
2. **English Wiktionary extract** (pronunciation, etymology, idioms, phrasal verbs, proverbs, slang): from
   kaikki.org, the English dictionary as raw JSON lines (`kaikki.org-dictionary-English.jsonl`, `.gz` also works).
   This one is large (gigabytes uncompressed).

Then, from this folder (needs Python 3, nothing to install):

```
python tools/build_data.py --oewn english-wordnet-2024.xml.gz --kaikki kaikki.org-dictionary-English.jsonl --out data
```

* `--lite` keeps only Wiktionary words that WordNet also has. Smaller download, faster on phones, much less RAM.
  **I suggest you build with `--lite` first**, try it on your phone, and only go to the full version if you miss words.
* `--sample` rebuilds the tiny test pack.
* Use only one source if you like (`--oewn` alone or `--kaikki` alone).

Check the result with `python tests/test_build.py` (uses small built-in fixtures) and `node tests/engine.test.js`.
The pipeline has been tested on small fixtures that follow the real file formats. It has not yet been run on the
full downloads, so if the script stops with an error on your files, send me the message and I'll fix it.

## Icons (your local packs)

No icons are loaded from the internet. `assets/icons/` holds simple placeholders so the app looks right straight
away. To use your real Lucide and Heroicons copies:

```
python tools/copy_icons.py --lucide /path/to/lucide-main --heroicons /path/to/heroicons-master
```

## Run it on your computer

Browsers block `fetch` from `file://`, so serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## GitHub Pages (PWA)

1. Create a GitHub repository and upload this folder's contents (not `tools/`, `tests/`, `_src/` or `www/` if you want it lean; they are harmless).
2. Settings, Pages, Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open `https://<you>.github.io/<repo>/` on your phone and use the browser's "Install app" / "Add to Home screen".
4. Open Settings in the app and tap **Download everything for offline use** once, on Wi-Fi.

Notes: a repository should stay under about 1 GB and each file under 100 MB (the data is split into small files, so that is fine).
After you upload a new data pack, the app asks you to reopen it once to pick up the update.

## Android APK (Capacitor)

The APK carries every data file inside it, so it needs no download and no service worker.

```
python tools/make_www.py                 # copies the app into www/
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Monarch Language Suite" com.reaper357.monarch --web-dir=www
npx cap add android
npx cap sync android
npx cap open android                     # opens Android Studio: Build > Build APK(s)
```

Each time you change the app or the data: run `python tools/make_www.py` again, then `npx cap sync android`.

## Spelling

Canadian spelling follows the usual Canadian pattern: -our (colour), -re (centre), -ize (organize), -ence for
defence and offence, and doubled consonants in travelled and cancelled. Where Canadians genuinely vary, I picked one;
the rules live in `tools/packlib.py` and can be changed, then rebuild the data.

## Licences

* Open English WordNet: CC BY 4.0.
* English Wiktionary (via Kaikki.org / wiktextract): CC BY-SA 4.0. Data built from it stays under CC BY-SA, so keep the attribution in Settings, About.
* App code and grammar notes: yours.
