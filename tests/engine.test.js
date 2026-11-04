// Run: node tests/engine.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

let passed = 0;
function t(name, fn) {
    try { fn(); passed++; }
    catch (e) { console.error('FAIL:', name, '\n   ', e.message); process.exitCode = 1; }
}

// irregular map from basics.json
const basics = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/basics.json'), 'utf8'));
const irregular = {};
basics.irregular.forEach(([b, p, pp]) => { irregular[b] = { past: p.split('/'), pp: pp.split('/') }; });
const F = (v, d) => E.verbForms(v, { irregular, dialect: d || 'ca' });

/* ---- verb forms ---- */
t('regular -s/-ing/-ed', () => {
    const f = F('work');
    assert.deepStrictEqual([f.s, f.ing, f.past, f.pp], ['works', 'working', 'worked', 'worked']);
});
t('consonant doubling', () => {
    assert.strictEqual(F('stop').ing, 'stopping');
    assert.strictEqual(F('stop').past, 'stopped');
    assert.strictEqual(F('begin').ing, 'beginning');
    assert.strictEqual(F('prefer').past, 'preferred');
    assert.strictEqual(F('quit').ing, 'quitting');
    assert.strictEqual(F('visit').ing, 'visiting');
    assert.strictEqual(F('listen').past, 'listened');
    assert.strictEqual(F('open').ing, 'opening');
});
t('y -> ied, e dropping, ie -> ying', () => {
    assert.strictEqual(F('study').past, 'studied');
    assert.strictEqual(F('study').s, 'studies');
    assert.strictEqual(F('play').past, 'played');
    assert.strictEqual(F('make').ing, 'making');
    assert.strictEqual(F('die').ing, 'dying');
    assert.strictEqual(F('agree').ing, 'agreeing');
    assert.strictEqual(F('panic').ing, 'panicking');
    assert.strictEqual(F('fix').s, 'fixes');
    assert.strictEqual(F('go').s, 'goes');
    assert.strictEqual(F('watch').s, 'watches');
});
t('travel doubles l in CA/UK, not US', () => {
    assert.strictEqual(F('travel', 'ca').past, 'travelled');
    assert.strictEqual(F('travel', 'uk').ing, 'travelling');
    assert.strictEqual(F('travel', 'us').past, 'traveled');
    assert.strictEqual(F('cancel', 'us').ing, 'canceling');
    assert.strictEqual(F('control', 'us').past, 'controlled');
});
t('irregular verbs and prefixes', () => {
    assert.strictEqual(F('go').past, 'went');
    assert.strictEqual(F('go').pp, 'gone');
    assert.strictEqual(F('write').pp, 'written');
    assert.strictEqual(F('be').past, 'was');
    assert.strictEqual(F('have').s, 'has');
    assert.strictEqual(F('undo').past, 'undid');
    assert.strictEqual(F('undo').pp, 'undone');
    assert.strictEqual(F('understand').pp, 'understood');
    assert.strictEqual(F('overcome').past, 'overcame');
    assert.strictEqual(F('relay').past, 'relayed');
    assert.strictEqual(F('get', 'us').pp, 'gotten');
    assert.strictEqual(F('get', 'ca').pp, 'got');
    assert.strictEqual(F('learn', 'uk').past, 'learnt');
    assert.strictEqual(F('learn', 'ca').past, 'learned');
});
t('phrasal verb keeps particle', () => {
    const f = F('give up');
    assert.deepStrictEqual([f.s, f.ing, f.past, f.pp], ['gives up', 'giving up', 'gave up', 'given up']);
});
t('invalid verb returns null', () => {
    assert.strictEqual(E.verbForms('123', { irregular }), null);
    assert.strictEqual(E.conjugate('', { irregular }), null);
});

/* ---- tenses ---- */
const C = (v, d) => E.conjugate(v, { irregular, dialect: d || 'ca' });
const row = (c, key, kind, who) => c.tenses.find(x => x.key === key).rows[kind][who];

t('12 tenses are produced', () => {
    assert.strictEqual(C('work').tenses.length, 12);
});
t('regular verb tenses', () => {
    const c = C('work');
    assert.strictEqual(row(c, 'presentSimple', 'affirm', 'he/she/it'), 'he/she/it works');
    assert.strictEqual(row(c, 'presentSimple', 'neg', 'he/she/it'), 'he/she/it does not work');
    assert.strictEqual(row(c, 'presentSimple', 'q', 'he/she/it'), 'Does he/she/it work?');
    assert.strictEqual(row(c, 'presentContinuous', 'affirm', 'I'), 'I am working');
    assert.strictEqual(row(c, 'presentPerfect', 'affirm', 'he/she/it'), 'he/she/it has worked');
    assert.strictEqual(row(c, 'presentPerfectContinuous', 'affirm', 'you/we/they'), 'you/we/they have been working');
    assert.strictEqual(row(c, 'pastSimple', 'neg', 'I'), 'I did not work');
    assert.strictEqual(row(c, 'pastContinuous', 'affirm', 'you/we/they'), 'you/we/they were working');
    assert.strictEqual(row(c, 'pastPerfect', 'q', 'I'), 'Had I worked?');
    assert.strictEqual(row(c, 'pastPerfectContinuous', 'affirm', 'I'), 'I had been working');
    assert.strictEqual(row(c, 'futureSimple', 'neg', 'I'), 'I will not work');
    assert.strictEqual(row(c, 'futureContinuous', 'q', 'he/she/it'), 'Will he/she/it be working?');
    assert.strictEqual(row(c, 'futurePerfect', 'affirm', 'I'), 'I will have worked');
    assert.strictEqual(row(c, 'futurePerfectContinuous', 'affirm', 'I'), 'I will have been working');
});
t('verb "be" tenses', () => {
    const c = C('be');
    assert.strictEqual(row(c, 'presentSimple', 'affirm', 'I'), 'I am');
    assert.strictEqual(row(c, 'presentSimple', 'neg', 'he/she/it'), 'he/she/it is not');
    assert.strictEqual(row(c, 'presentSimple', 'q', 'you/we/they'), 'Are you/we/they?');
    assert.strictEqual(row(c, 'pastSimple', 'affirm', 'you/we/they'), 'you/we/they were');
    assert.strictEqual(row(c, 'presentContinuous', 'affirm', 'I'), 'I am being');
    assert.strictEqual(row(c, 'presentPerfect', 'affirm', 'I'), 'I have been');
});
t('irregular verb tenses', () => {
    const c = C('go');
    assert.strictEqual(row(c, 'pastSimple', 'affirm', 'I'), 'I went');
    assert.strictEqual(row(c, 'presentPerfect', 'affirm', 'he/she/it'), 'he/she/it has gone');
    assert.strictEqual(row(c, 'presentSimple', 'affirm', 'he/she/it'), 'he/she/it goes');
});
t('phrasal verb tenses', () => {
    const c = C('give up');
    assert.strictEqual(row(c, 'pastSimple', 'neg', 'I'), 'I did not give up');
    assert.strictEqual(row(c, 'presentContinuous', 'affirm', 'he/she/it'), 'he/she/it is giving up');
});

/* ---- spelling ---- */
const spelling = E.createSpelling([['color', 'colour', 'colour'], ['organize', 'organise', 'organize'], ['gray', 'grey', 'grey'], ['center', 'centre', 'centre'], ['colors', 'colours', 'colours']]);
t('spelling per dialect', () => {
    assert.strictEqual(spelling.word('color', 'ca'), 'colour');
    assert.strictEqual(spelling.word('color', 'us'), 'color');
    assert.strictEqual(spelling.word('colour', 'us'), 'color');
    assert.strictEqual(spelling.word('organise', 'ca'), 'organize');
    assert.strictEqual(spelling.word('organize', 'uk'), 'organise');
    assert.strictEqual(spelling.word('table', 'uk'), 'table');
});
t('spelling keeps capitalization', () => {
    assert.strictEqual(spelling.word('Color', 'ca'), 'Colour');
    assert.strictEqual(spelling.word('COLOR', 'uk'), 'COLOUR');
});
t('text conversion', () => {
    assert.strictEqual(spelling.text('The gray color of the center.', 'uk'), 'The grey colour of the centre.');
    assert.strictEqual(spelling.text('We organise the colours', 'us'), 'We organize the colors');
});
t('canonical', () => {
    assert.strictEqual(spelling.canonical('Colour'), 'color');
    assert.strictEqual(spelling.canonical('Table'), 'table');
});

/* ---- index and search ---- */
const idxText = ['apple', 'apply', 'banana', 'center', 'centre|center', 'color', 'colour|color', 'colt', 'cool', 'dictionary', 'Paris', 'zebra'].join('\n');
const idx = E.parseIndex(idxText);
t('prefix search with alias dedupe', () => {
    const r = E.search(idx, 'col', { spelling, dialect: 'ca' });
    assert.deepStrictEqual(r.map(x => x.w), ['colour', 'colt']);
    assert.deepStrictEqual(r.map(x => x.key), ['color', 'colt']);
});
t('typing a variant finds the entry', () => {
    const r = E.search(idx, 'centr', { spelling, dialect: 'ca' });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].key, 'center');
    assert.strictEqual(r[0].w, 'centre');
});
t('exact match first', () => {
    const r = E.search(idx, 'apple', { spelling, dialect: 'us' });
    assert.strictEqual(r[0].w, 'apple');
});
t('case-insensitive, keeps index casing', () => {
    const r = E.search(idx, 'PAR');
    assert.strictEqual(r[0].w, 'Paris');
});
t('no results', () => {
    assert.deepStrictEqual(E.search(idx, 'qqq'), []);
});
t('wildcards', () => {
    assert.deepStrictEqual(E.search(idx, 'co?t').map(x => x.w), ['colt']);
    assert.deepStrictEqual(E.search(idx, 'c*l').map(x => x.w).sort(), ['cool']);
    assert.deepStrictEqual(E.search(idx, 'a*').map(x => x.w), ['apple', 'apply']);
});
t('suggestions for typos', () => {
    const s = E.suggest(idx, 'dictionry');
    assert.strictEqual(s[0].w, 'dictionary');
    const z = E.suggest(idx, 'zebar');
    assert.strictEqual(z[0].w, 'zebra');
});
t('edit distance', () => {
    assert.strictEqual(E.editDistance('kitten', 'sitting', 5), 3);
    assert.strictEqual(E.editDistance('abc', 'abc', 2), 0);
    assert.strictEqual(E.editDistance('ab', 'ba', 2), 1);
});
t('chunk keys', () => {
    assert.strictEqual(E.chunkKey('Apple'), 'ap');
    assert.strictEqual(E.chunkKey('a'), 'a_');
    assert.strictEqual(E.chunkKey("o'clock"), 'o_');
    assert.strictEqual(E.chunkKey('3d'), '_d');
});
t('forms search', () => {
    const list = [{ p: 'break the ice' }, { p: 'piece of cake' }, { p: 'ice breaker' }, { p: 'a blessing in disguise' }];
    assert.strictEqual(E.searchForms(list, 'ice')[0].p, 'ice breaker');
    assert.strictEqual(E.searchForms(list, 'break ice').length, 2);
    assert.strictEqual(E.searchForms(list, 'zzz').length, 0);
    assert.strictEqual(E.searchForms(list, '').length, 4);
});

console.log(passed + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
