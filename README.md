# Monarch Language Suite

An offline dictionary, thesaurus, idiom finder and grammar guide. Canadian English is the default; US and UK
spelling are one tap away. Runs as a **GitHub Pages PWA** and as an **Android APK** (Capacitor) from the same files.

Made by REAPER-357.

| Tab | What it does |
| --- | --- |
| Dictionary | Words appear as you type. **Browse by letter** (tap A–Z, jump to ca / ce / ch…), and **By meaning** search: describe a word ("a person who studies the stars") and it finds candidates. Wildcards (`c?t`, `un*able`), typo suggestions, and inflections (`ran` opens *run*). Definitions, examples, pronunciation, etymology, word of the day, favourites and history. |
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

Check the result with `python3 tests/test_build.py`, `node tests/engine.test.js` and `node tests/reverse.test.js` (small built-in fixtures).
The pipeline has been tested on small fixtures that follow the real file formats. It has not yet been run on the
full downloads, so if the script stops with an error on your files, send me the message and I'll fix it.

## Search by meaning

The Dictionary tab has a **Words / By meaning** switch. Meaning search works offline from a small index (`data/rev/`,
26 files) that `build_data.py` creates from the definitions, so **rebuild the data pack once** to get it. The build
prints its size ("meaning-search index: ... MB"). It matches the words you type against definitions, so it finds
words whose definitions are close to your description. It is not an AI search: plain, specific words work best.

## Top margin

The header sits 1 cm below the top of the screen so it clears the clock and battery. To change it, edit
`--top-gap: 1cm;` at the top of `css/monarch.css`.

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

1. Run `python3 tools/make_www.py`. It builds a clean **`www/`** folder with exactly what the site needs.
2. Upload the **contents of `www/`** to your GitHub repository (so `index.html` is at the top of the repo or of the folder Pages serves).
3. Settings, Pages, Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
4. Open `https://<you>.github.io/<repo>/` on your phone. After one reload, Chrome menu, **Install app**.
5. Open Settings in the app and tap **Download everything for offline use** once, on Wi-Fi.

These files must all open in a browser (a 404 on any of the first four is why Chrome says "This app cannot be installed"):
`/<repo>/manifest.json`, `/<repo>/sw.js`, `/<repo>/icon.png` (512x512), `/<repo>/small-icon.png` (192x192), then
`index.html`, `css/`, `js/`, `assets/`, `data/`.

**Updates.** The app always asks the server for the newest version first: app files and the small data files are re-checked
on every open, and again when you switch back to the app. A rebuilt data pack gets a new version number, so the old saved copy is
dropped automatically (tap Download for offline again afterwards). Settings has **Check for updates and reload** if you want it now.
GitHub Pages takes about a minute to publish after an upload.

Notes: a repository should stay under about 1 GB and each file under 100 MB (the data is split into small files, so that is fine).

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
