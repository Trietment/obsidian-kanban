#!/usr/bin/env python3
"""Houdt README.md in sync met CHANGELOG.md.

De community-plugins-pagina in Obsidian toont de README van de repo — release
notes en CHANGELOG.md verschijnen daar nooit. Dit script vult daarom drie
marker-blokken in README.md:

  LATEST-EN / LATEST-NL — de "New in x.y.z"-banners bovenaan beide taalhelften,
                          met de kop en bullets van de nieuwste changelog-sectie;
  CHANGELOG             — de volledige changelog onderaan de README.

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


def splice(text, tag, content):
    pattern = re.compile(
        r'(<!-- ' + tag + r':BEGIN[^>]*-->\n).*?(<!-- ' + tag + r':END -->)', re.S)
    if not pattern.search(text):
        raise SystemExit(f'Marker {tag} niet gevonden in README.md')
    return pattern.sub(lambda mm: mm.group(1) + content.rstrip('\n') + '\n' + mm.group(2), text)


readme = splice(readme, 'LATEST-EN', f'### New in {version}\n\n{en}')
readme = splice(readme, 'LATEST-NL', f'### Nieuw in {version}\n\n{nl}')
readme = splice(readme, 'CHANGELOG', body)
readme_path.write_text(readme, encoding='utf-8')
print(f'README.md bijgewerkt vanuit CHANGELOG.md (nieuwste versie: {version})')
