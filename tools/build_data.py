#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monarch Language Suite - data builder
=====================================

Turns two public sources into the small files the app reads offline (via tools/packlib.py):

  --oewn   Open English WordNet, WN-LMF XML  (english-wordnet-2024.xml or .xml.gz)
           definitions, examples, synonyms, antonyms
  --kaikki English Wiktionary extract, JSONL (kaikki.org-dictionary-English.jsonl or .gz)
           pronunciation, etymology, extra senses, idioms, phrasal verbs, proverbs,
           similes, phrases, abbreviations, slang

Use either one alone, or both for the Full pack.

  python tools/build_data.py --oewn english-wordnet-2024.xml.gz --kaikki kaikki-English.jsonl --out data
  python tools/build_data.py --sample --out data        # tiny hand-made test pack

Options:
  --lite     keep only Wiktionary words that WordNet also has (smaller, needs less RAM)

Licences carry over: WordNet is CC BY 4.0, Wiktionary is CC BY-SA 4.0 (see the app's About page).
"""
import argparse
import gzip
import json
import os
import re
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import packlib  # noqa: E402

POS_CODE = {
    'n': 'n', 'noun': 'n', 'v': 'v', 'verb': 'v', 'a': 'adj', 's': 'adj', 'adj': 'adj',
    'r': 'adv', 'adv': 'adv', 'intj': 'interj', 'prep': 'prep', 'conj': 'conj', 'pron': 'pron',
    'det': 'det', 'article': 'det', 'num': 'num', 'particle': 'part', 'phrase': 'phr',
    'prep_phrase': 'phr', 'adv_phrase': 'phr', 'proverb': 'phr',
}
SKIP_POS = {'name', 'character', 'symbol', 'punct', 'romanization', 'han_char', 'hanzi', 'kanji',
            'hanja', 'syllable', 'num_sym', 'letter'}
PARTICLES = {'up', 'down', 'out', 'in', 'off', 'on', 'over', 'away', 'back', 'through', 'around',
             'apart', 'along', 'by', 'across', 'aside', 'forward', 'ahead', 'under', 'about',
             'round', 'together'}
# usage labels worth showing in front of a definition
LABELS = {'informal', 'slang', 'colloquial', 'dated', 'archaic', 'obsolete', 'rare', 'offensive',
          'vulgar', 'derogatory', 'formal', 'literary', 'humorous', 'figuratively', 'Canada', 'UK',
          'US', 'Australia', 'Ireland', 'Scotland', 'Newfoundland', 'Quebec', 'historical',
          'dialectal', 'euphemistic', 'ironic', 'poetic', 'uncountable', 'plural-only'}
STOP = {'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'that', 'is', 'for', 'with', 'as', 'by',
        'on', 'be', 'it', 'at', 'from', 'one', 'who', 'which', 'having', 'not'}
SENSE_CAP = 40


# --------------------------------------------------------------------------- helpers
def open_any(path, text=False):
    if path.endswith('.gz'):
        return gzip.open(path, 'rt', encoding='utf-8') if text else gzip.open(path, 'rb')
    return open(path, 'r', encoding='utf-8') if text else open(path, 'rb')


def local(tag):
    return tag.rsplit('}', 1)[-1]


def norm_key(w):
    return unicodedata.normalize('NFC', w.replace('_', ' ')).strip().lower()


def dedupe(seq):
    seen, out = set(), []
    for x in seq:
        k = x.lower()
        if x and k not in seen:
            seen.add(k)
            out.append(x)
    return out


def toks(text):
    return {t for t in re.findall(r'[a-z]{3,}', text.lower()) if t not in STOP}


def similar(a, b, limit=0.5):
    ta, tb = toks(a), toks(b)
    if not ta or not tb:
        return False
    return len(ta & tb) / float(len(ta | tb)) >= limit


def names_of(items):
    out = []
    for it in items or []:
        w = it.get('word') if isinstance(it, dict) else it
        if w and isinstance(w, str) and len(w) <= 40:
            out.append(w)
    return out


def label_prefix(tags):
    use = [t for t in (tags or []) if t in LABELS][:3]
    return '(' + ', '.join(use) + ') ' if use else ''


def is_name(form):
    """Proper nouns and initialisms from WordNet (Paris, DNA) are left out."""
    return bool(form) and (form[0].isupper() or form[0].isdigit())


# --------------------------------------------------------------------------- WordNet
def load_oewn(path, entries, log):
    log('Reading WordNet: ' + path)
    lemmas = []                       # (form, pos, [(sense id, synset id, [antonym sense ids])])
    sense_form, synsets = {}, {}
    members = defaultdict(list)
    with open_any(path) as f:
        for _ev, el in ET.iterparse(f, events=('end',)):
            t = local(el.tag)
            if t == 'LexicalEntry':
                lemma = pos = None
                senses = []
                for ch in el:
                    ct = local(ch.tag)
                    if ct == 'Lemma':
                        lemma, pos = ch.get('writtenForm'), ch.get('partOfSpeech')
                    elif ct == 'Sense':
                        ants = [sr.get('target') for sr in ch
                                if local(sr.tag) == 'SenseRelation' and sr.get('relType') == 'antonym']
                        senses.append((ch.get('id'), ch.get('synset'), ants))
                if lemma and senses:
                    lemmas.append((lemma, pos, senses))
                    for sid, syn, _a in senses:
                        sense_form[sid] = lemma
                        members[syn].append(lemma)
                el.clear()
            elif t == 'Synset':
                d, ex = None, []
                for ch in el:
                    ct = local(ch.tag)
                    if ct == 'Definition' and d is None:
                        d = (ch.text or '').strip()
                    elif ct == 'Example':
                        ex.append((ch.text or '').strip())
                synsets[el.get('id')] = {'d': d, 'x': [e for e in ex if e]}
                el.clear()
    log('  %d lemmas, %d synsets' % (len(lemmas), len(synsets)))

    for form, pos, senses in lemmas:
        if is_name(form):
            continue
        key = norm_key(form)
        if not key or '|' in key or len(key) > 60:
            continue
        code = POS_CODE.get(pos, 'x')
        out = []
        for sid, syn, ants in senses:
            ss = synsets.get(syn)
            if not ss or not ss['d']:
                continue
            s = {'p': code, 'd': ss['d']}
            if ss['x']:
                s['x'] = ss['x'][:2]
            ys = dedupe([norm_key(m) for m in members[syn] if norm_key(m) != key and not is_name(m)])
            if ys:
                s['y'] = ys[:12]
            an = dedupe([norm_key(sense_form[a]) for a in ants if a in sense_form])
            if an:
                s['a'] = an[:8]
            out.append(s)
        if not out:
            continue
        e = entries.get(key)
        if e is None:
            e = entries[key] = {'w': key, 's': []}
        e['s'].extend(out)
    return entries


# --------------------------------------------------------------------------- Wiktionary
def category_names(e):
    names = set()
    for c in e.get('categories') or []:
        names.add((c.get('name') if isinstance(c, dict) else str(c)).lower())
    for s in e.get('senses') or []:
        for c in s.get('categories') or []:
            names.add((c.get('name') if isinstance(c, dict) else str(c)).lower())
    return names


def classify_special(word, pos, cats, senses):
    multi = ' ' in word
    joined = ' | '.join(cats)
    if 'phrasal verb' in joined or (multi and pos == 'verb' and len(word.split(' ')) == 2
                                    and word.split(' ')[-1] in PARTICLES):
        return 'phrasal'
    if pos == 'proverb' or 'proverbs' in joined:
        return 'proverb'
    if 'similes' in joined:
        return 'simile'
    if 'idioms' in joined:
        return 'idiom'
    # The post-processed Kaikki file has most categories stripped, but senses keep the
    # "idiomatic" tag. Only multi-word entries count: a single word such as "free" can
    # have one idiomatic sense and is still an ordinary dictionary word.
    if multi and any('idiomatic' in (s.get('tags') or []) for s in senses):
        return 'idiom'
    if pos == 'abbrev' or any(x in joined for x in ('initialisms', 'acronyms', 'abbreviations')):
        return 'abbr'
    if senses and all('slang' in (s.get('tags') or []) for s in senses):
        return 'slang'
    if multi and pos in ('phrase', 'prep_phrase', 'adv_phrase', 'intj'):
        return 'phrase'
    return None


def pick_ipa(sounds):
    out = {}
    for s in sounds or []:
        ipa = s.get('ipa') if isinstance(s, dict) else None
        if not ipa:
            continue
        tags = [str(t).lower() for t in (s.get('tags') or [])]
        is_us = any(t == 'us' or 'general-american' in t or 'american' in t for t in tags)
        is_uk = any(t == 'uk' or 'received-pronunciation' in t or t == 'british' for t in tags)
        is_ca = any('canad' in t for t in tags)
        if is_us:
            out.setdefault('us', ipa)
        if is_uk:
            out.setdefault('uk', ipa)
        if is_ca and 'us' not in out:
            out['us'] = ipa
        if not (is_us or is_uk or is_ca):
            out.setdefault('us', ipa)
    return out


def load_kaikki(path, entries, forms, opts, log):
    log('Reading Wiktionary: ' + path)
    n = added = 0
    with open_any(path, text=True) as f:
        for line in f:
            n += 1
            if n % 200000 == 0:
                log('  %d lines...' % n)
            # The raw Wiktionary dump holds hundreds of languages. Skip lines that clearly
            # are not English before the slow JSON parse (a line that merely mentions
            # "en" somewhere still gets parsed and checked properly below).
            if '"lang_code"' in line and '"lang_code": "en"' not in line and '"lang_code":"en"' not in line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            word, pos = e.get('word'), e.get('pos')
            if e.get('lang_code', 'en') != 'en' or not word or len(word) > 80 or '|' in word \
                    or pos in SKIP_POS:
                continue
            good = [s for s in (e.get('senses') or [])
                    if s.get('glosses') and not s.get('form_of') and not s.get('alt_of')]
            if not good:
                continue

            stype = classify_special(word, pos, category_names(e), good)
            if stype:
                parts = []
                for s in good[:4]:
                    g = ': '.join(x for x in s['glosses'] if x)
                    if g:
                        parts.append(label_prefix(s.get('tags')) + g)
                if not parts:
                    continue
                d = parts[0] if len(parts) == 1 else '  '.join('%d) %s' % (i + 1, p) for i, p in enumerate(parts))
                x = [ex['text'] for s in good for ex in (s.get('examples') or [])
                     if isinstance(ex, dict) and ex.get('text') and len(ex['text']) <= 220][:2]
                item = {'p': word, 'd': d}
                if x:
                    item['x'] = x
                forms[stype].append(item)
                continue

            key = norm_key(word)
            if opts.lite and key not in entries:
                continue
            code = POS_CODE.get(pos, 'x')
            new = []
            for s in good[:12]:
                g = ': '.join(x for x in s['glosses'] if x)
                if not g:
                    continue
                sense = {'p': code, 'd': label_prefix(s.get('tags')) + g}
                x = [ex['text'] for ex in (s.get('examples') or [])
                     if isinstance(ex, dict) and ex.get('text') and len(ex['text']) <= 220][:2]
                if x:
                    sense['x'] = x
                sy, an = names_of(s.get('synonyms')), names_of(s.get('antonyms'))
                if sy:
                    sense['y'] = dedupe(sy)[:12]
                if an:
                    sense['a'] = dedupe(an)[:8]
                new.append(sense)
            if not new:
                continue
            ent = entries.get(key)
            if ent is None:
                ent = entries[key] = {'w': key, 's': []}
            for sense in new:
                if len(ent['s']) < SENSE_CAP and not any(
                        t['p'] == sense['p'] and similar(t['d'], sense['d']) for t in ent['s']):
                    ent['s'].append(sense)
            ipa = pick_ipa(e.get('sounds'))
            if ipa:
                cur = ent.setdefault('i', {})
                for k, v in ipa.items():
                    cur.setdefault(k, v)
            et = (e.get('etymology_text') or '').strip()
            if et and 'e' not in ent:
                ent['e'] = et[:500]
            added += 1
    log('  %d lines read, %d Wiktionary senses merged, %s' % (
        n, added, ', '.join('%d %s' % (len(v), k) for k, v in sorted(forms.items())) or 'no special forms'))


def sort_senses(ent):
    order = {'n': 0, 'v': 1, 'adj': 2, 'adv': 3}
    ent['s'].sort(key=lambda s: order.get(s['p'], 9))   # stable: keeps source order inside a part of speech


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--oewn')
    ap.add_argument('--kaikki')
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'data'))
    ap.add_argument('--sample', action='store_true', help='use the bundled hand-made test sources')
    ap.add_argument('--lite', action='store_true')
    opts = ap.parse_args()

    def log(m):
        print(m, flush=True)

    t0 = time.time()
    label = 'full'
    if opts.sample:
        sd = os.path.join(HERE, 'sample')
        if not os.path.exists(os.path.join(sd, 'oewn-sample.xml')):
            import make_sample
            make_sample.main()
        opts.oewn = os.path.join(sd, 'oewn-sample.xml')
        opts.kaikki = os.path.join(sd, 'kaikki-sample.jsonl')
        label = 'sample'
    if not opts.oewn and not opts.kaikki:
        ap.error('give --oewn and/or --kaikki, or use --sample')
    if opts.lite and label != 'sample':
        label = 'lite'

    entries, forms = {}, defaultdict(list)
    sources = []
    if opts.oewn:
        load_oewn(opts.oewn, entries, log)
        sources.append('Open English WordNet (CC BY 4.0)')
    if opts.kaikki:
        load_kaikki(opts.kaikki, entries, forms, opts, log)
        sources.append('English Wiktionary via Kaikki.org (CC BY-SA 4.0)')
    for ent in entries.values():
        sort_senses(ent)

    # drop duplicate special forms (same phrase listed twice)
    clean = {}
    for typ, items in forms.items():
        seen, uniq = set(), []
        for it in items:
            k = it['p'].lower()
            if k not in seen:
                seen.add(k)
                uniq.append(it)
        clean[typ] = uniq

    meta = packlib.write_pack(os.path.abspath(opts.out), entries, clean, sources=sources, label=label)
    log('Done in %.1fs: %d words, %d index lines, %.1f MB in %d files' % (
        time.time() - t0, meta['words'], meta['indexLines'], meta['totalBytes'] / 1048576.0, len(meta['files'])))


if __name__ == '__main__':
    main()
