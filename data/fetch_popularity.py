#!/usr/bin/env python3
"""
Fetch popularity data from Danmarks Statistik for all approved girl names.
Uses the 'Hvor mange hedder' AJAX endpoint.
Saves results incrementally to popularity.json.
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
POP_FILE = os.path.join(DATA_DIR, 'popularity.json')
NAMES_FILE = os.path.join(DATA_DIR, 'all_approved_girl_names.txt')

URL = 'https://www.dst.dk/da/Statistik/emner/borgere/navne/HvorMange'

def load_existing():
    if os.path.exists(POP_FILE):
        with open(POP_FILE) as f:
            return json.load(f)
    return {}

def save_progress(data):
    with open(POP_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=None)

def fetch_count(name):
    """Fetch how many women in Denmark have this first name."""
    try:
        params = urllib.parse.urlencode({'firstName': name, 'lastName': ''})
        url = 'https://www.dst.dk/da/DstDk-Global/Udvikler/HostHvorMangeHedder?ajax=1'
        req = urllib.request.Request(
            url,
            data=params.encode('utf-8'),
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (compatible; BabyNames/1.0)',
                'X-Requested-With': 'XMLHttpRequest'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8')
            # Response is HTML table with rows like:
            # <td>Kvinder med fornavnet 'EMMA'</td><td class="text-right">22590</td>
            m = re.search(r"Kvinder med fornavnet[^<]*</td>\s*<td[^>]*>(\d+)", html)
            if m:
                return int(m.group(1))
            return 0
    except Exception as e:
        print(f"  Error fetching {name}: {e}")
        return -1  # -1 means error, will retry

def main():
    # Load names
    with open(NAMES_FILE) as f:
        all_names = [line.strip() for line in f if line.strip()]

    # Load existing progress
    popularity = load_existing()
    done = set(popularity.keys())
    remaining = [n for n in all_names if n not in done]

    print(f"Total names: {len(all_names)}")
    print(f"Already fetched: {len(done)}")
    print(f"Remaining: {len(remaining)}")

    batch_size = 50
    delay = 0.3  # seconds between requests

    for i, name in enumerate(remaining):
        count = fetch_count(name)
        if count >= 0:
            popularity[name] = count
            if count > 0:
                print(f"  [{len(done)+i+1}/{len(all_names)}] {name}: {count}")
        else:
            print(f"  [{len(done)+i+1}/{len(all_names)}] {name}: ERROR (will retry later)")

        # Save every batch_size names
        if (i + 1) % batch_size == 0:
            save_progress(popularity)
            print(f"  Saved progress: {len(popularity)} names")

        time.sleep(delay)

    # Final save
    save_progress(popularity)
    print(f"\nDone! Total: {len(popularity)} names with popularity data")
    pop_names = {k: v for k, v in popularity.items() if v > 0}
    print(f"Names with count > 0: {len(pop_names)}")

if __name__ == '__main__':
    main()
