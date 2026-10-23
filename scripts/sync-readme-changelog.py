#!/usr/bin/env python3
"""Houdt README.md in sync met CHANGELOG.md.

De community-plugins-pagina in Obsidian toont de README van de repo — release
notes en CHANGELOG.md verschijnen daar nooit. Dit script vult daarom drie
blokken in README.md, elk herkend aan zijn eigen kop:

  "### New in x.y.z" / "### Nieuw in x.y.z" — de banners bovenaan beide
      taalhelften, met de kop en bullets van de nieuwste changelog-sectie;
      een banner loopt tot vlak vóór de volgende "## "-kop;
  "# Changelog / Wijzigingen" — alles na de intro-regel daaronder is de
      volledige changelog, tot het einde van het bestand.

Bewust zonder HTML-commentaar als markers: de geautomatiseerde review van
community.obsidian.md kan zulke commentaren aanzien voor achtergebleven
sjabloontekst in de README.

Draaien na elke wijziging aan CHANGELOG.md (zie RELEASING.md).
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
changelog = (root / 'CHANGELOG.md').read_text(encoding='utf-8')
readme_path = root / 'README.md'
readme = readme_path.read_text(encoding='utf-8')

# Alles na de "# Changelog"-titel.
body = changelog.split('\n', 1)[1] if changelog.startswith('# ') else changelog
body = body.strip('\n')

# Nieuwste sectie: eerste "## x.y.z" tot de volgende "## ".
m = re.search(r'^## (.+?)$(.*?)(?=^## |\Z)', body, re.M | re.S)
if not m:
    raise SystemExit('Geen "## x.y.z"-sectie gevonden in CHANGELOG.md')
version = m.group(1).strip()
section = m.group(2)

# Engels = tot de "---"-scheiding; Nederlands = alles na "### Nederlands".
# Ontbreekt de Nederlandse subkop, dan valt de banner terug op de hele sectie.
en = re.split(r'^---\s*$', section, maxsplit=1, flags=re.M)[0].strip('\n')
nl_match = re.search(r'^### Nederlands\s*$(.*)', section, re.M | re.S)
nl = (nl_match.group(1) if nl_match else section).strip('\n')


def splice(text, pattern, content, what):
    # Precies één treffer, anders stoppen: liever een duidelijke fout dan een
    # banner die op de verkeerde plek belandt.
    found = list(re.finditer(pattern, text, re.M | re.S))
    if len(found) != 1:
        raise SystemExit(f'{what}: {len(found)}x gevonden in README.md, verwacht precies 1')
    return text[:found[0].start()] + content + text[found[0].end():]


readme = splice(readme, r'^### New in .*?(?=^## )',
                f'### New in {version}\n\n{en}\n\n', 'Banner "### New in"')
readme = splice(readme, r'^### Nieuw in .*?(?=^## )',
                f'### Nieuw in {version}\n\n{nl}\n\n', 'Banner "### Nieuw in"')
# De changelog: alles na de intro-regel onder de kop, tot het einde.
intro = re.search(r'^# Changelog / Wijzigingen\n\n[^\n]*\n\n', readme, re.M)
if not intro:
    raise SystemExit('Kop "# Changelog / Wijzigingen" met intro-regel niet gevonden in README.md')
readme = readme[:intro.end()] + body + '\n'
readme_path.write_text(readme, encoding='utf-8')
print(f'README.md bijgewerkt vanuit CHANGELOG.md (nieuwste versie: {version})')
