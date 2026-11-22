#!/usr/bin/env python3
"""Generate src/data/locations.ts from the owner's locations.db (work package locations-select, #12).

    python3 scripts/import-locations.py /path/to/locations.db            # write src/data/locations.ts
    python3 scripts/import-locations.py /path/to/locations.db --check    # fail if the file is not up to date
    python3 scripts/import-locations.py /path/to/locations.db --report   # markdown list of the multi-zone rows

Dev tool only: Python standard library, never part of the Worker build. The .db is opened READ-ONLY and is
not committed. Each row gets its IANA zone from src/data/location-timezones.ts; a row without a zone is an
error (exit 1), never a guess.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TZ_FILE = ROOT / "src" / "data" / "location-timezones.ts"
OUT_FILE = ROOT / "src" / "data" / "locations.ts"

LINE = re.compile(r'^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$')


def read_table(source: str, name: str) -> dict:
    """The `export const <name> ... = { ... };` block of location-timezones.ts, one JSON string pair per line."""
    lines = source.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith(f"export const {name}")), None)
    if start is None:
        sys.exit(f"error: {TZ_FILE} has no table {name}")
    table = {}
    for l in lines[start + 1:]:
        if l == "};":
            return table
        m = LINE.match(l)
        if not m:
            sys.exit(f"error: {TZ_FILE}: line is not '  \"key\": \"value\",' in {name}: {l!r}")
        key, value = json.loads(m.group(1)), json.loads(m.group(2))
        if key in table:
            sys.exit(f"error: duplicate key {key!r} in {name}")
        table[key] = value
    sys.exit(f"error: {TZ_FILE}: table {name} is not closed with '}};'")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("db", help="path to locations.db (opened read-only)")
    ap.add_argument("--out", default=str(OUT_FILE), help="output file (default src/data/locations.ts)")
    ap.add_argument("--date", default=date.today().isoformat(), help="date for the header (default today)")
    ap.add_argument("--check", action="store_true", help="do not write; exit 1 if the output file differs")
    ap.add_argument("--report", action="store_true", help="print the multi-zone rows as a markdown table and exit")
    args = ap.parse_args()

    db_path = Path(args.db).resolve()
    sha256 = hashlib.sha256(db_path.read_bytes()).hexdigest()
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = con.execute("SELECT id, country, state, latitude, longitude FROM locations ORDER BY id").fetchall()
    con.close()

    tz_source = TZ_FILE.read_text(encoding="utf-8")
    country_tz = read_table(tz_source, "COUNTRY_TIMEZONES")
    row_tz = read_table(tz_source, "ROW_TIMEZONES")
    notes = read_table(tz_source, "ROW_TIMEZONE_NOTES")

    both = sorted(set(country_tz) & {k.split("|", 1)[0] for k in row_tz})
    if both:
        sys.exit(f"error: countries in both COUNTRY_TIMEZONES and ROW_TIMEZONES: {both}")

    entries, missing = [], []
    for id_, country, place, lat, lon in rows:
        key = f"{country}|{place or ''}"
        if key in row_tz:
            zone, multi = row_tz[key], True
        elif country in country_tz:
            zone, multi = country_tz[country], False
        else:
            missing.append(key)
            continue
        entries.append((id_, country, place, lat, lon, zone, multi, key))
    if missing:
        sys.exit("error: no time zone for %d row(s):\n  %s" % (len(missing), "\n  ".join(missing)))

    # Entries in the zone table that match no row are a typo.
    keys = {e[7] for e in entries}
    stray = sorted((set(row_tz) | set(notes)) - keys)
    if stray:
        sys.exit(f"error: zone table entries for rows that do not exist: {stray}")

    if args.report:
        print("| id | country | place | latitude | longitude | zone | check |")
        print("|---|---|---|---|---|---|---|")
        for id_, country, place, lat, lon, zone, multi, key in entries:
            if multi:
                note = notes.get(key, "")
                print(f"| {id_} | {country} | {place or '(country)'} | {lat} | {lon} | {zone} | {'**CHECK** ' + note if note else ''} |")
        return

    gen_date = args.date
    if args.check and Path(args.out).exists():
        # A check compares everything except the date, so it does not go stale when the day changes.
        m = re.search(r"^ \* Date:    (\S+)$", Path(args.out).read_text(encoding="utf-8"), re.M)
        if m:
            gen_date = m.group(1)

    lines = [
        "/**",
        " * GENERATED FILE. Do not edit by hand.",
        " *",
        " * Source:  the owner's locations.db (not committed), opened read-only by scripts/import-locations.py",
        f" * sha256:  {sha256}",
        f" * Rows:    {len(entries)} ({len({e[1] for e in entries})} countries)",
        f" * Date:    {gen_date}",
        " * Zones:   src/data/location-timezones.ts (reviewed table, one IANA zone per row)",
        " *",
        " * Regenerate: python3 scripts/import-locations.py /path/to/locations.db",
        " *",
        " * `id` is the .db id and stays stable. `place` is null for the country-only row. Each row is ONE",
        " * point for a country, a state or a city, not a birthplace: the chart uses these coordinates as they are.",
        " */",
        "",
        "export interface LocationRecord {",
        "  readonly id: number;",
        "  readonly country: string;",
        "  readonly place: string | null;",
        "  readonly latitude: number;",
        "  readonly longitude: number;",
        "  /** IANA time zone id. */",
        "  readonly timezone: string;",
        "}",
        "",
        "export const LOCATIONS: readonly LocationRecord[] = [",
    ]
    for id_, country, place, lat, lon, zone, _multi, _key in entries:
        lines.append(
            "  { id: %d, country: %s, place: %s, latitude: %r, longitude: %r, timezone: %s },"
            % (id_, json.dumps(country, ensure_ascii=False), json.dumps(place, ensure_ascii=False), lat, lon, json.dumps(zone))
        )
    lines += ["];", ""]
    text = "\n".join(lines)

    out = Path(args.out)
    if args.check:
        if not out.exists() or out.read_text(encoding="utf-8") != text:
            sys.exit(f"{out} is not up to date; run without --check")
        print(f"{out} is up to date ({len(entries)} rows)")
        return
    out.write_text(text, encoding="utf-8")
    multi_rows = sum(1 for e in entries if e[6])
    print(f"wrote {out}: {len(entries)} rows, {len({e[1] for e in entries})} countries, {multi_rows} rows in multi-zone countries")


if __name__ == "__main__":
    main()
