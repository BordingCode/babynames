#!/usr/bin/env python3
"""
Convert approved Danish girl names + popularity data into names.js
Data sources:
  - familieretshuset_girl_names.json (approved names)
  - familieretshuset_unisex_names.json (approved unisex names)
  - popularity.json (DST popularity, if available)
"""

import json
import re
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
JS_DIR = os.path.join(os.path.dirname(DATA_DIR), 'js')

def estimate_syllables(name):
    """Estimate syllable count for a name (works for most European names)."""
    name = name.lower()
    # Count vowel groups
    vowels = 'aeiouyæøå'
    count = 0
    prev_vowel = False
    for ch in name:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    # Silent e at end doesn't count (for some names)
    if name.endswith('e') and count > 1 and len(name) > 3:
        # Only reduce if the e is truly silent (heuristic)
        if len(name) > 4 and name[-2] not in vowels:
            count -= 1
    return max(1, count)

def get_ending(name):
    """Classify the ending pattern of a name."""
    lower = name.lower()
    # Check common endings from longest to shortest
    endings = [
        'ette', 'ine', 'ina', 'ina', 'elle', 'anna',
        'ie', 'ia', 'ea', 'ee', 'ey',
        'a', 'e', 'i', 'o', 'y'
    ]
    for end in endings:
        if lower.endswith(end):
            return end
    return lower[-1] if lower else ''

def load_names():
    """Load and merge girl + unisex names."""
    names = set()

    # Girl names
    with open(os.path.join(DATA_DIR, 'familieretshuset_girl_names.json')) as f:
        data = json.load(f)
        items = data.get('items', data) if isinstance(data, dict) else data
        for item in items:
            if isinstance(item, dict):
                names.add(item['name'])
            else:
                names.add(str(item))

    # Unisex names
    with open(os.path.join(DATA_DIR, 'familieretshuset_unisex_names.json')) as f:
        data = json.load(f)
        items = data.get('items', data) if isinstance(data, dict) else data
        for item in items:
            if isinstance(item, dict):
                names.add(item['name'])
            else:
                names.add(str(item))

    return sorted(names, key=lambda n: n.lower())

def load_popularity():
    """Load popularity data if available."""
    pop_file = os.path.join(DATA_DIR, 'popularity.json')
    if os.path.exists(pop_file):
        with open(pop_file) as f:
            return json.load(f)
    return {}

def main():
    names = load_names()
    popularity = load_popularity()
    print(f"Loaded {len(names)} names, {len(popularity)} with popularity data")

    # Build the data array
    entries = []
    for i, name in enumerate(names):
        pop = popularity.get(name, 0)
        entry = {
            'id': i,
            'name': name,
            'pop': pop,
            'len': len(name),
            'syl': estimate_syllables(name),
            'end': get_ending(name),
            'origin': None,
            'meaning': None
        }
        entries.append(entry)

    # Write names.js
    os.makedirs(JS_DIR, exist_ok=True)
    js_path = os.path.join(JS_DIR, 'names.js')

    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated from Familieretshuset approved Danish girl names\n')
        f.write(f'// Total: {len(entries)} names\n')
        f.write('const NAMES = ')
        json.dump(entries, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    file_size = os.path.getsize(js_path)
    print(f"Written {js_path} ({file_size / 1024:.1f} KB, {len(entries)} names)")

    # Print some stats
    pop_count = sum(1 for e in entries if e['pop'] > 0)
    print(f"Names with popularity data: {pop_count}")
    print(f"Sample entries:")
    for name in ['Anna', 'Emma', 'Freja', 'Ida', 'Sofia']:
        matches = [e for e in entries if e['name'] == name]
        if matches:
            print(f"  {matches[0]}")

if __name__ == '__main__':
    main()
