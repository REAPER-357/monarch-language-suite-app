/* Monarch Language Suite - engine (pure logic, no DOM). Works in browser and Node. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MonarchEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DIALECT_IDX = { us: 0, uk: 1, ca: 2 };

    /* ---------- Spelling (CA / US / UK) ---------- */
    // triples: [[us, uk, ca], ...]
    function createSpelling(triples) {
        var byWord = new Map();
        (triples || []).forEach(function (t) {
            t.forEach(function (w) { byWord.set(w.toLowerCase(), t); });
        });

        function matchCase(src, out) {
            if (!src || !out) return out;
            if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
            if (src[0] !== src[0].toLowerCase()) return out.charAt(0).toUpperCase() + out.slice(1);
            return out;
        }

        function word(w, dialect) {
            var t = byWord.get(String(w).toLowerCase());
            if (!t) return w;
            return matchCase(w, t[DIALECT_IDX[dialect] != null ? DIALECT_IDX[dialect] : 2]);
        }

        return {
            word: word,
            text: function (s, dialect) {
                return String(s == null ? '' : s).replace(/[A-Za-z]+/g, function (m) { return word(m, dialect); });
            },
            canonical: function (w) {
                var t = byWord.get(String(w).toLowerCase());
                return t ? t[0].toLowerCase() : String(w).toLowerCase();
            },
            variants: function (w) {
                var t = byWord.get(String(w).toLowerCase());
                return t ? Array.from(new Set(t)) : [w];
            },
            size: function () { return byWord.size; }
        };
    }

    /* ---------- Index & search ---------- */
    // index text: one entry per line, "word" or "variant|canonical"; sorted by lowercase word.
    function parseIndex(txt) {
        var words = [], canon = [], lower = [];
        var lines = txt.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (!ln) continue;
            var p = ln.indexOf('|');
            if (p < 0) { words.push(ln); canon.push(null); }
            else { words.push(ln.slice(0, p)); canon.push(ln.slice(p + 1)); }
            lower.push(words[words.length - 1].toLowerCase());
        }
        return { words: words, canon: canon, lower: lower };
    }

    function lowerBound(lower, prefix) {
        var lo = 0, hi = lower.length;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (lower[mid] < prefix) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    function keyAt(index, i) { return (index.canon[i] || index.words[i]).toLowerCase(); }

    // Prefix search. Returns [{w: display word, key: entry key}]
    function search(index, query, opts) {
        opts = opts || {};
        var limit = opts.limit || 60;
        var spelling = opts.spelling, dialect = opts.dialect || 'ca';
        var q = String(query || '').trim().toLowerCase();
        if (!q) return [];
        if (/[?*]/.test(q)) return wildcard(index, q, opts);

        var start = lowerBound(index.lower, q);
        var out = [], seen = new Set();
        var scanLimit = limit * 6;
        for (var i = start; i < index.lower.length && i < start + scanLimit; i++) {
            if (!index.lower[i].startsWith(q)) break;
            var key = keyAt(index, i);
            if (seen.has(key)) continue;
            seen.add(key);
            var shown = index.canon[i] ? index.canon[i] : index.words[i];
            if (spelling) shown = spelling.word(shown, dialect);
            out.push({ w: shown, key: key, exact: index.lower[i] === q || key === q });
            if (out.length >= limit) break;
        }
        // exact matches first, then alphabetical by displayed word
        out.sort(function (a, b) {
            if (a.exact !== b.exact) return a.exact ? -1 : 1;
            return a.w.toLowerCase() < b.w.toLowerCase() ? -1 : a.w.toLowerCase() > b.w.toLowerCase() ? 1 : 0;
        });
        return out;
    }

    function wildcard(index, pattern, opts) {
        opts = opts || {};
        var limit = opts.limit || 80;
        var re;
        try {
            var src = pattern.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
            re = new RegExp('^' + src + '$');
        } catch (e) { return []; }
        var out = [], seen = new Set();
        for (var i = 0; i < index.lower.length; i++) {
            if (!re.test(index.lower[i])) continue;
            var key = keyAt(index, i);
            if (seen.has(key)) continue;
            seen.add(key);
            var shown = index.canon[i] ? index.canon[i] : index.words[i];
            if (opts.spelling) shown = opts.spelling.word(shown, opts.dialect || 'ca');
            out.push({ w: shown, key: key, exact: false });
            if (out.length >= limit) break;
        }
        return out;
    }

    // Bounded edit distance; returns max+1 when over the bound.
    function editDistance(a, b, max) {
        var la = a.length, lb = b.length;
        if (Math.abs(la - lb) > max) return max + 1;
        var prev2 = new Array(lb + 1), prev = new Array(lb + 1), cur = new Array(lb + 1), i, j;
        for (j = 0; j <= lb; j++) prev[j] = j;
        for (i = 1; i <= la; i++) {
            cur[0] = i;
            var rowMin = cur[0];
            for (j = 1; j <= lb; j++) {
                var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1); // swapped letters
                cur[j] = v;
                if (v < rowMin) rowMin = v;
            }
            if (rowMin > max) return max + 1;
            var tmp = prev2; prev2 = prev; prev = cur; cur = tmp;
        }
        return prev[lb];
    }

    // "Did you mean" suggestions
    function suggest(index, query, opts) {
        opts = opts || {};
        var q = String(query || '').trim().toLowerCase();
        if (q.length < 3 || /[?*\s]/.test(q)) return [];
        var max = q.length <= 4 ? 1 : 2;
        var scored = [], seen = new Set();
        for (var i = 0; i < index.lower.length; i++) {
            var w = index.lower[i];
            if (w.charAt(0) !== q.charAt(0) && w.charAt(1) !== q.charAt(1)) continue;
            var d = editDistance(q, w, max);
            if (d > max) continue;
            var key = keyAt(index, i);
            if (seen.has(key)) continue;
            seen.add(key);
            var shown = index.canon[i] ? index.canon[i] : index.words[i];
            if (opts.spelling) shown = opts.spelling.word(shown, opts.dialect || 'ca');
            scored.push({ w: shown, key: key, d: d });
        }
        scored.sort(function (a, b) { return a.d - b.d || (a.w < b.w ? -1 : 1); });
        return scored.slice(0, opts.limit || 6);
    }

    function chunkKey(key) {
        var k = String(key).toLowerCase().replace(/[^a-z]/g, '_');
        return (k + '__').slice(0, 2);
    }

    /* ---------- Special forms (idioms, phrasal verbs, proverbs) ---------- */
    function searchForms(list, query, limit) {
        var q = String(query || '').trim().toLowerCase();
        limit = limit || 100;
        if (!q) return list.slice(0, limit);
        var tokens = q.split(/\s+/).filter(Boolean);
        var scored = [];
        for (var i = 0; i < list.length; i++) {
            var p = list[i].p.toLowerCase();
            var ok = true, score = 0;
            if (p.startsWith(q)) score = 3;
            for (var t = 0; t < tokens.length; t++) {
                var tok = tokens[t];
                if (p.indexOf(tok) < 0) { ok = false; break; }
                if (score < 2 && (p.startsWith(tok) || p.indexOf(' ' + tok) >= 0)) score = Math.max(score, 2);
                else if (score < 1) score = 1;
            }
            if (ok) scored.push({ it: list[i], s: score });
        }
        scored.sort(function (a, b) { return b.s - a.s || (a.it.p < b.it.p ? -1 : a.it.p > b.it.p ? 1 : 0); });
        return scored.slice(0, limit).map(function (x) { return x.it; });
    }

    /* ---------- Verb conjugation (12 tenses) ---------- */
    // Verbs whose final syllable is stressed: final consonant doubles before -ed/-ing in every dialect.
    var FINAL_STRESS = ['begin', 'occur', 'prefer', 'refer', 'admit', 'permit', 'commit', 'submit', 'omit', 'transmit', 'regret',
        'forget', 'equip', 'control', 'compel', 'expel', 'repel', 'propel', 'rebel', 'excel', 'confer', 'defer', 'infer', 'transfer',
        'deter', 'incur', 'recur', 'concur', 'abhor', 'allot', 'annul', 'patrol', 'unwrap', 'upset', 'forbid', 'overlap', 'handicap',
        'kidnap', 'enrol', 'fulfil', 'instil', 'distil', 'compel', 'impel', 'outwit', 'acquit', 'refit', 'remit', 'emit', 'beset',
        'inlay', 'bestir', 'demur', 'concur', 'cap', 'spot'];
    var NO_DOUBLE_L = ['parallel'];
    var PREFIXABLE = ['do', 'make', 'take', 'give', 'stand', 'draw', 'hold', 'write', 'run', 'see', 'come', 'get', 'go', 'tell',
        'think', 'build', 'say', 'bring', 'lay', 'lead', 'set', 'put', 'cast', 'cut', 'feed', 'find', 'grow', 'hear', 'keep', 'know',
        'leave', 'lose', 'pay', 'read', 'ride', 'rise', 'sell', 'send', 'shake', 'shoot', 'sleep', 'speak', 'spend', 'swear', 'throw',
        'wear', 'win', 'wind', 'bear', 'beat', 'bind', 'break', 'catch', 'choose', 'deal', 'drink', 'drive', 'eat', 'fall', 'fly',
        'forgive', 'hang', 'hide', 'lend', 'light', 'meet', 'mean', 'sit', 'sing', 'sink', 'teach', 'tear', 'wake', 'weave'];
    var PREFIXES = ['re', 'over', 'under', 'out', 'up', 'mis', 'with', 'fore', 'be', 'for', 'un', 'down', 'inter', 'sub', 'dis'];
    var REGULAR_LOOKALIKES = ['relay', 'belay'];
    var T_FORMS = { burn: 'burnt', learn: 'learnt', spell: 'spelt', dream: 'dreamt', smell: 'smelt', spoil: 'spoilt', lean: 'leant', leap: 'leapt' };

    function isVowel(c) { return 'aeiou'.indexOf(c) >= 0; }
    function syllables(w) {
        var m = w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g);
        return Math.max(1, m ? m.length : 1);
    }

    function shouldDouble(base, dialect) {
        var w = base.toLowerCase();
        var n = w.length;
        if (n < 3) return false;
        var c2 = w[n - 1], v = w[n - 2], c1 = w[n - 3];
        if ('wxy'.indexOf(c2) >= 0 || isVowel(c2)) return false;
        if (!isVowel(v)) return false;
        if (isVowel(c1) && !(c1 === 'u' && w[n - 4] === 'q')) return false;
        if (syllables(w) === 1) return true;
        if (NO_DOUBLE_L.indexOf(w) >= 0) return false;
        for (var i = 0; i < FINAL_STRESS.length; i++) {
            var k = FINAL_STRESS[i];
            if (k.length > 3 && w.length >= k.length && w.slice(-k.length) === k) return true;
        }
        if (c2 === 'l' && dialect !== 'us') return true; // travel -> travelled (UK/CA), traveled (US)
        return false;
    }

    function addIng(base, dialect) {
        var w = base;
        if (/ie$/.test(w)) return w.slice(0, -2) + 'ying';
        if (/(ee|ye|oe)$/.test(w) || w === 'be') return w + 'ing';
        if (/e$/.test(w)) return w.slice(0, -1) + 'ing';
        if (/ic$/.test(w)) return w + 'king';
        if (shouldDouble(w, dialect)) return w + w[w.length - 1] + 'ing';
        return w + 'ing';
    }

    function addEd(base, dialect) {
        var w = base;
        if (/e$/.test(w)) return w + 'd';
        if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
        if (/ic$/.test(w)) return w + 'ked';
        if (shouldDouble(w, dialect)) return w + w[w.length - 1] + 'ed';
        return w + 'ed';
    }

    function addS(base) {
        if (base === 'have') return 'has';
        if (/(s|x|z|ch|sh|o)$/.test(base)) return base + 'es';
        if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ies';
        return base + 's';
    }

    // irregular: { base: {past:[...], pp:[...]} }
    function lookupIrregular(base, irregular) {
        if (irregular[base]) return irregular[base];
        if (REGULAR_LOOKALIKES.indexOf(base) >= 0) return null; // look like prefix + irregular verb but are regular
        for (var i = 0; i < PREFIXES.length; i++) {
            var p = PREFIXES[i];
            if (base.indexOf(p) === 0) {
                var rest = base.slice(p.length);
                if (rest && irregular[rest] && PREFIXABLE.indexOf(rest) >= 0) {
                    var r = irregular[rest];
                    return { past: r.past.map(function (x) { return p + x; }), pp: r.pp.map(function (x) { return p + x; }) };
                }
            }
        }
        return null;
    }

    function verbForms(verb, ctx) {
        ctx = ctx || {};
        var dialect = ctx.dialect || 'ca';
        var irregular = ctx.irregular || {};
        var raw = String(verb || '').trim().toLowerCase().replace(/\s+/g, ' ');
        var sp = raw.indexOf(' ');
        var head = sp < 0 ? raw : raw.slice(0, sp);
        var tail = sp < 0 ? '' : raw.slice(sp);
        if (!/^[a-z]+$/.test(head)) return null;

        var f = { base: head, s: addS(head), ing: addIng(head, dialect), past: null, pp: null, irregular: false, alt: [] };
        if (head === 'be') {
            f.s = 'is'; f.ing = 'being'; f.past = 'was'; f.pp = 'been'; f.irregular = true;
        } else {
            var irr = lookupIrregular(head, irregular);
            if (irr) {
                f.irregular = true;
                f.past = irr.past[0]; f.pp = irr.pp[0];
                if (irr.past.length > 1) f.alt.push('past: ' + irr.past.join(' / '));
                if (irr.pp.length > 1 || irr.pp[0] !== irr.past[0]) f.alt.push('pp: ' + irr.pp.join(' / '));
                if (T_FORMS[head] && dialect === 'uk') { f.past = T_FORMS[head]; f.pp = T_FORMS[head]; }
                if (head === 'get') f.pp = dialect === 'us' ? 'gotten' : 'got';
            } else {
                f.past = addEd(head, dialect); f.pp = f.past;
                if (T_FORMS[head] && dialect === 'uk') { f.past = T_FORMS[head]; f.pp = T_FORMS[head]; }
            }
        }
        ['base', 's', 'ing', 'past', 'pp'].forEach(function (k) { f[k] = f[k] + tail; });
        f.head = head; f.tail = tail;
        return f;
    }

    var PERSONS = [['I', 'I'], ['he/she/it', 's3'], ['you/we/they', 'p']];
    var TENSE_KEYS = ['presentSimple', 'presentContinuous', 'presentPerfect', 'presentPerfectContinuous',
        'pastSimple', 'pastContinuous', 'pastPerfect', 'pastPerfectContinuous',
        'futureSimple', 'futureContinuous', 'futurePerfect', 'futurePerfectContinuous'];

    function conjugate(verb, ctx) {
        var f = verbForms(verb, ctx);
        if (!f) return null;
        var isBe = f.head === 'be';
        var beP = { I: 'am', s3: 'is', p: 'are' }, beS = { I: 'was', s3: 'was', p: 'were' };
        var haveP = { I: 'have', s3: 'has', p: 'have' }, doP = { I: 'do', s3: 'does', p: 'do' };
        var tail = f.tail;

        // each tense: person -> { stmt: [tokens], aux: [tokens used for negative/question] }
        var defs = {
            presentSimple: function (p) {
                if (isBe) return { stmt: [beP[p]], aux: [beP[p]] };
                return { stmt: [p === 's3' ? f.s : f.base], aux: [doP[p], f.base] };
            },
            presentContinuous: function (p) { return aux([beP[p]], f.ing); },
            presentPerfect: function (p) { return aux([haveP[p]], f.pp); },
            presentPerfectContinuous: function (p) { return aux([haveP[p], 'been'], f.ing); },
            pastSimple: function (p) {
                if (isBe) return { stmt: [beS[p]], aux: [beS[p]] };
                return { stmt: [f.past], aux: ['did', f.base] };
            },
            pastContinuous: function (p) { return aux([beS[p]], f.ing); },
            pastPerfect: function () { return aux(['had'], f.pp); },
            pastPerfectContinuous: function () { return aux(['had', 'been'], f.ing); },
            futureSimple: function () { return aux(['will'], f.base); },
            futureContinuous: function () { return aux(['will', 'be'], f.ing); },
            futurePerfect: function () { return aux(['will', 'have'], f.pp); },
            futurePerfectContinuous: function () { return aux(['will', 'have', 'been'], f.ing); }
        };
        function aux(auxes, main) {
            var t = auxes.concat([main]);
            return { stmt: t, aux: t };
        }
        function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

        var tenses = TENSE_KEYS.map(function (key) {
            var rows = { affirm: {}, neg: {}, q: {} };
            PERSONS.forEach(function (pr) {
                var label = pr[0], p = pr[1];
                var d = defs[key](p);
                rows.affirm[label] = label + ' ' + d.stmt.join(' ');
                var neg = d.aux.slice(), q = d.aux.slice();
                rows.neg[label] = label + ' ' + neg[0] + ' not' + (neg.length > 1 ? ' ' + neg.slice(1).join(' ') : '');
                rows.q[label] = cap(q[0]) + ' ' + label + (q.length > 1 ? ' ' + q.slice(1).join(' ') : '') + '?';
            });
            return { key: key, rows: rows };
        });
        return { forms: f, tenses: tenses, persons: PERSONS.map(function (x) { return x[0]; }) };
    }

    return {
        createSpelling: createSpelling,
        parseIndex: parseIndex,
        search: search,
        wildcard: wildcard,
        suggest: suggest,
        editDistance: editDistance,
        chunkKey: chunkKey,
        searchForms: searchForms,
        verbForms: verbForms,
        conjugate: conjugate,
        shouldDouble: shouldDouble,
        TENSE_KEYS: TENSE_KEYS
    };
});
