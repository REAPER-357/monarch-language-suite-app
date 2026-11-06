// Checks the "by meaning" search: Python (index writer) and JavaScript (app) must agree, and real queries must work.
//   node tests/reverse.test.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));

const ROOT = path.join(__dirname, '..');
let fails = 0, passed = 0;
function check(name, cond, info) {
    if (cond) { passed++; } else { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
}

// 1. Stemmer and stop words agree with packlib.py
const WORDS = ('studies studying studied study stars star running run runs ran stopped stop making make makes made loved loving love ' +
    'boxes box houses house horses glasses glass buses bus falling fall added adding add stuffed stuff fears fearing feared fear ' +
    'heights height person people cities city tried trying try bring singing sing seeing seed feeding feed analyses lies tie pies ' +
    'plants planted planting dogs dog cats ate eat eating fastest happier happy').split(' ');
const py = JSON.parse(execFileSync('python3', ['-I', '-c',
    'import json,sys; sys.path.insert(0,sys.argv[1]); import packlib; w=sys.argv[2].split(" ");' +
    'print(json.dumps({"stem":[packlib.stem_token(x) for x in w],"stop":sorted(packlib.STOP),"terms":packlib.rev_terms("A person who studies the stars, running quickly!")}))',
    path.join(ROOT, 'tools'), WORDS.join(' ')]).toString());
check('stemmer matches Python for every sample word', WORDS.every((w, i) => E.stemToken(w) === py.stem[i]),
    WORDS.filter((w, i) => E.stemToken(w) !== py.stem[i]).map(w => [w, E.stemToken(w)]));
check('stop-word lists match', JSON.stringify(Object.keys(E.STOP).sort()) === JSON.stringify(py.stop));
check('terms match Python', JSON.stringify(E.queryTerms('A person who studies the stars, running quickly!')) === JSON.stringify(py.terms.filter((t, i) => py.terms.indexOf(t) === i)), py.terms);
check('forms of one word share a stem', ['study', 'studies', 'studying', 'studied'].every(w => E.stemToken(w) === 'study'));
check('run / running / runs share a stem', ['run', 'running', 'runs'].every(w => E.stemToken(w) === 'run'));
check('make / making / makes share a stem', ['make', 'making', 'makes'].every(w => E.stemToken(w) === 'mak'));

// 2. Build the sample pack and run real queries against it
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'monarch-rev-'));
execFileSync('python3', ['-I', path.join(ROOT, 'tools', 'build_data.py'), '--sample', '--out', out]);
const meta = JSON.parse(fs.readFileSync(path.join(out, 'meta.json'), 'utf8'));
check('meta reports the meaning index', meta.reverse && meta.reverse.tokens > 100, meta.reverse);
check('rev files are listed for offline download', meta.files.some(f => f.path === 'rev/h.txt'));
const index = E.parseIndex(fs.readFileSync(path.join(out, 'index.txt'), 'utf8'));
const cache = {};
function lookup(q) {
    const terms = E.queryTerms(q);
    const lists = terms.map(t => {
        const c = t[0];
        if (!(c in cache)) {
            const p = path.join(out, 'rev', c + '.txt');
            cache[c] = fs.existsSync(p) ? E.parseRevFile(fs.readFileSync(p, 'utf8')) : {};
        }
        return E.decodePostings(cache[c][t]);
    });
    return E.reverseSearch(lists, 10).map(h => (index.canon[h.id] || index.words[h.id]).toLowerCase());
}
let r = lookup('feeling pleasure and joy');
check('"feeling pleasure" finds a happiness word or none crash', Array.isArray(r), r);
r = lookup('enjoying or showing pleasure');
check('definition words find the word (happy)', r.includes('happy'), r);
r = lookup('a small domesticated feline');
check('describes a cat', r.includes('cat'), r);
r = lookup('ENJOYING   Pleasure!!');
check('case, spacing and punctuation do not matter', r.includes('happy'), r);
check('empty and stop-word-only queries return nothing', lookup('').length === 0 && lookup('the of and').length === 0);
check('gibberish returns nothing', lookup('zzqqxx').length === 0);
check('ids point at real index lines', E.reverseSearch([E.decodePostings(cache['h'] && cache['h']['happy'])], 5).every(h => index.words[h.id] !== undefined));

fs.rmSync(out, { recursive: true, force: true });
console.log(passed + ' checks passed' + (fails ? ', ' + fails + ' FAILED' : ''));
process.exit(fails ? 1 : 0);
