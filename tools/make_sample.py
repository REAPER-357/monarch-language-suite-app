#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Writes a tiny test dataset in the same formats as the real sources:
   tools/sample/oewn-sample.xml    (WN-LMF, like Open English WordNet)
   tools/sample/kaikki-sample.jsonl (like the Kaikki.org English Wiktionary extract)
The content is hand-written for testing only. Use the real sources for the Full pack."""
import json
import os
from xml.sax.saxutils import escape, quoteattr

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'sample')

# id: (pos, [lemmas], definition, [examples], [(relation, target synset)])
SYN = {
    'color1': ('n', ['color', 'colour'], 'a visual attribute of things that results from the light they emit or transmit or reflect', ['a white color'], [('hypernym', 'attr1'), ('hyponym', 'red1'), ('hyponym', 'blue1')]),
    'color2': ('n', ['color', 'colour', 'coloring', 'colouring'], 'a substance that gives its color to something', ['she used a red color for the walls'], []),
    'color3': ('v', ['color', 'colour'], 'give a color to', ['The child colored the drawing with crayons'], []),
    'attr1': ('n', ['attribute', 'property'], 'an abstraction belonging to or characteristic of an entity', [], [('hyponym', 'color1')]),
    'red1': ('n', ['red', 'redness'], 'red color or pigment; the chromatic color resembling the hue of blood', [], [('hypernym', 'color1')]),
    'blue1': ('n', ['blue', 'blueness'], 'blue color or pigment; resembling the color of the clear sky in the daytime', [], [('hypernym', 'color1')]),
    'center1': ('n', ['center', 'centre', 'middle', 'midpoint'], 'an area that is approximately central within some larger region', ['it is in the center of town'], []),
    'theater1': ('n', ['theater', 'theatre'], 'a building where theatrical performances or motion-picture shows can be presented', ['they saw a play at the theatre'], []),
    'behavior1': ('n', ['behavior', 'behaviour', 'conduct'], 'manner of acting or conducting oneself', ['his bad behavior got him expelled'], []),
    'defense1': ('n', ['defense', 'defence', 'defending'], 'the action of defending against attack', ['the defence of the city was heroic'], []),
    'gray1': ('a', ['gray', 'grey'], 'of an achromatic color of any lightness between the extremes of black and white', ['gray flannel suit'], []),
    'catalog1': ('n', ['catalog', 'catalogue'], 'a complete list of things, usually arranged systematically with descriptive details', ['a catalog of the museum collection'], []),
    'dog1': ('n', ['dog', 'domestic dog'], 'a member of the genus Canis that has been domesticated by man since prehistoric times', ['the dog barked all night'], [('hypernym', 'canine1'), ('hyponym', 'retriever1')]),
    'canine1': ('n', ['canine', 'canid'], 'any of various fissiped mammals with nonretractile claws and typically long muzzles', [], [('hyponym', 'dog1')]),
    'retriever1': ('n', ['retriever'], 'a breed of medium to large dogs used for retrieving game', [], [('hypernym', 'dog1')]),
    'cat1': ('n', ['cat', 'true cat'], 'feline mammal usually having thick soft fur and no ability to roar', ['the cat purred'], [('hypernym', 'feline1')]),
    'feline1': ('n', ['feline', 'felid'], 'any of various lithe-bodied roundheaded fissiped mammals, many with retractile claws', [], [('hyponym', 'cat1')]),
    'house1': ('n', ['house'], 'a dwelling that serves as living quarters for one or more families', ['he has a house on the lake'], [('hypernym', 'dwelling1'), ('hyponym', 'cabin1')]),
    'dwelling1': ('n', ['dwelling', 'home', 'domicile', 'abode', 'habitation'], 'housing that someone is living in', [], [('hyponym', 'house1')]),
    'cabin1': ('n', ['cabin', 'log cabin'], 'a small house built of wood', ['a cabin in the woods'], [('hypernym', 'house1')]),
    'love1': ('n', ['love'], 'a strong positive emotion of regard and affection', ['his love for his work', 'children need a lot of love'], []),
    'hate1': ('n', ['hate', 'hatred'], 'the emotion of intense dislike; a feeling of dislike so strong that it is difficult to control', [], []),
    'love2': ('v', ['love'], 'have a great affection or liking for', ['I love my parents', 'She loves cooking'], []),
    'hate2': ('v', ['hate'], 'dislike intensely; feel antipathy or aversion towards', ['I hate Mondays'], []),
    'time1': ('n', ['time'], 'an instance or single occasion for some event', ['this time he succeeded'], []),
    'time2': ('n', ['time'], 'the continuum of experience in which events pass from the future through the present to the past', ['time heals all wounds'], []),
    'book1': ('n', ['book', 'volume'], 'a written work or composition that has been published (printed on pages bound together)', ['I am reading a book about Canadian history'], []),
    'water1': ('n', ['water', 'H2O'], 'a clear colorless odorless tasteless liquid essential for most plant and animal life', ['a glass of water'], []),
    'fire1': ('n', ['fire'], 'the event of something burning (often destructive)', ['they lost everything in the fire'], []),
    'light1': ('n', ['light', 'visible light', 'visible radiation'], 'electromagnetic radiation that can produce a visual sensation', ['the light of the sun'], []),
    'run1': ('v', ['run'], "move fast by using one's feet, with one foot off the ground at any given time", ["Don't run, you'll be out of breath"], []),
    'run2': ('v', ['run', 'operate'], 'direct or control; projects, businesses, etc.', ['She runs a small bakery'], []),
    'run3': ('v', ['run', 'flow'], 'move along, of liquids', ['The river runs through the valley'], []),
    'run4': ('n', ['run'], 'the act of running; traveling on foot at a fast pace', ['he broke into a run'], []),
    'walk1': ('v', ['walk'], "use one's feet to advance; advance by steps", ['Walk to the store'], []),
    'walk2': ('n', ['walk', 'walking'], 'the act of traveling by foot', ['we took a walk in the park'], []),
    'organize1': ('v', ['organize', 'organise'], 'arrange by systematic planning and united effort', ['organize a strike', 'organize a conference'], []),
    'analyze1': ('v', ['analyze', 'analyse', 'break down', 'dissect', 'take apart'], 'break down into components or essential features', ['analyze a chemical compound'], []),
    'travel1': ('v', ['travel', 'go', 'move', 'locomote'], 'change location; move, travel, or proceed, also metaphorically', ['How fast does your new car go?'], []),
    'cancel1': ('v', ['cancel', 'call off'], 'postpone indefinitely or annul something that was scheduled', ['The ball game was called off'], []),
    'fulfill1': ('v', ['fulfill', 'fulfil'], 'meet the requirements or expectations of', ['she fulfilled her promise'], []),
    'happy1': ('a', ['happy'], 'enjoying or showing or marked by joy or pleasure', ['a happy smile', 'spent many happy days on the beach'], [('similar', 'glad1')]),
    'glad1': ('a', ['glad'], 'showing or causing joy and pleasure; especially made happy', ['glad you are here'], []),
    'unhappy1': ('a', ['unhappy'], 'experiencing or showing sorrow or unhappiness; sad', ['unhappy over the loss of his job'], []),
    'big1': ('a', ['big', 'large'], 'above average in size or number or quantity or magnitude or extent', ['a large city', 'a big job'], []),
    'small1': ('a', ['small', 'little'], 'limited or below average in number or quantity or magnitude or extent', ['a small group', 'a little house'], []),
    'fast1': ('a', ['fast', 'quick', 'speedy', 'swift'], 'acting or moving or capable of acting or moving quickly', ['a fast car', 'a quick reply'], []),
    'slow1': ('a', ['slow'], 'not moving quickly; taking a comparatively long time', ['a slow walker'], []),
    'good1': ('a', ['good'], 'having desirable or positive qualities especially those suitable for a thing specified', ['good news from the hospital'], []),
    'bad1': ('a', ['bad'], 'having undesirable or negative qualities', ['a bad report card'], []),
    'beautiful1': ('a', ['beautiful', 'lovely', 'gorgeous'], 'delighting the senses or exciting intellectual or emotional admiration', ['a beautiful child', 'beautiful music'], []),
    'honor1': ('n', ['honor', 'honour'], 'the state of being honored', ['it is a great honor to be here'], []),
    'neighbor1': ('n', ['neighbor', 'neighbour'], 'a person who lives (or is located) near another', ['my next-door neighbor'], []),
    'favorite1': ('a', ['favorite', 'favourite'], 'preferred above all others and treated with partiality', ['her favorite book'], []),
    'jewelry1': ('n', ['jewelry', 'jewellery'], 'an ornamental item worn for personal adornment', ['she wore a lot of jewelry'], []),
}
ANTONYMS = [('love', 'love1', 'hate', 'hate1'), ('love', 'love2', 'hate', 'hate2'),
            ('happy', 'happy1', 'unhappy', 'unhappy1'), ('big', 'big1', 'small', 'small1'),
            ('fast', 'fast1', 'slow', 'slow1'), ('good', 'good1', 'bad', 'bad1')]


def write_oewn(path):
    entries = {}
    for sid, (pos, lemmas, *_rest) in SYN.items():
        for lem in lemmas:
            entries.setdefault((lem, pos), []).append(sid)
    ants = {}
    for a, sa, b, sb in ANTONYMS:
        ants.setdefault((a, sa), []).append('%s-%s' % (b, sb))
        ants.setdefault((b, sb), []).append('%s-%s' % (a, sa))
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<LexicalResource>',
           '<Lexicon id="oewn-sample" label="Sample" language="en" email="x@example.com" license="test" version="sample" url="">']
    for (lem, pos), sids in entries.items():
        out.append('<LexicalEntry id=%s>' % quoteattr('e-%s-%s' % (lem, pos)))
        out.append('<Lemma writtenForm=%s partOfSpeech=%s/>' % (quoteattr(lem), quoteattr(pos)))
        for sid in sids:
            out.append('<Sense id=%s synset=%s>' % (quoteattr('%s-%s' % (lem, sid)), quoteattr(sid)))
            for t in ants.get((lem, sid), []):
                out.append('<SenseRelation relType="antonym" target=%s/>' % quoteattr(t))
            out.append('</Sense>')
        out.append('</LexicalEntry>')
    for sid, (pos, lemmas, d, ex, rel) in SYN.items():
        out.append('<Synset id=%s partOfSpeech=%s>' % (quoteattr(sid), quoteattr(pos)))
        out.append('<Definition>%s</Definition>' % escape(d))
        for x in ex:
            out.append('<Example>%s</Example>' % escape(x))
        for r, t in rel:
            out.append('<SynsetRelation relType=%s target=%s/>' % (quoteattr(r), quoteattr(t)))
        out.append('</Synset>')
    out += ['</Lexicon>', '</LexicalResource>']
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))


def S(gloss, ex=(), tags=(), syn=(), ant=(), **kw):
    s = {'glosses': [gloss]}
    if ex:
        s['examples'] = [{'text': x} for x in ex]
    if tags:
        s['tags'] = list(tags)
    if syn:
        s['synonyms'] = [{'word': w} for w in syn]
    if ant:
        s['antonyms'] = [{'word': w} for w in ant]
    s.update(kw)
    return s


def E(word, pos, senses, ipa=None, ety=None, forms=(), cats=()):
    e = {'word': word, 'pos': pos, 'lang': 'English', 'lang_code': 'en', 'senses': senses}
    if ipa:
        e['sounds'] = [{'ipa': v, 'tags': t} for v, t in ipa]
    if ety:
        e['etymology_text'] = ety
    if forms:
        e['forms'] = [{'form': f, 'tags': t} for f, t in forms]
    if cats:
        e['categories'] = [{'name': c} for c in cats]
    return e


def ALT(word, pos, target, tags):
    return E(word, pos, [S('Alternative spelling of ' + target, tags=['alt-of', 'alternative'] + list(tags),
                           alt_of=[{'word': target}])])


def write_kaikki(path):
    I, P, PH, SM, AB = 'English idioms', 'English proverbs', 'English phrasal verbs', 'English similes', 'English initialisms'
    rows = [
        E('color', 'noun', [
            S('A visual perception of light wavelengths; hue.', ['What color is the sky?'], syn=['hue', 'shade', 'tint']),
            S('A pigment or dye used to give colour to something.', ['She mixed a bright color for the walls.']),
            S('Skin pigmentation, especially in relation to ethnicity.', tags=['dated'])],
            ipa=[('/ˈkʌl.ɚ/', ['US', 'General-American']), ('/ˈkʌl.ə/', ['UK', 'Received-Pronunciation'])],
            ety='From Middle English colour, from Old French color, from Latin color.',
            forms=[('colors', ['plural'])]),
        E('color', 'verb', [S('To give color to something.', ['The kids colored the pictures.']),
                            S('To influence or distort.', ['His anger colored his judgment.'])],
          forms=[('colors', ['present', 'singular', 'third-person']), ('coloring', ['participle', 'present']),
                 ('colored', ['past']), ('colored', ['participle', 'past'])]),
        ALT('colour', 'noun', 'color', ['Canada', 'UK', 'Commonwealth']),
        ALT('centre', 'noun', 'center', ['Canada', 'UK', 'Commonwealth']),
        ALT('cheque', 'noun', 'check', ['Canada', 'UK', 'Commonwealth']),
        ALT('tyre', 'noun', 'tire', ['UK', 'Commonwealth']),
        ALT('kerb', 'noun', 'curb', ['UK']),
        ALT('pyjamas', 'noun', 'pajamas', ['UK', 'Canada']),
        E('check', 'noun', [S('A written order to a bank to pay money from an account.', ['She wrote a check for the rent.'], ['US']),
                            S('A mark made to show that something is correct or done.', ['Put a check next to each item.'])],
          ipa=[('/tʃɛk/', [])], forms=[('checks', ['plural'])]),
        E('tire', 'verb', [S('To become weary or to cause weariness.', ['The long hike tired them out.'])],
          ipa=[('/ˈtaɪ̯ɚ/', ['US'])],
          forms=[('tires', ['present', 'singular', 'third-person']), ('tiring', ['participle', 'present']), ('tired', ['past']), ('tired', ['participle', 'past'])]),
        E('curb', 'noun', [S('A raised edge along a street, forming the boundary of the road.', ['Park next to the curb.'], ['US']),
                           S('Something that restrains or controls.', ['a curb on spending'])], forms=[('curbs', ['plural'])]),
        E('pajamas', 'noun', [S('A loose two-piece garment worn for sleeping.', ['He sleeps in flannel pajamas.'])],
          ipa=[('/pəˈdʒɑː.məz/', ['US'])]),
        E('loonie', 'noun', [S('A Canadian one-dollar coin, bearing an image of a loon.', ['I need a loonie for the cart.'], ['Canada', 'informal'])],
          ety='From loon, the bird depicted on the coin.', forms=[('loonies', ['plural'])]),
        E('toque', 'noun', [S('A warm knitted winter hat.', ['Wear your toque, it is cold out.'], ['Canada'])],
          ipa=[('/tuːk/', ['Canada'])], forms=[('toques', ['plural'])]),
        E('eh', 'intj', [S('Used to invite agreement or to ask someone to repeat something.', ['Nice day, eh?'], ['Canada', 'informal'])],
          ipa=[('/eɪ/', ['Canada'])]),
        E('run', 'verb', [S('To move swiftly on foot.', ['She runs every morning.'], syn=['sprint', 'jog', 'dash'], ant=['walk']),
                          S('To operate or function.', ['The engine is running.']),
                          S('To manage or be in charge of.', ['He runs a small business.'], syn=['manage', 'operate']),
                          S('To flow.', ['Water ran down the wall.'])],
          ipa=[('/ɹʌn/', ['US', 'UK'])], ety='From Middle English rennen, from Old English rinnan.',
          forms=[('runs', ['present', 'singular', 'third-person']), ('running', ['participle', 'present']), ('ran', ['past']), ('run', ['participle', 'past'])]),
        E('run', 'noun', [S('An act of running.', ['I went for a run.']), S('A continuous series or period.', ['a run of good luck'])], forms=[('runs', ['plural'])]),
        E('happy', 'adj', [S('Feeling pleasure or joy.', ['I am happy to help.'], syn=['glad', 'cheerful', 'joyful'], ant=['sad', 'unhappy']),
                           S('Fortunate or lucky.', ['a happy coincidence'])],
          ipa=[('/ˈhæpi/', [])], forms=[('happier', ['comparative']), ('happiest', ['superlative'])]),
        E('dog', 'noun', [S('A domesticated canine kept as a pet or for work.', ['The dog wagged its tail.'], syn=['hound', 'pooch']),
                          S('A contemptible person.', tags=['derogatory'])],
          ipa=[('/dɔɡ/', ['US']), ('/dɒɡ/', ['UK'])], forms=[('dogs', ['plural'])]),
        E('travel', 'verb', [S('To move from one place to another.', ['They traveled across Canada by train.'], syn=['journey', 'tour'])],
          forms=[('travels', ['present', 'singular', 'third-person']), ('traveling', ['participle', 'present']), ('traveled', ['past']), ('traveled', ['participle', 'past'])]),
        E('organize', 'verb', [S('To arrange in an orderly way.', ['Organize your notes by date.'], syn=['arrange', 'sort'])],
          forms=[('organizes', ['present', 'singular', 'third-person']), ('organizing', ['participle', 'present']), ('organized', ['past']), ('organized', ['participle', 'past'])]),
        E('go', 'verb', [S('To move or travel.', ['Where did you go?']), S('To become.', ['The milk went sour.'])],
          forms=[('goes', ['present', 'singular', 'third-person']), ('going', ['participle', 'present']), ('went', ['past']), ('gone', ['participle', 'past'])]),
        # idioms
        E('break the ice', 'verb', [S('To start a conversation in a social setting and ease tension.', ['He told a joke to break the ice.'])],
          ety='Said to come from ships breaking ice to open a passage.', cats=[I]),
        E('piece of cake', 'noun', [S('Something very easy to do.', ['The exam was a piece of cake.'])], cats=[I]),
        E('kick the bucket', 'verb', [S('To die.', ['The old tractor finally kicked the bucket.'], ['informal'])], cats=[I]),
        E('under the weather', 'adj', [S('Feeling slightly ill.', ['I am a bit under the weather today.'])], cats=[I]),
        E('hit the nail on the head', 'verb', [S('To describe exactly what is causing a situation or problem.', ['You hit the nail on the head.'])], cats=[I]),
        E('once in a blue moon', 'adv', [S('Very rarely.', ['We only go out once in a blue moon.'])], cats=[I]),
        E('spill the beans', 'verb', [S('To reveal a secret.', ['Who spilled the beans about the party?'])], cats=[I]),
        E('let the cat out of the bag', 'verb', [S('To reveal a secret by accident.', ['He let the cat out of the bag.'])], cats=[I]),
        E('bite the bullet', 'verb', [S('To face something unpleasant with courage.', ['I had to bite the bullet and apologize.'])], cats=[I]),
        E('cost an arm and a leg', 'verb', [S('To be very expensive.', ['A good camera can cost an arm and a leg.'])], cats=[I]),
        E('give it a rip', 'verb', [S('To try something with energy, especially in a cheerful way.', ['Give it a rip, you can do it.'], ['Canada', 'informal'])], cats=[I]),
        E('knock on wood', 'intj', [S('Said to avoid bad luck after speaking of good fortune.', ['No problems so far, knock on wood.'], ['US', 'Canada'])], cats=[I]),
        E('have a bash', 'verb', [S('To try something.', ['Have a bash at the crossword.'], ['UK', 'informal'])], cats=[I]),
        # phrasal verbs
        E('give up', 'verb', [S('To stop trying; to surrender.', ['Never give up.'])], cats=[PH]),
        E('look up', 'verb', [S('To search for information in a reference source.', ['Look up the word in a dictionary.']), S('To improve.', ['Things are looking up.'])], cats=[PH]),
        E('turn on', 'verb', [S('To start a device or light.', ['Turn on the lamp.'])], cats=[PH]),
        E('put off', 'verb', [S('To postpone.', ['They put off the meeting until Friday.'])], cats=[PH]),
        E('get along', 'verb', [S('To have a friendly relationship.', ['The two sisters get along well.'])], cats=[PH]),
        E('run out', 'verb', [S('To use up a supply.', ['We ran out of milk.'])], cats=[PH]),
        E('break down', 'verb', [S('To stop working.', ['The car broke down on the highway.']), S('To lose control of emotions.', ['She broke down in tears.'])], cats=[PH]),
        E('look after', 'verb', [S('To take care of.', ['Can you look after my cat this weekend?'])], cats=[PH]),
        # proverbs
        E('a stitch in time saves nine', 'proverb', [S('Fixing a small problem early prevents a bigger one later.')], cats=[P]),
        E('actions speak louder than words', 'proverb', [S('What people do is more important than what they say.')], cats=[P]),
        E('the early bird catches the worm', 'proverb', [S('Those who start early have the best chance of success.')], cats=[P]),
        E('better late than never', 'proverb', [S('It is better to arrive or do something late than not at all.')], cats=[P]),
        E('many hands make light work', 'proverb', [S('A job is easier when many people help.')], cats=[P]),
        E('when in Rome, do as the Romans do', 'proverb', [S('Follow the customs of the place you are visiting.')], cats=[P]),
        # similes
        E('as busy as a bee', 'adj', [S('Very busy and hard-working.', ['She has been as busy as a bee all week.'])], cats=[SM]),
        E('as good as gold', 'adj', [S('Very well behaved.', ['The kids were as good as gold.'])], cats=[SM]),
        E('as cold as ice', 'adj', [S('Extremely cold, or unfeeling.')], cats=[SM]),
        # abbreviations
        E('ASAP', 'abbrev', [S('As soon as possible.', ['Reply ASAP, please.'])], cats=[AB]),
        E('FYI', 'abbrev', [S('For your information.')], cats=[AB]),
        E('RSVP', 'abbrev', [S('Please reply (from French répondez s’il vous plaît).', ['RSVP by Friday.'])], cats=[AB]),
        E('e.g.', 'abbrev', [S('For example (from Latin exempli gratia).', ['Bring snacks, e.g. fruit or nuts.'])], cats=[AB]),
        E('i.e.', 'abbrev', [S('That is; in other words (from Latin id est).')], cats=[AB]),
        # slang and phrases
        E('cringe', 'adj', [S('Causing awkward embarrassment.', ['That video is so cringe.'], ['slang'])]),
        E('good morning', 'phrase', [S('A greeting used in the morning.')]),
        E('by the way', 'phrase', [S('Used to introduce an extra remark.', ['By the way, the store closes at six.'])]),
        E('how do you do', 'phrase', [S('A formal greeting used when meeting someone.')]),
    ]
    with open(path, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    write_oewn(os.path.join(OUT, 'oewn-sample.xml'))
    write_kaikki(os.path.join(OUT, 'kaikki-sample.jsonl'))
    print('sample sources written to', OUT)


if __name__ == '__main__':
    main()
