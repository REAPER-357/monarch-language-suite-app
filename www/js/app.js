/* Monarch Language Suite - app (UI + data loading). Logic lives in engine.js */
(function () {
    'use strict';
    var E = window.MonarchEngine;

    /* ================= helpers ================= */
    function $(s, r) { return (r || document).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
    var store = {
        get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
    };
    function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }

    var DIALECTS = ['ca', 'us', 'uk'];
    var DIALECT_NAME = { ca: 'Canadian', us: 'American', uk: 'British' };
    var DIALECT_LANG = { ca: 'en-CA', us: 'en-US', uk: 'en-GB' };
    var ACCENTS = [['#f97316', 'Monarch orange'], ['#10b981', 'Green'], ['#ef4444', 'Red'], ['#3b82f6', 'Blue'], ['#a855f7', 'Purple']];
    var POS_NAME = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', interj: 'interjection',
        pron: 'pronoun', det: 'determiner', num: 'numeral', part: 'particle', phr: 'phrase', x: 'other' };
    var FORM_TYPES = [['idiom', 'Idioms'], ['phrasal', 'Phrasal verbs'], ['proverb', 'Proverbs'], ['simile', 'Similes'],
        ['phrase', 'Phrases'], ['abbr', 'Abbreviations'], ['slang', 'Slang']];

    var S = {
        dialect: store.get('mn_dialect', 'ca'),
        theme: store.get('mn_theme', 'black'),
        accent: store.get('mn_accent', '#f97316'),
        fs: store.get('mn_fs', 16),
        ipa: store.get('mn_ipa', true),
        ety: store.get('mn_ety', true),
        favs: store.get('mn_favs', []),
        hist: store.get('mn_hist', []),
        formType: store.get('mn_formtype', 'idiom'),
        conjMode: 'affirm',
        tab: 'dictionary'
    };
    if (DIALECTS.indexOf(S.dialect) < 0) S.dialect = 'ca';
    if (!Array.isArray(S.favs)) S.favs = [];
    if (!Array.isArray(S.hist)) S.hist = [];

    var DATA = 'data/';
    var index = null, sp = E.createSpelling([]), meta = null, basics = null, irregular = {};
    var chunks = new Map(), formsCache = {}, wotdCache = null;

    function D(w) { return sp.word(w, S.dialect); }
    function T(t) { return sp.text(t, S.dialect); }

    /* ================= icons (local SVG packs: assets/icons/<name>.svg) ================= */
    var ICON_FALLBACK = { settings: '⚙', x: '✕', 'arrow-left': '←', star: '☆', 'star-filled': '★', 'volume-2': '♪', search: '⌕', shuffle: '⇄',
        'chevron-right': '›', copy: '⧉', download: '↓', 'trash-2': '✕', history: '↺' };
    var iconCache = {};
    function loadIcon(name) {
        if (!iconCache[name]) {
            iconCache[name] = fetch('assets/icons/' + name + '.svg').then(function (r) { return r.ok ? r.text() : null; })
                .catch(function () { return null; })
                .then(function (t) {
                    if (!t || !/<svg/i.test(t)) return null;
                    return t.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg([^>]*)>/i, function (m, a) {
                        return '<svg' + a.replace(/\s(width|height)="[^"]*"/gi, '') + ' aria-hidden="true" focusable="false">';
                    });
                });
        }
        return iconCache[name];
    }
    function ic(name, cls) { return '<span class="ic' + (cls ? ' ' + cls : '') + '" data-ic="' + name + '"></span>'; }
    function hydrate(root) {
        $$('.ic[data-ic]', root || document).forEach(function (span) {
            if (span.getAttribute('data-done')) return;
            span.setAttribute('data-done', '1');
            var n = span.getAttribute('data-ic');
            loadIcon(n).then(function (svg) { span.innerHTML = svg || ICON_FALLBACK[n] || ''; });
        });
    }
    function render(container, html) { container.innerHTML = html; hydrate(container); }

    /* ================= data ================= */
    function getJSON(path) {
        return fetch(DATA + path).then(function (r) { if (!r.ok) throw new Error(path + ' (' + r.status + ')'); return r.json(); });
    }
    function getText(path) {
        return fetch(DATA + path).then(function (r) { if (!r.ok) throw new Error(path + ' (' + r.status + ')'); return r.text(); });
    }
    function getChunk(ck) {
        if (!chunks.has(ck)) {
            chunks.set(ck, getJSON('dict/' + ck + '.json').catch(function () { chunks.delete(ck); return {}; }));
        }
        return chunks.get(ck);
    }
    function getEntry(key) {
        key = String(key).toLowerCase();
        return getChunk(E.chunkKey(key)).then(function (c) { return c[key] || null; });
    }
    function getBasics() {
        if (!basics) {
            basics = getJSON('basics.json').then(function (b) {
                (b.irregular || []).forEach(function (r) {
                    irregular[r[0]] = { past: r[1].split('/'), pp: r[2].split('/') };
                    // reverse map so "ran", "gone", "wrote" open their base verb
                    r[1].split('/').concat(r[2].split('/')).forEach(function (f) {
                        f = f.toLowerCase().trim();
                        if (f && f !== r[0] && !irrRev[f]) irrRev[f] = r[0];
                    });
                });
                return b;
            });
        }
        return basics;
    }
    function getForms(type) {
        if (!formsCache[type]) formsCache[type] = getJSON('forms/' + type + '.json').catch(function () { delete formsCache[type]; return []; });
        return formsCache[type];
    }

    // Look up a typed or tapped word, trying its spelling variants and simple inflections.
    var irrRev = {};   // irregular verb form -> base verb (filled when basics.json loads)
    var IRR_OTHER = {  // irregular plurals and comparatives
        men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', geese: 'goose', mice: 'mouse', lice: 'louse',
        people: 'person', oxen: 'ox', dice: 'die', fungi: 'fungus', cacti: 'cactus', nuclei: 'nucleus', radii: 'radius', stimuli: 'stimulus',
        alumni: 'alumnus', analyses: 'analysis', bases: 'basis', crises: 'crisis', diagnoses: 'diagnosis', hypotheses: 'hypothesis',
        theses: 'thesis', oases: 'oasis', axes: 'axis', phenomena: 'phenomenon', criteria: 'criterion', data: 'datum', media: 'medium',
        bacteria: 'bacterium', curricula: 'curriculum', memoranda: 'memorandum', indices: 'index', appendices: 'appendix',
        matrices: 'matrix', vertices: 'vertex', better: 'good', best: 'good', worse: 'bad', worst: 'bad', farther: 'far', farthest: 'far',
        further: 'far', furthest: 'far', less: 'little', least: 'little', more: 'much', most: 'much', am: 'be', is: 'be', are: 'be', 'was': 'be', were: 'be', been: 'be', being: 'be'
    };
    function stemCandidates(w) {
        var k = String(w).toLowerCase().trim(), out = [k, sp.canonical(k)];
        if (irrRev[k]) out.push(irrRev[k]);
        if (IRR_OTHER[k]) out.push(IRR_OTHER[k]);
        if (/ves$/.test(k)) { out.push(k.slice(0, -3) + 'f'); out.push(k.slice(0, -3) + 'fe'); }
        if (/ies$/.test(k)) out.push(k.slice(0, -3) + 'y');
        if (/(es|s)$/.test(k)) { out.push(k.slice(0, -1)); out.push(k.slice(0, -2)); }
        if (/ed$/.test(k)) { out.push(k.slice(0, -2)); out.push(k.slice(0, -1)); if (/(.)\1ed$/.test(k)) out.push(k.slice(0, -3)); if (/ied$/.test(k)) out.push(k.slice(0, -3) + 'y'); }
        if (/ing$/.test(k)) { out.push(k.slice(0, -3)); out.push(k.slice(0, -3) + 'e'); if (/(.)\1ing$/.test(k)) out.push(k.slice(0, -4)); }
        if (/(er|est)$/.test(k)) { out.push(k.replace(/(er|est)$/, '')); out.push(k.replace(/(er|est)$/, '') + 'e'); if (/ier$|iest$/.test(k)) out.push(k.replace(/ier$|iest$/, 'y')); }
        if (/ly$/.test(k)) out.push(k.slice(0, -2));
        var seen = {};
        return out.filter(function (x) { x = sp.canonical(x); if (!x || seen[x]) return false; seen[x] = 1; return true; }).map(function (x) { return sp.canonical(x); });
    }
    function lookup(word) {
        var cands = stemCandidates(word), i = 0;
        function next() {
            if (i >= cands.length) return Promise.resolve(null);
            var key = cands[i++];
            return getEntry(key).then(function (ent) { return ent ? { key: key, ent: ent } : next(); });
        }
        return next();
    }

    /* ================= UI basics ================= */
    var toastTimer = null;
    function toast(msg) {
        var t = $('#toast');
        t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    }
    function copyText(text) {
        function done() { toast('Copied'); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast('Could not copy'); });
        else {
            var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); }
            ta.remove();
        }
    }
    function speak(word) {
        if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { toast('Speech is not available on this device'); return; }
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(word);
        u.lang = DIALECT_LANG[S.dialect]; u.rate = 0.9;
        window.speechSynthesis.speak(u);
    }
    function bold(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="accent-text">$1</b>'); }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme', S.theme);
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', { black: '#000000', dark: '#0f172a', light: '#f1f5f9' }[S.theme] || '#000000');
    }
    function applyAccent() { document.documentElement.style.setProperty('--accent-color', S.accent); }
    function applyFontSize() { document.documentElement.style.setProperty('--fs', S.fs + 'px'); }
    function applyDialectUi() {
        $('#dialectPill').textContent = S.dialect.toUpperCase();
        document.documentElement.setAttribute('lang', DIALECT_LANG[S.dialect]);
    }

    /* ================= favourites & history ================= */
    function isFav(key) { return S.favs.indexOf(key) >= 0; }
    function toggleFav(key) {
        var i = S.favs.indexOf(key);
        if (i >= 0) S.favs.splice(i, 1); else S.favs.unshift(key);
        store.set('mn_favs', S.favs);
        updateDataCounts();
    }
    function addHistory(key) {
        S.hist = [key].concat(S.hist.filter(function (k) { return k !== key; })).slice(0, 30);
        store.set('mn_hist', S.hist);
        updateDataCounts();
    }
    function updateDataCounts() {
        $('#favCount').textContent = S.favs.length;
        $('#histCount').textContent = S.hist.length;
    }

    /* ================= detail navigation ================= */
    var detailStack = [], scrollBefore = 0;
    var detailView = $('#detailView'), detailBody = $('#detailBody'), detailActions = $('#detailActions');

    function openDetail(frame) {
        if (!detailStack.length) scrollBefore = window.scrollY || 0;
        detailStack.push(frame);
        try { history.pushState({ d: detailStack.length }, ''); } catch (e) { /* ignore */ }
        showDetail(true);
    }
    function showDetail(toTop) {
        var f = detailStack[detailStack.length - 1];
        if (!f) return;
        $$('.tab-view').forEach(function (v) { v.hidden = true; });
        detailView.hidden = false;
        Promise.resolve(f.build()).then(function (r) {
            detailBody.innerHTML = r.html;
            detailActions.innerHTML = r.actions || '';
            hydrate(detailView);
            if (r.after) r.after(detailBody);
            if (toTop) window.scrollTo(0, 0);
        });
    }
    function hideDetail() {
        detailView.hidden = true;
        detailStack = [];
        $('#view-' + S.tab).hidden = false;
        window.scrollTo(0, scrollBefore);
    }
    function backDetail() {
        if (!detailStack.length) return;
        var usedHistory = false;
        try { if (history.state && history.state.d) { history.back(); usedHistory = true; } } catch (e) { /* ignore */ }
        if (!usedHistory) popDetail();
    }
    function popDetail() {
        if (!detailStack.length) return;
        detailStack.pop();
        if (detailStack.length) showDetail(false); else hideDetail();
    }
    window.addEventListener('popstate', function () { popDetail(); });
    function refreshDetail() { if (detailStack.length) showDetail(false); }

    function showTab(name) {
        S.tab = name;
        detailStack = [];
        detailView.hidden = true;
        $$('.tab-view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
        $$('#navTabs .tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
        window.scrollTo(0, 0);
        if (name === 'forms') renderForms();
    }

    /* ================= search UI (dictionary + thesaurus) ================= */
    var MODES = {
        dict: { input: '#dictInput', clear: '#dictClear', home: '#dictHome', results: '#dictResults' },
        thes: { input: '#thesInput', clear: '#thesClear', home: '#thesHome', results: '#thesResults' }
    };

    function rowHtml(r, mode) {
        return '<button class="row" data-act="word" data-key="' + esc(r.key) + '" data-mode="' + mode + '">' +
            '<span class="title">' + esc(r.w) + '</span><span class="muted">' + ic('chevron-right') + '</span></button>';
    }

    function runSearch(mode) {
        var m = MODES[mode];
        var input = $(m.input), q = input.value.trim();
        $(m.clear).hidden = !q;
        if (!index) return;
        var home = $(m.home), results = $(m.results);
        if (!q) { home.hidden = false; results.hidden = true; return; }
        home.hidden = true; results.hidden = false;
        var res = E.search(index, q, { spelling: sp, dialect: S.dialect, limit: 80 });
        if (res.length) {
            // typed an inflected form (ran, mice, walked)? show its base word first
            var baseRow = null;
            if (q.length >= 2 && !res[0].exact) {
                var cands = stemCandidates(q).slice(1);
                for (var ci = 0; ci < cands.length && !baseRow; ci++) {
                    if (cands[ci] === q.toLowerCase()) continue;
                    var br = E.search(index, cands[ci], { spelling: sp, dialect: S.dialect, limit: 1 });
                    if (br.length && br[0].exact) baseRow = br[0];
                }
            }
            var listHtml = res.map(function (r) { return rowHtml(r, mode); }).join('');
            if (baseRow) listHtml = '<div class="label">Form of</div>' + rowHtml(baseRow, mode) +
                '<div class="label" style="margin-top:.8rem">Words starting with “' + esc(q) + '”</div>' + listHtml;
            render(results, listHtml);
            return;
        }
        // nothing starts with the query: try inflections, then typo suggestions
        var found = [], seen = {};
        stemCandidates(q).forEach(function (c) {
            var r = E.search(index, c, { spelling: sp, dialect: S.dialect, limit: 1 });
            if (r.length && r[0].exact && !seen[r[0].key]) { seen[r[0].key] = 1; found.push(r[0]); }
        });
        var sug = E.suggest(index, q, { spelling: sp, dialect: S.dialect, limit: 6 }).filter(function (s) { return !seen[s.key]; });
        var html = '';
        if (found.length) {
            // an inflected form (ran, mice, walked): lead with its base word instead of an error
            html += '<div class="label">Form of</div>' + found.slice(0, 1).map(function (r) { return rowHtml(r, mode); }).join('');
            found = found.slice(1);
        } else {
            html += '<div class="empty">' + ic('search', 'ic-xl') + '<p>No words start with “' + esc(q) + '”.</p></div>';
        }
        var more = found.concat(sug);
        if (more.length) {
            html += '<div class="label" style="margin-top:.8rem">Did you mean</div>' + more.map(function (r) { return rowHtml(r, mode); }).join('');
        }
        render(results, html);
    }

    function wireSearch(mode) {
        var m = MODES[mode], input = $(m.input);
        input.addEventListener('input', debounce(function () { runSearch(mode); }, 40));
        input.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var first = $(m.results + ' [data-act="word"]');
            if (first) first.click(); else if (input.value.trim()) openWord(input.value.trim(), mode, true);
            input.blur();
        });
        $(m.clear).addEventListener('click', function () { input.value = ''; runSearch(mode); input.focus(); });
    }

    function openWord(wordOrKey, mode, fuzzy) {
        var p = fuzzy ? lookup(wordOrKey) : getEntry(wordOrKey).then(function (ent) { return ent ? { key: String(wordOrKey).toLowerCase(), ent: ent } : lookup(wordOrKey); });
        p.then(function (hit) {
            if (!hit) { toast('“' + wordOrKey + '” isn’t in this dictionary'); return; }
            addHistory(hit.key);
            openDetail({ title: hit.key, build: function () { return mode === 'thes' ? thesaurusPage(hit.key, hit.ent) : dictionaryPage(hit.key, hit.ent); } });
        });
    }

    /* ---------- entry pages ---------- */
    function chip(word, mode, ant) {
        return '<button class="link-chip' + (ant ? ' ant' : '') + '" data-act="word" data-key="' + esc(sp.canonical(word)) + '" data-mode="' + mode + '">' + esc(D(word)) + '</button>';
    }
    function groupByPos(senses) {
        var order = [], map = {};
        senses.forEach(function (s) {
            var p = s.p || 'x';
            if (!map[p]) { map[p] = []; order.push(p); }
            map[p].push(s);
        });
        return order.map(function (p) { return { p: p, senses: map[p] }; });
    }
    function ipaFor(ent) {
        if (!ent.i) return '';
        return (S.dialect === 'uk' ? (ent.i.uk || ent.i.us) : (ent.i.us || ent.i.uk)) || '';
    }
    function entryActions(key, ent, other) {
        var star = isFav(key);
        return '<button class="icon-btn" data-act="speak" data-text="' + esc(D(ent.w)) + '" aria-label="Pronounce">' + ic('volume-2') + '</button>' +
            '<button class="icon-btn' + (star ? ' accent-text' : '') + '" data-act="fav" data-key="' + esc(key) + '" aria-label="' + (star ? 'Remove from favourites' : 'Add to favourites') + '">' +
            ic(star ? 'star-filled' : 'star') + '</button>' +
            '<button class="btn small" data-act="word" data-key="' + esc(key) + '" data-mode="' + other.mode + '" data-swap="1">' + esc(other.label) + '</button>';
    }
    function spellingLine(ent) {
        var v = sp.variants(ent.w);
        if (v.length < 2) return '';
        var t = v.length ? sp.variants(ent.w) : [];
        var us = sp.word(ent.w, 'us'), uk = sp.word(ent.w, 'uk'), ca = sp.word(ent.w, 'ca');
        return '<div class="spelling-line">Spelling: CA <b>' + esc(ca) + '</b> · US <b>' + esc(us) + '</b> · UK <b>' + esc(uk) + '</b></div>';
    }

    function dictionaryPage(key, ent) {
        var ipa = S.ipa ? ipaFor(ent) : '';
        var html = '<div class="panel"><h2 class="headword">' + esc(D(ent.w)) + '</h2>' +
            (ipa ? '<div class="ipa">' + esc(ipa) + '</div>' : '') + spellingLine(ent) + '</div>';
        html += '<div class="panel">';
        groupByPos(ent.s).forEach(function (g) {
            html += '<div class="pos-tag">' + esc(POS_NAME[g.p] || g.p) + '</div><ol class="senses">';
            g.senses.forEach(function (s, i) {
                var li = '<li><div class="def">' + esc(T(s.d)) + '</div>';
                (s.x || []).slice(0, 2).forEach(function (x) { li += '<div class="ex">“' + esc(T(x)) + '”</div>'; });
                if (s.y && s.y.length) li += '<div class="rel"><span class="label">Similar</span>' + s.y.slice(0, 6).map(function (w) { return chip(w, 'dict'); }).join('') + '</div>';
                if (s.a && s.a.length) li += '<div class="rel"><span class="label">Opposite</span>' + s.a.slice(0, 4).map(function (w) { return chip(w, 'dict', true); }).join('') + '</div>';
                li += '</li>';
                if (i === 8 && g.senses.length > 9) html += '</ol><details class="more"><summary class="btn small" style="display:inline-flex">' + (g.senses.length - 8) + ' more meanings</summary><ol class="senses" start="9">';
                html += li;
            });
            if (g.senses.length > 9) html += '</ol></details>'; else html += '</ol>';
        });
        html += '</div>';
        if (S.ety && ent.e) html += '<details class="panel"><summary>Word origin</summary><p class="muted" style="margin-top:.5rem">' + esc(T(ent.e)) + '</p></details>';
        return { html: html, actions: entryActions(key, ent, { mode: 'thes', label: 'Thesaurus' }) };
    }

    function thesaurusPage(key, ent) {
        var allSyn = [], allAnt = [], seenS = {}, seenA = {};
        ent.s.forEach(function (s) {
            (s.y || []).forEach(function (w) { var c = sp.canonical(w); if (!seenS[c]) { seenS[c] = 1; allSyn.push(w); } });
            (s.a || []).forEach(function (w) { var c = sp.canonical(w); if (!seenA[c]) { seenA[c] = 1; allAnt.push(w); } });
        });
        var html = '<div class="panel"><h2 class="headword">' + esc(D(ent.w)) + '</h2>' + spellingLine(ent) + '</div>';
        if (!allSyn.length && !allAnt.length) {
            html += '<div class="empty">' + ic('arrow-right-left', 'ic-xl') + '<p>No synonyms or antonyms recorded for “' + esc(D(ent.w)) + '”.</p></div>';
        } else {
            if (allSyn.length) {
                html += '<div class="panel"><div class="row-between"><div class="label" style="margin:0">All synonyms (' + allSyn.length + ')</div>' +
                    '<button class="btn small" data-act="copy" data-text="' + esc(allSyn.map(D).join(', ')) + '">' + ic('copy') + '<span>Copy</span></button></div>' +
                    '<div class="chips" style="margin-top:.5rem">' + allSyn.slice(0, 60).map(function (w) { return chip(w, 'thes'); }).join('') + '</div></div>';
            }
            if (allAnt.length) {
                html += '<div class="panel"><div class="label">Antonyms (' + allAnt.length + ')</div><div class="chips">' +
                    allAnt.map(function (w) { return chip(w, 'thes', true); }).join('') + '</div></div>';
            }
            html += '<div class="group-title">By meaning</div>';
            groupByPos(ent.s).forEach(function (g) {
                g.senses.forEach(function (s) {
                    if (!(s.y && s.y.length) && !(s.a && s.a.length)) return;
                    html += '<div class="panel"><div><span class="pos-tag" style="margin:0 .4rem 0 0">' + esc(POS_NAME[g.p] || g.p) + '</span><span class="muted">' + esc(T(s.d)) + '</span></div>';
                    if (s.y && s.y.length) html += '<div class="rel"><span class="label">Synonyms</span>' + s.y.map(function (w) { return chip(w, 'thes'); }).join('') + '</div>';
                    if (s.a && s.a.length) html += '<div class="rel"><span class="label">Antonyms</span>' + s.a.map(function (w) { return chip(w, 'thes', true); }).join('') + '</div>';
                    html += '</div>';
                });
            });
        }
        return { html: html, actions: entryActions(key, ent, { mode: 'dict', label: 'Definition' }) };
    }

    /* ---------- home panels ---------- */
    function keyChips(keys, mode) {
        return keys.map(function (k) { return '<button class="chip" data-act="word" data-key="' + esc(k) + '" data-mode="' + mode + '">' + esc(D(k)) + '</button>'; }).join('');
    }
    function homeLists(mode) {
        var html = '';
        if (S.hist.length) html += '<div><div class="label">Recent</div><div class="chips">' + keyChips(S.hist.slice(0, 14), mode) + '</div></div>';
        if (S.favs.length) html += '<div><div class="label">Favourites</div><div class="chips">' + keyChips(S.favs.slice(0, 30), mode) + '</div></div>';
        return html;
    }

    function pickWordOfDay() {
        if (wotdCache) return wotdCache;
        var cands = [];
        for (var i = 0; i < index.words.length; i++) {
            if (!index.canon[i] && /^[a-z]{5,11}$/.test(index.words[i])) cands.push(index.words[i]);
        }
        if (!cands.length) return Promise.resolve(null);
        var d = new Date(), seed = d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
        var h = (seed * 2654435761) >>> 0, tries = 0;
        function attempt() {
            if (tries++ > 30) return Promise.resolve(null);
            var key = cands[(h + tries * 7919) % cands.length];
            return getEntry(key).then(function (ent) { return ent && ent.s && ent.s[0] ? { key: key, ent: ent } : attempt(); });
        }
        wotdCache = attempt();
        return wotdCache;
    }
    function randomWord(mode) {
        if (!index || !index.words.length) return;
        var tries = 0;
        function attempt() {
            if (tries++ > 20) return;
            var i = Math.floor(Math.random() * index.words.length);
            if (index.canon[i]) return attempt();
            getEntry(index.words[i]).then(function (ent) { if (ent) openWord(index.words[i].toLowerCase(), mode); else attempt(); });
        }
        attempt();
    }

    function renderDictHome() {
        var home = $('#dictHome');
        if (!index) return;
        render(home,
            '<div class="panel wotd" id="wotdCard"><div class="label">Word of the day</div><div class="muted">Loading…</div></div>' +
            '<div class="chips"><button class="btn" data-act="random" data-mode="dict">' + ic('shuffle') + '<span>Random word</span></button></div>' +
            homeLists('dict') +
            '<p class="hint">Tip: use <b>?</b> for one unknown letter and <b>*</b> for several, like <b>c?t</b> or <b>un*able</b>. You can type any spelling: colour or color.</p>');
        pickWordOfDay().then(function (w) {
            var card = $('#wotdCard');
            if (!card) return;
            if (!w) { card.hidden = true; return; }
            var s = w.ent.s[0];
            render(card, '<div class="label">Word of the day</div><div class="big">' + esc(D(w.ent.w)) + '</div>' +
                '<div class="muted"><i>' + esc(POS_NAME[s.p] || s.p) + '</i> · ' + esc(T(s.d)) + '</div>' +
                '<div style="margin-top:.6rem"><button class="btn small" data-act="word" data-key="' + esc(w.key) + '" data-mode="dict">Open</button></div>');
        });
    }
    function renderThesHome() {
        if (!index) return;
        render($('#thesHome'),
            '<div class="empty">' + ic('arrow-right-left', 'ic-xl') + '<p>Type a word to find synonyms and antonyms.</p></div>' +
            '<div class="chips"><button class="btn" data-act="random" data-mode="thes">' + ic('shuffle') + '<span>Random word</span></button></div>' +
            homeLists('thes'));
    }

    /* ================= Special forms ================= */
    var formsLimit = 80;
    function renderForms() {
        if (!meta) return;
        var counts = meta.forms || {};
        render($('#formTypes'), FORM_TYPES.filter(function (t) { return counts[t[0]]; }).map(function (t) {
            return '<button class="chip' + (S.formType === t[0] ? ' active' : '') + '" role="tab" data-act="formtype" data-type="' + t[0] + '">' + t[1] + ' <span style="opacity:.7">' + counts[t[0]].toLocaleString() + '</span></button>';
        }).join(''));
        var q = $('#formsInput').value;
        $('#formsClear').hidden = !q;
        getForms(S.formType).then(function (list) {
            var res = E.searchForms(list, q, formsLimit + 1);
            var more = res.length > formsLimit;
            res = res.slice(0, formsLimit);
            $('#formsCount').textContent = q ? res.length + (more ? '+' : '') + ' match' + (res.length === 1 ? '' : 'es') : list.length.toLocaleString() + ' in this list';
            if (!res.length) { render($('#formsList'), '<div class="empty">' + ic('quote', 'ic-xl') + '<p>Nothing found.</p></div>'); return; }
            var html = res.map(function (it) {
                var btn = S.formType === 'phrasal' ? '<button class="btn small" data-act="conj" data-verb="' + esc(it.p) + '">Tenses</button>' : '';
                return '<div class="panel"><div class="row-between"><div class="title big-text" style="font-weight:700">' + esc(T(it.p)) + '</div>' + btn + '</div>' +
                    '<div class="def" style="margin-top:.2rem">' + esc(T(it.d)) + '</div>' +
                    (it.x && it.x[0] ? '<div class="ex">“' + esc(T(it.x[0])) + '”</div>' : '') + '</div>';
            }).join('');
            if (more) html += '<button class="btn" style="width:100%" data-act="formsmore">Show more</button>';
            render($('#formsList'), html);
        });
    }

    /* ================= Basics ================= */
    var LESSONS = [
        { id: 'pos', title: 'Parts of speech', desc: 'The nine word classes with examples', icon: 'tag' },
        { id: 'tenses', title: 'The 12 verb tenses', desc: 'Forms, uses and examples', icon: 'clock' },
        { id: 'conj', title: 'Verb conjugator', desc: 'Type any verb to see all 12 tenses', icon: 'refresh-cw' },
        { id: 'irregular', title: 'Irregular verbs', desc: 'Searchable list of base, past and participle', icon: 'list' },
        { id: 'spelling', title: 'Spelling: Canadian · US · UK', desc: 'Patterns that differ between variants', icon: 'languages' },
        { id: 'plurals', title: 'Plurals', desc: 'Regular and irregular noun plurals', icon: 'layers' },
        { id: 'degrees', title: 'Comparing adjectives', desc: '-er / -est, more / most, irregulars', icon: 'trending-up' },
        { id: 'articles', title: 'Articles', desc: 'a, an, the and no article', icon: 'type' },
        { id: 'modals', title: 'Modal verbs', desc: 'can, may, must, should and friends', icon: 'key' },
        { id: 'confusables', title: 'Commonly confused words', desc: 'affect/effect, its/it’s, lose/loose…', icon: 'circle-help' },
        { id: 'punctuation', title: 'Punctuation', desc: 'Commas, apostrophes, dashes and more', icon: 'pilcrow' }
    ];

    function renderBasicsMenu() {
        render($('#basicsMenu'), LESSONS.map(function (l) {
            return '<button class="row" data-act="lesson" data-id="' + l.id + '"><span style="display:flex;align-items:center;gap:.8rem;min-width:0">' +
                '<span class="accent-text" style="font-size:1.3rem">' + ic(l.icon, 'ic-lg') + '</span>' +
                '<span style="min-width:0"><span class="title" style="display:block">' + esc(l.title) + '</span><span class="muted truncate" style="display:block">' + esc(l.desc) + '</span></span></span>' +
                '<span class="muted">' + ic('chevron-right') + '</span></button>';
        }).join(''));
    }

    function simpleTable(headers, rows, opts) {
        opts = opts || {};
        var h = '<div class="table-wrap"><table><thead><tr>' + headers.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) {
            h += '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' class="k"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
        });
        return h + '</tbody></table></div>';
    }

    function openLesson(id) {
        var lesson = LESSONS.filter(function (l) { return l.id === id; })[0];
        if (!lesson) return;
        openDetail({ title: lesson.title, build: function () { return getBasics().then(function (b) { return lessonPage(lesson, b); }); } });
    }

    function lessonPage(lesson, b) {
        var head = '<div class="panel"><h2 style="font-size:1.25rem;font-weight:800">' + esc(lesson.title) + '</h2><p class="muted">' + esc(lesson.desc) + '</p></div>';
        var out = { actions: '' };
        switch (lesson.id) {
            case 'pos':
                out.html = head + b.pos.map(function (p) {
                    return '<div class="panel"><div class="row-between"><h3 style="font-size:1rem">' + esc(p.name) + '</h3><span class="chip">' + esc(p.short) + '</span></div>' +
                        '<p style="margin-top:.3rem">' + esc(p.def) + '</p>' +
                        p.ex.map(function (x) { return '<div class="ex">' + bold(x) + '</div>'; }).join('') +
                        '<p class="hint" style="margin-top:.4rem">' + esc(p.note) + '</p></div>';
                }).join('');
                break;
            case 'tenses':
                var html = head + '<button class="btn accent-bg" data-act="lesson" data-id="conj">' + ic('refresh-cw') + '<span>Try the verb conjugator</span></button>';
                var group = '';
                b.tenses.forEach(function (t) {
                    if (t.group !== group) { group = t.group; html += '<div class="group-title">' + esc(group) + '</div>'; }
                    html += '<div class="panel tense"><h3>' + esc(t.name) + '</h3><div class="form">' + esc(t.form) + '</div><p>' + esc(t.use) + '</p>' +
                        t.ex.map(function (x) { return '<div class="ex">“' + esc(T(x)) + '”</div>'; }).join('') +
                        (t.note ? '<p class="hint" style="margin-top:.3rem">' + esc(t.note) + '</p>' : '') + '</div>';
                });
                out.html = html;
                break;
            case 'conj':
                out.html = head + '<div class="panel stack-sm"><label class="search"><span class="ic" data-ic="search"></span>' +
                    '<input id="conjInput" class="" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Type a verb: go, study, give up…" aria-label="Verb to conjugate" value="' + esc(conjLast) + '"></label>' +
                    '<div class="chips">' + ['be', 'have', 'go', 'work', 'study', 'run', 'write', 'travel'].map(function (v) { return '<button class="chip" data-act="conjverb" data-verb="' + v + '">' + v + '</button>'; }).join('') + '</div>' +
                    '<div class="seg" id="conjMode"><button data-v="affirm">Statement</button><button data-v="neg">Negative</button><button data-v="q">Question</button></div></div>' +
                    '<div id="conjOut" class="stack"></div>';
                out.after = function (body) {
                    var inp = $('#conjInput', body);
                    inp.addEventListener('input', debounce(function () { conjLast = inp.value; renderConj(b); }, 120));
                    $$('#conjMode button', body).forEach(function (bt) {
                        bt.classList.toggle('active', bt.getAttribute('data-v') === S.conjMode);
                        bt.addEventListener('click', function () {
                            S.conjMode = bt.getAttribute('data-v');
                            $$('#conjMode button', body).forEach(function (x) { x.classList.toggle('active', x === bt); });
                            renderConj(b);
                        });
                    });
                    renderConj(b);
                    if (!conjLast) inp.focus();
                };
                break;
            case 'irregular':
                out.html = head + '<label class="search"><span class="ic" data-ic="search"></span><input id="irrInput" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Filter verbs…" aria-label="Filter irregular verbs"></label>' +
                    '<p class="hint" id="irrCount"></p><div id="irrTable"></div>' +
                    '<p class="hint">Verbs with prefixes (undo, overcome, withdraw, understand) follow the same pattern as the base verb.' +
                    (S.dialect === 'us' ? ' American English uses “gotten” for get.' : ' Canadian and British English use “got” as the past participle of get; American English prefers “gotten”.') + '</p>';
                out.after = function (body) {
                    var inp = $('#irrInput', body);
                    function draw() {
                        var q = inp.value.trim().toLowerCase();
                        var rows = b.irregular.filter(function (r) { return !q || r.join(' ').indexOf(q) >= 0; });
                        $('#irrCount', body).textContent = rows.length + ' verb' + (rows.length === 1 ? '' : 's');
                        render($('#irrTable', body), simpleTable(['Base', 'Past simple', 'Past participle'], rows.map(function (r) { return [r[0], r[1].replace(/\//g, ' / '), r[2].replace(/\//g, ' / ')]; })));
                    }
                    inp.addEventListener('input', debounce(draw, 60));
                    draw();
                };
                break;
            case 'spelling':
                var cur = S.dialect;
                var th = '<th>Pattern</th>' + DIALECTS.map(function (d) { return '<th' + (d === cur ? ' class="accent-text"' : '') + '>' + DIALECT_NAME[d].slice(0, 3).toUpperCase() + '</th>'; }).join('');
                out.html = head + '<p class="muted">Canadian spelling blends the two: mostly British for -our, -re and -ence endings, mostly American for -ize and many others. Your current setting is <b class="accent-text">' + DIALECT_NAME[cur] + '</b>.</p>' +
                    '<div class="table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + b.spelling.map(function (r) {
                        var cells = { us: r[1], uk: r[2], ca: r[3] };
                        return '<tr><td class="k">' + esc(r[0]) + '<div class="hint" style="font-weight:400">' + esc(r[4]) + '</div></td>' +
                            DIALECTS.map(function (d) { return '<td' + (d === cur ? ' class="accent-text" style="font-weight:700"' : '') + '>' + esc(cells[d]) + '</td>'; }).join('') + '</tr>';
                    }).join('') + '</tbody></table></div>';
                break;
            case 'plurals': out.html = head + simpleTable(['Noun type', 'Rule', 'Examples'], b.plurals); break;
            case 'degrees': out.html = head + simpleTable(['Adjective type', 'Rule', 'Examples'], b.degrees); break;
            case 'articles': out.html = head + simpleTable(['Article', 'When to use it', 'Examples'], b.articles); break;
            case 'modals': out.html = head + simpleTable(['Modal', 'Expresses', 'Examples'], b.modals); break;
            case 'confusables': out.html = head + b.confusables.map(function (c) {
                return '<div class="panel"><h3 style="font-size:.95rem" class="accent-text">' + esc(c[0]) + '</h3><p>' + esc(c[1]) + '</p><div class="ex">' + esc(c[2]) + '</div></div>';
            }).join(''); break;
            case 'punctuation': out.html = head + b.punctuation.map(function (p) {
                return '<div class="panel"><h3 style="font-size:.95rem">' + esc(p[0]) + '</h3><p class="muted">' + esc(T(p[1])) + '</p></div>';
            }).join(''); break;
            default: out.html = head;
        }
        return out;
    }

    var conjLast = '';
    function renderConj(b) {
        var out = $('#conjOut');
        if (!out) return;
        var verb = conjLast.trim();
        if (!verb) { render(out, '<div class="empty">' + ic('refresh-cw', 'ic-xl') + '<p>Enter a verb to see its forms and all 12 tenses.</p></div>'); return; }
        var c = E.conjugate(verb, { irregular: irregular, dialect: S.dialect });
        if (!c) { render(out, '<div class="empty"><p>“' + esc(verb) + '” doesn’t look like a verb. Use letters only, such as “go” or “give up”.</p></div>'); return; }
        var f = c.forms;
        var html = '<div class="panel"><div class="row-between"><div class="label" style="margin:0">Forms</div>' + (f.irregular ? '<span class="chip accent-bg">irregular</span>' : '<span class="chip">regular</span>') + '</div>' +
            '<div class="chips" style="margin-top:.5rem">' +
            [['base', f.base], ['he/she/it', f.s], ['past', f.past], ['past participle', f.pp], ['-ing', f.ing]].map(function (x) {
                return '<span class="chip"><span class="faint">' + x[0] + '</span> <b>' + esc(x[1]) + '</b></span>';
            }).join('') + '</div>' +
            (f.alt.length ? '<p class="hint" style="margin-top:.4rem">Also: ' + esc(f.alt.join(' · ')) + '</p>' : '') + '</div>';
        var group = '';
        c.tenses.forEach(function (t) {
            var info = b.tenses.filter(function (x) { return x.key === t.key; })[0];
            if (info.group !== group) { group = info.group; html += '<div class="group-title">' + esc(group) + '</div>'; }
            html += '<div class="panel tense"><h3>' + esc(info.name) + '</h3><div class="form">' + esc(info.form) + '</div><div class="person-grid">' +
                c.persons.map(function (who) { return '<span class="who">' + esc(who) + '</span><span>' + esc(t.rows[S.conjMode][who].replace(/^(I|he\/she\/it|you\/we\/they) /, '')) + '</span>'; }).join('') + '</div></div>';
        });
        render(out, html);
    }
    function openConjugator(verb) {
        conjLast = verb;
        openLesson('conj');
    }

    /* ================= Settings ================= */
    function updatePackInfo() {
        if (!meta) { $('#packInfo').textContent = 'Word data not loaded'; return; }
        $('#packInfo').textContent = (meta.pack === 'sample' ? 'SAMPLE pack · ' : (meta.pack === 'full' ? 'Full pack · ' : '')) +
            meta.words.toLocaleString() + ' words · v' + meta.version;
        var src = (meta.sources || []).map(function (s) {
            return esc(s.name) + ' — ' + esc(s.license) + (s.url ? ' (<a style="color:var(--accent-color)" href="' + esc(s.url) + '" target="_blank" rel="noopener">link</a>)' : '');
        });
        $('#attributions').innerHTML = (src.length ? src.join('<br>') + '<br>' : '') +
            'Grammar notes, spelling lists and app: Monarch Language Suite. Wiktionary text is shared under CC BY-SA, so derived data stays under that licence.';
    }

    function setSeg(id, value, cb) {
        var seg = $(id);
        $$('button', seg).forEach(function (b) {
            b.classList.toggle('active', String(b.getAttribute('data-v')) === String(value));
            b.onclick = function () { cb(b.getAttribute('data-v')); setSeg(id, b.getAttribute('data-v'), cb); };
        });
    }
    function buildSettings() {
        setSeg('#setDialect', S.dialect, function (v) { setDialect(v); });
        setSeg('#setTheme', S.theme, function (v) { S.theme = v; store.set('mn_theme', v); applyTheme(); });
        setSeg('#setSize', S.fs, function (v) { S.fs = parseInt(v, 10); store.set('mn_fs', S.fs); applyFontSize(); });
        render($('#setAccent'), ACCENTS.map(function (a) {
            return '<button class="swatch' + (S.accent === a[0] ? ' active' : '') + '" style="background:' + a[0] + '" data-act="accent" data-color="' + a[0] + '" aria-label="' + esc(a[1]) + '"></button>';
        }).join(''));
        $('#setIpa').checked = !!S.ipa;
        $('#setEty').checked = !!S.ety;
        updateDataCounts();
        updateOfflineStatus();
    }
    function setDialect(v) {
        if (DIALECTS.indexOf(v) < 0) return;
        S.dialect = v; store.set('mn_dialect', v);
        applyDialectUi();
        runSearch('dict'); runSearch('thes');
        renderDictHome(); renderThesHome();
        if (S.tab === 'forms') renderForms();
        refreshDetail();
        if ($('#settingsModal').hidden === false) setSeg('#setDialect', v, function (x) { setDialect(x); });
    }

    /* ---------- offline download (PWA) ---------- */
    var CORE_FILES = ['./', 'index.html', 'css/monarch.css', 'js/engine.js', 'js/app.js', 'manifest.json', 'icon.png', 'small-icon.png'];
    var ICON_NAMES = ['settings', 'book-open', 'arrow-right-left', 'quote', 'graduation-cap', 'search', 'x', 'arrow-left', 'chevron-right', 'volume-2', 'star', 'star-filled',
        'shuffle', 'copy', 'download', 'trash-2', 'history', 'tag', 'clock', 'refresh-cw', 'list', 'languages', 'layers', 'trending-up', 'type', 'key', 'circle-help', 'pilcrow'];
    function updateOfflineStatus() {
        var block = $('#offlineBlock'), st = $('#offlineStatus'), btn = $('#btnOffline');
        if (isNative()) {
            st.textContent = 'All word data is built into the app, so it always works offline.';
            btn.hidden = true;
            return;
        }
        if (!('caches' in window) || !('serviceWorker' in navigator)) { st.textContent = 'This browser can’t store the app offline.'; btn.hidden = true; return; }
        var v = store.get('mn_offline_v', null);
        if (meta && v === meta.version) {
            st.textContent = 'Offline ready. Everything is saved on this device (' + (meta.totalBytes / 1048576).toFixed(1) + ' MB of word data).';
            btn.querySelector('span:last-child').textContent = 'Re-download';
        } else {
            st.textContent = 'Pages you open are saved automatically. Download everything once so any word works without a connection' +
                (meta ? ' (' + (meta.totalBytes / 1048576).toFixed(1) + ' MB).' : '.');
        }
    }
    function downloadOffline() {
        if (!meta) return;
        var btn = $('#btnOffline'), bar = $('#offlineBar'), fill = bar.firstElementChild;
        var urls = CORE_FILES.slice();
        ICON_NAMES.forEach(function (n) { urls.push('assets/icons/' + n + '.svg'); });
        urls.push(DATA + 'meta.json');
        meta.files.forEach(function (f) { urls.push(DATA + f.path); });
        var total = urls.length, done = 0, failed = 0, i = 0;
        btn.disabled = true; bar.hidden = false; fill.style.width = '0';
        caches.open('monarch-data-v1').then(function (cache) {
            function worker() {
                if (i >= urls.length) return Promise.resolve();
                var url = urls[i++];
                return fetch(url).then(function (r) { if (r.ok) return cache.put(url, r); if (!/assets\/icons\//.test(url)) failed++; })
                    .catch(function () { failed++; })
                    .then(function () { done++; fill.style.width = Math.round(done / total * 100) + '%'; $('#offlineStatus').textContent = 'Downloading… ' + done + ' / ' + total; return worker(); });
            }
            return Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
        }).then(function () {
            btn.disabled = false; bar.hidden = true;
            if (!failed) { store.set('mn_offline_v', meta.version); toast('Ready for offline use'); } else toast(failed + ' file(s) could not be saved. Try again online.');
            updateOfflineStatus();
        }).catch(function () { btn.disabled = false; bar.hidden = true; toast('Download failed'); updateOfflineStatus(); });
    }

    /* ================= events ================= */
    document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act]');
        if (!t) return;
        var act = t.getAttribute('data-act');
        switch (act) {
            case 'word':
                if (t.getAttribute('data-swap') && detailStack.length) { detailStack.pop(); try { history.back(); } catch (x) { /* ignore */ } setTimeout(function () { openWord(t.getAttribute('data-key'), t.getAttribute('data-mode')); }, 30); }
                else openWord(t.getAttribute('data-key'), t.getAttribute('data-mode'));
                break;
            case 'random': randomWord(t.getAttribute('data-mode')); break;
            case 'fav': toggleFav(t.getAttribute('data-key')); refreshDetail(); break;
            case 'speak': speak(t.getAttribute('data-text')); break;
            case 'copy': copyText(t.getAttribute('data-text')); break;
            case 'lesson': openLesson(t.getAttribute('data-id')); break;
            case 'conj': openConjugator(t.getAttribute('data-verb')); break;
            case 'conjverb': conjLast = t.getAttribute('data-verb'); var ci = $('#conjInput'); if (ci) ci.value = conjLast; getBasics().then(renderConj); break;
            case 'formtype': S.formType = t.getAttribute('data-type'); store.set('mn_formtype', S.formType); formsLimit = 80; renderForms(); break;
            case 'formsmore': formsLimit += 120; renderForms(); break;
            case 'accent':
                S.accent = t.getAttribute('data-color'); store.set('mn_accent', S.accent); applyAccent();
                $$('#setAccent .swatch').forEach(function (s) { s.classList.toggle('active', s === t); });
                break;
        }
    });

    function wireUi() {
        $$('#navTabs .tab-btn').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });
        $('#detailBack').addEventListener('click', backDetail);
        wireSearch('dict'); wireSearch('thes');
        $('#formsInput').addEventListener('input', debounce(function () { formsLimit = 80; renderForms(); }, 80));
        $('#formsClear').addEventListener('click', function () { $('#formsInput').value = ''; formsLimit = 80; renderForms(); });

        $('#dialectPill').addEventListener('click', function () {
            var next = DIALECTS[(DIALECTS.indexOf(S.dialect) + 1) % DIALECTS.length];
            setDialect(next);
            toast(DIALECT_NAME[next] + ' English');
        });
        $('#openSettings').addEventListener('click', function () { buildSettings(); $('#settingsModal').hidden = false; });
        $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { $('#settingsModal').hidden = true; }); });
        $('#settingsModal').addEventListener('click', function (e) { if (e.target.id === 'settingsModal') e.target.hidden = true; });
        $('#setIpa').addEventListener('change', function (e) { S.ipa = e.target.checked; store.set('mn_ipa', S.ipa); refreshDetail(); });
        $('#setEty').addEventListener('change', function (e) { S.ety = e.target.checked; store.set('mn_ety', S.ety); refreshDetail(); });
        $('#btnClearHistory').addEventListener('click', function () { S.hist = []; store.set('mn_hist', S.hist); updateDataCounts(); renderDictHome(); renderThesHome(); toast('Recent words cleared'); });
        $('#btnClearFavs').addEventListener('click', function () { S.favs = []; store.set('mn_favs', S.favs); updateDataCounts(); renderDictHome(); renderThesHome(); refreshDetail(); toast('Favourites cleared'); });
        $('#btnOffline').addEventListener('click', downloadOffline);

        var deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; $('#btnInstall').hidden = false; });
        $('#btnInstall').addEventListener('click', function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function () { deferredPrompt = null; $('#btnInstall').hidden = true; });
        });
    }

    /* ================= start ================= */
    function showDataError(err) {
        render($('#dictHome'), '<div class="empty">' + ic('circle-alert', 'ic-xl') + '<p><b>Word data not found.</b></p>' +
            '<p class="hint" style="margin-top:.4rem">Put the <b>data</b> folder next to index.html. Build it with:<br><span class="mono">python3 tools/build_data.py --oewn … --kaikki … --out data</span></p></div>');
        $('#thesHome').innerHTML = '';
        console.error(err);
    }

    function init() {
        applyTheme(); applyAccent(); applyFontSize(); applyDialectUi();
        wireUi();
        renderBasicsMenu();
        hydrate(document);
        updateDataCounts();
        render($('#dictHome'), '<div class="loading"><span class="spin">' + ic('refresh-cw') + '</span> Loading dictionary…</div>');

        Promise.all([getText('index.txt'), getJSON('spelling.json'), getJSON('meta.json')]).then(function (r) {
            index = E.parseIndex(r[0]);
            sp = E.createSpelling(r[1]);
            meta = r[2];
            updatePackInfo();
            renderDictHome(); renderThesHome();
            getBasics().catch(function () { /* lessons will show an error toast when opened */ });
            if (S.tab === 'forms') renderForms();
        }).catch(showDataError);

        if ('serviceWorker' in navigator && !isNative() && /^https?:$/.test(location.protocol)) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('sw.js').then(function (reg) {
                    reg.addEventListener('updatefound', function () {
                        var nw = reg.installing;
                        if (nw) nw.addEventListener('statechange', function () {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready. Reopen the app to use it.');
                        });
                    });
                }).catch(function () { /* offline caching unavailable */ });
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
