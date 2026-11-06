"""Shared helpers: spelling variants (US / UK / CA) and the data-pack writer.

Entry shape (JSON, short keys to keep the pack small):
  { "w": "Word",                       display form
    "i": {"us": "...", "uk": "..."},   IPA (optional)
    "e": "etymology text",             (optional)
    "s": [ {"p": "n|v|adj|adv|x", "d": "definition",
            "x": ["example", ...], "y": ["synonym", ...], "a": ["antonym", ...]} ] }
Spelling triples are [US, UK, CA].
"""
import json, os, re, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- spelling ----
OUR_STEMS = ("color honor favor neighbor humor labor flavor harbor behavior rumor vapor savior odor armor parlor "
             "splendor valor vigor rigor candor clamor fervor glamor tumor endeavor demeanor rancor ardor succor").split()
OUR_SUFFIXES = ["", "s", "ed", "ing", "ful", "fully", "less", "able", "ably", "ite", "ites", "ize", "ized", "izing", "ary"]
OUR_EXTRA = {"behavior": ["al", "ally", "ism", "ist", "ists"], "color": ["ation", "ist", "ists", "ant", "ants", "way"]}

RE_STEMS = [("center", "centre"), ("liter", "litre"), ("fiber", "fibre"), ("theater", "theatre"), ("caliber", "calibre"),
            ("luster", "lustre"), ("saber", "sabre"), ("somber", "sombre"), ("specter", "spectre"), ("miter", "mitre"),
            ("scepter", "sceptre"), ("meager", "meagre"), ("kilometer", "kilometre"), ("centimeter", "centimetre"),
            ("millimeter", "millimetre"), ("decimeter", "decimetre"), ("nanometer", "nanometre"),
            ("milliliter", "millilitre"), ("maneuver", "manoeuvre"), ("louver", "louvre")]

IZE_ENDINGS = [("ize", "ise"), ("ized", "ised"), ("izes", "ises"), ("izing", "ising"), ("ization", "isation"),
               ("izations", "isations"), ("izer", "iser"), ("izers", "isers"), ("izable", "isable")]
IZE_NEVER = re.compile(r"(size|sized|sizes|sizing|prize|prized|prizes|prizing|seize|seized|seizes|seizing|maize|baize|assize|assizes)$")

YZE_STEMS = ["analyze", "paralyze", "catalyze", "electrolyze", "hydrolyze", "dialyze", "breathalyze"]
YZE_ENDINGS = [("yze", "yse"), ("yzed", "ysed"), ("yzes", "yses"), ("yzing", "ysing"), ("yzer", "yser"), ("yzers", "ysers")]

# Hand-checked [US, UK, CA] triples. Canadian choices follow Canadian Oxford conventions; edit freely.
EXPLICIT = """
defense defence defence | defenses defences defences | defenseless defenceless defenceless
offense offence offence | offenses offences offences
pretense pretence pretence
gray grey grey | grays greys greys | grayer greyer greyer | grayest greyest greyest | grayish greyish greyish
catalog catalogue catalogue | catalogs catalogues catalogues | cataloged catalogued catalogued | cataloging cataloguing cataloguing
dialog dialogue dialogue | dialogs dialogues dialogues
analog analogue analogue
jewelry jewellery jewellery
plow plough plow | plows ploughs plows | plowed ploughed plowed | plowing ploughing plowing
mold mould mould | molds moulds moulds | molded moulded moulded | molding moulding moulding | moldy mouldy mouldy
smolder smoulder smoulder | smoldered smouldered smouldered | smoldering smouldering smouldering
sulfur sulphur sulphur | sulfate sulphate sulphate | sulfide sulphide sulphide
pajamas pyjamas pyjamas | pajama pyjama pyjama
aluminum aluminium aluminum
skeptic sceptic skeptic | skeptics sceptics skeptics | skeptical sceptical skeptical | skepticism scepticism skepticism
anesthesia anaesthesia anesthesia | anesthetic anaesthetic anesthetic | anesthetist anaesthetist anesthetist
pediatric paediatric pediatric | pediatrics paediatrics pediatrics | pediatrician paediatrician pediatrician
fetus foetus fetus | fetal foetal fetal
esophagus oesophagus esophagus
diarrhea diarrhoea diarrhea
hemoglobin haemoglobin hemoglobin | hemorrhage haemorrhage hemorrhage | hemophilia haemophilia hemophilia
edema oedema edema
estrogen oestrogen estrogen
leukemia leukaemia leukemia
anemia anaemia anemia | anemic anaemic anemic
orthopedic orthopaedic orthopedic
encyclopedia encyclopaedia encyclopedia
archeology archaeology archeology
traveled travelled travelled | traveling travelling travelling | traveler traveller traveller | travelers travellers travellers
canceled cancelled cancelled | canceling cancelling cancelling | cancelation cancellation cancellation
labeled labelled labelled | labeling labelling labelling
modeled modelled modelled | modeling modelling modelling | modeler modeller modeller
fueled fuelled fuelled | fueling fuelling fuelling
signaled signalled signalled | signaling signalling signalling
leveled levelled levelled | leveling levelling levelling
totaled totalled totalled | totaling totalling totalling
counselor counsellor counsellor | counselors counsellors counsellors | counseling counselling counselling
marvelous marvellous marvellous
jeweler jeweller jeweller | jewelers jewellers jewellers
enroll enrol enrol | enrolled enrolled enrolled | enrollment enrolment enrolment
fulfill fulfil fulfil | fulfillment fulfilment fulfilment | fulfills fulfils fulfils
skillful skilful skilful
installment instalment instalment
judgment judgement judgment
aging ageing aging
cozy cosy cozy | cozier cosier cozier
donut doughnut donut | donuts doughnuts donuts
airplane aeroplane airplane | airplanes aeroplanes airplanes
mustache moustache moustache | mustaches moustaches moustaches
ax axe axe | axes axes axes
yogurt yoghurt yogurt
inquire enquire inquire
cheque cheque cheque
"""


def explicit_triples():
    out = []
    for chunk in EXPLICIT.replace("\n", "|").split("|"):
        parts = chunk.split()
        if len(parts) == 3 and not (parts[0] == parts[1] == parts[2]):
            out.append(tuple(parts))
    return out


def derive_triples(lexicon):
    """lexicon: set of lowercase headwords. Returns a set of (us, uk, ca) triples.
    Rule-based families are only produced for words already in the lexicon (US form)."""
    lex = set(lexicon)
    triples = set(explicit_triples())

    # -or / -our
    for stem in OUR_STEMS:
        uk_stem = stem[:-2] + "our"
        for sfx in OUR_SUFFIXES + OUR_EXTRA.get(stem, []):
            us, uk = stem + sfx, uk_stem + sfx
            if us in lex or uk in lex:
                triples.add((us, uk, uk))
    # -er / -re
    for us_stem, uk_stem in RE_STEMS:
        forms = [(us_stem, uk_stem), (us_stem + "s", uk_stem + "s"),
                 (us_stem + "ed", uk_stem + "d"), (us_stem + "ing", uk_stem[:-1] + "ing")]
        for us, uk in forms:
            if us in lex or uk in lex:
                triples.add((us, uk, uk))
    # -ize / -ise (Canadian keeps -ize)
    for w in lex:
        if IZE_NEVER.search(w):
            continue
        for us_end, uk_end in IZE_ENDINGS:
            if w.endswith(us_end) and len(w) - len(us_end) >= 3:
                triples.add((w, w[: -len(us_end)] + uk_end, w))
                break
    # -yze / -yse (Canadian keeps -yze)
    for stem in YZE_STEMS:
        base = stem[:-3]
        for us_end, uk_end in YZE_ENDINGS:
            us, uk = base + us_end, base + uk_end
            if us in lex or uk in lex:
                triples.add((us, uk, us))
    return {t for t in triples if not (t[0] == t[1] == t[2])}



# ------------------------------------------------------- reverse lookup (by meaning) ----
# The app's "By meaning" search uses a small inverted index: word-stem -> headwords whose
# definitions contain it. js/engine.js has a matching tokenizer and stemmer (tests check both agree).
STOP = frozenset(("a an the of to in for or and with who whom whose which that this these those is are was were be been being "
                  "by on as at from it its not no into than then there their they them he she his her we you your but if so such "
                  "one ones something someone somebody anything thing things used use using usually often especially esp "
                  "having have has had do does done can may might will would very more most any some each other another "
                  "informal slang archaic obsolete dated rare uncommon historical figuratively figurative transitive intransitive "
                  "also about between during over under up out off through").split())
_TOK = re.compile(r"[a-z]+")
_UNDOUBLE = "bgmnprt"


def _undouble(t):
    if len(t) >= 3 and t[-1] == t[-2] and t[-1] in _UNDOUBLE:
        return t[:-1]
    return t


def stem_token(t):
    n = len(t)
    if n <= 3:
        return t
    if (t.endswith("ies") or t.endswith("ied")) and n > 4:
        return t[:-3] + "y"
    if t.endswith("ing") and n > 5:
        t = _undouble(t[:-3])
    elif t.endswith("ed") and n > 4:
        t = _undouble(t[:-2])
    elif t.endswith("es") and n > 4 and t[:-2].endswith(("s", "x", "z", "ch", "sh")):
        t = t[:-2]
    elif t.endswith("s") and not t.endswith(("ss", "us", "is")):
        t = t[:-1]
    if len(t) > 3 and t.endswith("e"):
        t = t[:-1]
    return t


def rev_terms(text, canon=None):
    """Stemmed search terms of a piece of text, in order (duplicates kept)."""
    out = []
    for t in _TOK.findall(text.lower()):
        if len(t) < 3 or t in STOP:
            continue
        if canon:
            t = canon(t)
        out.append(stem_token(t))
    return out


_B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _b36(n):
    if n == 0:
        return "0"
    s = ""
    while n:
        n, r = divmod(n, 36)
        s = _B36[r] + s
    return s


def write_reverse_index(out_dir, entries, pos, canon, cap=300):
    """Writes rev/<first letter>.txt. Line: stem TAB id+weight,id+weight,...
    id = line number of the headword in index.txt (base 36); weight 0-3 is the last character."""
    postings = {}
    for ent in entries.values():
        idx = pos.get(ent["w"])
        senses = ent.get("s") or []
        if idx is None or not senses:
            continue
        best = {}
        for si, s in enumerate(senses[:3]):
            for ti, t in enumerate(rev_terms(s["d"], canon)):
                w = (3 if ti < 6 else 2) if si == 0 else 1
                if best.get(t, 0) < w:
                    best[t] = w
        short = min(len(senses[0]["d"]), 1023)
        for t, w in best.items():
            postings.setdefault(t, []).append(((3 - w) << 40) | (short << 20) | idx)
    by_letter, total = {}, 0
    for t, lst in postings.items():
        lst.sort()
        lst = lst[:cap]
        total += len(lst)
        by_letter.setdefault(t[0], []).append(t + "\t" + ",".join(_b36(v & 0xFFFFF) + str(3 - (v >> 40)) for v in lst))
    for c, lines in by_letter.items():
        lines.sort()
        path = os.path.join(out_dir, "rev", c + ".txt")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return {"tokens": len(postings), "postings": total, "cap": cap}


# ------------------------------------------------------------------ writer ----
def chunk_key(key):
    k = re.sub(r"[^a-z]", "_", key.lower())
    return (k + "__")[:2]


def _dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def write_pack(out_dir, entries, forms, sources=None, label="full"):
    """entries: {lowercase key: entry dict}; forms: {type: [{"p","d","x"}...]}."""
    lexicon = set(entries.keys())
    triples = derive_triples(lexicon)

    # Merge UK/CA spellings into the US entry; keep the variants as index aliases.
    to_us = {}
    for us, uk, ca in triples:
        for v in (uk, ca):
            if v != us:
                to_us[v] = us
    for variant, us in list(to_us.items()):
        if variant in entries:
            ent = entries.pop(variant)
            if us in entries:
                continue                      # US entry wins, variant entry is dropped
            ent["w"] = us
            entries[us] = ent                 # only the variant existed: move it

    def canon(word):
        return to_us.get(word.lower(), word.lower())

    # Normalise synonyms / antonyms to the US spelling and drop duplicates.
    for ent in entries.values():
        for sense in ent["s"]:
            for k in ("y", "a"):
                if k in sense:
                    seen, clean = set(), []
                    for w in sense[k]:
                        c = canon(w)
                        if c not in seen and c != ent["w"].lower():
                            seen.add(c)
                            clean.append(c if w.islower() else w)
                    if clean:
                        sense[k] = clean
                    else:
                        del sense[k]

    # Index: every headword, plus alias lines for spelling variants.
    lines = {}
    for key, ent in entries.items():
        lines[ent["w"]] = None
    for variant, us in to_us.items():
        if us in entries:
            lines[variant + "|" + us] = None
    index = sorted(lines.keys(), key=lambda s: (s.split("|")[0].lower(), s))
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "index.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(index) + "\n")

    # "By meaning" index (needs the final index positions, so it is written here).
    pos = {line: i for i, line in enumerate(index)}
    reverse = write_reverse_index(out_dir, entries, pos, canon)

    # Dictionary chunks.
    chunks = {}
    for key, ent in entries.items():
        chunks.setdefault(chunk_key(key), {})[key] = ent
    for ck, body in chunks.items():
        _dump(os.path.join(out_dir, "dict", ck + ".json"), body)

    # Special forms.
    form_counts = {}
    for typ, items in forms.items():
        items = sorted(items, key=lambda x: x["p"].lower())
        _dump(os.path.join(out_dir, "forms", typ + ".json"), items)
        form_counts[typ] = len(items)

    # Spelling triples (also include explicit rows so definition text converts correctly).
    _dump(os.path.join(out_dir, "spelling.json"), sorted(triples))

    # Static grammar content for the Basics tab.
    import basics as basics_mod
    _dump(os.path.join(out_dir, "basics.json"), basics_mod.build())

    # Meta + file list (used by the Offline Download button).
    files = []
    for root, _, names in os.walk(out_dir):
        for n in names:
            if n == "meta.json":
                continue
            p = os.path.join(root, n)
            files.append({"path": os.path.relpath(p, out_dir).replace(os.sep, "/"), "bytes": os.path.getsize(p)})
    files.sort(key=lambda x: x["path"])
    meta = {
        "version": time.strftime("%Y.%m.%d.%H%M"),
        "pack": label,
        "words": len(entries),
        "indexLines": len(index),
        "forms": form_counts,
        "spellingGroups": len(triples),
        "reverse": reverse,
        "totalBytes": sum(x["bytes"] for x in files),
        "sources": sources or [],
        "files": files,
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    return meta
