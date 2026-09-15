#!/usr/bin/env python3
"""Houdt README.md in sync met CHANGELOG.md.

De community-plugins-pagina in Obsidian toont de README van de repo — release
notes en CHANGELOG.md verschijnen daar nooit. Dit script vult daarom drie
blokken in README.md:

  "New in x.y.z" / "Nieuw in x.y.z" — de banners bovenaan beide taalhelften,
                          met de kop en bullets van de nieuwste changelog-sectie;
  "# Changelog / Wijzigingen" — de volledige changelog onderaan de README.

De blokken worden afgebakend door de koppen zelf, niet door HTML-markers: de
plugin-scanner van Obsidian rekent commentaar in de README aan als oningevulde
template-tekst. Een banner loopt van zijn eigen kop tot de eerstvolgende
"## "-kop; de changelog loopt van zijn eerste "## "-kop tot het einde van het
bestand.

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


def splice_banner(text, heading, content):
    """Vervang een banner: van zijn kop tot de eerstvolgende "## "-kop."""
    pattern = re.compile(r'^### ' + heading + r' [^\n]*\n.*?(?=^## )', re.M | re.S)
    if not pattern.search(text):
        raise SystemExit(f'Banner "### {heading} ..." niet gevonden in README.md')
    return pattern.sub(lambda _: content.rstrip('\n') + '\n\n', text)


def splice_changelog(text, content):
    """Vervang alles vanaf de eerste "## "-kop onder de changelog-titel tot EOF."""
    title = re.search(r'^# Changelog / Wijzigingen\s*$', text, re.M)
    if not title:
        raise SystemExit('Kop "# Changelog / Wijzigingen" niet gevonden in README.md')
    first = re.search(r'^## ', text[title.end():], re.M)
    if not first:
        raise SystemExit('Geen "## x.y.z"-sectie onder "# Changelog / Wijzigingen"')
    return text[:title.end() + first.start()] + content.rstrip('\n') + '\n'


readme = splice_banner(readme, 'New in', f'### New in {version}\n\n{en}')
readme = splice_banner(readme, 'Nieuw in', f'### Nieuw in {version}\n\n{nl}')
readme = splice_changelog(readme, body)
readme_path.write_text(readme, encoding='utf-8')
print(f'README.md bijgewerkt vanuit CHANGELOG.md (nieuwste versie: {version})')
