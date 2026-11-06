#!/usr/bin/env python3
"""Runs the real build script on tiny fixtures and checks the output.  python3 tests/test_build.py"""
import json, os, subprocess, sys, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import packlib

fails = 0
def check(name, cond, info=""):
    global fails
    if cond:
        print("ok  ", name)
    else:
        fails += 1
        print("FAIL", name, info)

out = tempfile.mkdtemp(prefix="monarch-build-")
try:
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build_data.py"),
                        "--oewn", os.path.join(ROOT, "tools/fixtures/oewn-mini.xml"),
                        "--kaikki", os.path.join(ROOT, "tools/fixtures/kaikki-mini.jsonl"),
                        "--out", out], capture_output=True, text=True)
    check("build script exits 0", r.returncode == 0, r.stderr[-400:])

    meta = json.load(open(os.path.join(out, "meta.json")))
    index = open(os.path.join(out, "index.txt"), encoding="utf-8").read().split("\n")
    forms = {t: json.load(open(os.path.join(out, "forms", t + ".json"))) for t in ("idiom", "phrasal", "proverb")}
    def entry(word):
        p = os.path.join(out, "dict", packlib.chunk_key(word) + ".json")
        if not os.path.exists(p):
            return None
        return json.load(open(p, encoding="utf-8")).get(word)

    happy = entry("happy")
    check("happy entry exists", happy is not None)
    check("happy has definition + example", happy["s"][0]["d"].startswith("enjoying") and happy["s"][0]["x"] == ["a happy smile"])
    check("happy synonyms from synset", happy["s"][0]["y"] == ["glad"], happy["s"][0].get("y"))
    check("happy antonym from sense relation", happy["s"][0]["a"] == ["unhappy"], happy["s"][0].get("a"))
    check("IPA merged from Wiktionary", happy.get("i") == {"us": "/ˈhæpi/", "uk": "/ˈhapi/"}, happy.get("i"))
    check("etymology merged", happy.get("e", "").startswith("From Middle English"))

    color = entry("color")
    check("US spelling is the canonical key", color is not None and entry("colour") is None)
    check("colour dropped from synonyms of itself, hue kept", color["s"][0]["y"] == ["hue"], color["s"][0].get("y"))
    check("alias line colour|color in index", "colour|color" in index)
    check("index sorted", [l.split("|")[0].lower() for l in index if l] == sorted(l.split("|")[0].lower() for l in index if l))

    org = entry("organize")
    check("organise merged into organize, not listed as its own synonym", org is not None and "y" not in org["s"][0], org)
    check("organise has no entry of its own", entry("organise") is None)
    check("organise alias in index", "organise|organize" in index)

    ice = entry("ice cream")
    check("underscores become spaces", ice is not None and ice["w"] == "ice cream")
    check("entry without definition is dropped", entry("nodef") is None)

    toque = entry("toque")
    check("Wiktionary-only word added", toque is not None and toque["s"][0]["p"] == "n" and toque["i"]["us"] == "/tuːk/")
    check("proper nouns skipped", entry("paris") is None)
    check("non-English skipped", entry("bonjour") is None)
    check("form-of senses skipped", entry("colors") is None)

    check("idiom captured", sorted(i["p"] for i in forms["idiom"]) == ["break the ice", "kick the bucket"] and forms["idiom"][0]["x"], [i["p"] for i in forms["idiom"]])
    check("single word with idiomatic sense stays a normal word", entry("freely") is not None)
    check("idiomatic multi-word beats slang tag", entry("kick the bucket") is None)
    check("phrasal verb captured", [i["p"] for i in forms["phrasal"]] == ["give up"])
    check("proverb captured", len(forms["proverb"]) == 1 and forms["proverb"][0]["p"].startswith("A stitch"))
    check("idioms are not also dictionary entries", entry("break the ice") is None)

    sp = json.load(open(os.path.join(out, "spelling.json")))
    check("spelling triples include color/colour", ["color", "colour", "colour"] in sp)
    check("spelling triples include organize/organise (CA keeps -ize)", ["organize", "organise", "organize"] in sp)
    check("basics.json written", os.path.exists(os.path.join(out, "basics.json")))
    listed = {f["path"] for f in meta["files"]}
    check("meta file list covers everything", {"index.txt", "basics.json", "spelling.json", "forms/idiom.json"} <= listed, listed)
finally:
    shutil.rmtree(out, ignore_errors=True)

# rule safety
lex = {"prize", "organize", "downsize", "size", "seize", "recognize", "colorful", "center", "door", "dour", "for", "four"}
tr = packlib.derive_triples(lex)
check("prize/size/seize are never turned into -ise", not any(t[0] in ("prize", "size", "seize", "downsize") for t in tr))
check("door/dour/for/four untouched by -our rule", not any(t[0] in ("door", "for") for t in tr))
check("colorful -> colourful", ("colorful", "colourful", "colourful") in tr)
check("center -> centre", ("center", "centre", "centre") in tr)

print("\n%s" % ("ALL PASSED" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
