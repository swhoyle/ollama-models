"""Extract model families from Ollama's public library into a JSON snapshot.

Run: python scripts/scrape.py [--output path/to/models.json]
"""

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

SOURCE = "https://ollama.com/library"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "public/data/models.json"


def parse_count(value):
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*([KMB])?", value.replace(",", "").strip(), re.I)
    if not match:
        raise ValueError(f"Invalid count: {value!r}")
    multiplier = {"K": 1000, "M": 1000000, "B": 1000000000}.get((match[2] or "").upper(), 1)
    return int(Decimal(match[1]) * multiplier)


def parse_library(html):
    soup = BeautifulSoup(html, "html.parser")
    if soup.select('a[rel="next"], [hx-get*="page="], a[href*="page="]'):
        raise ValueError("Pagination detected; update the scraper before replacing the snapshot.")
    models = []
    for card in soup.select('#repo li a[href^="/library/"]'):
        heading = card.find("h2")
        name = heading.get_text(" ", strip=True) if heading else ""
        paragraphs = card.find_all("p")
        if not name or len(paragraphs) < 2:
            raise ValueError(f"Incomplete model card: {name or 'unknown'}")
        badges = [span.get_text(strip=True) for span in card.select("span.rounded-md")]
        sizes = [badge for badge in badges if re.search(r"\d", badge)]
        stats = paragraphs[-1].find_all("span", recursive=False)

        def stat(label):
            for span in stats:
                if re.search(rf"\b{label}s?\b", span.get_text(" ", strip=True), re.I):
                    value = span.find("span")
                    if value:
                        return value.get_text(strip=True)
            raise ValueError(f"Missing {label} for {name}")

        date_text = next((span.get("title") for span in stats if span.get("title")), None)
        if not date_text:
            raise ValueError(f"Missing update date for {name}")
        updated = datetime.strptime(date_text, "%b %d, %Y %I:%M %p UTC").replace(tzinfo=timezone.utc)
        pulls_label = stat("Pull")
        models.append({
            "name": name,
            "url": "https://ollama.com" + card["href"],
            "tagsUrl": "https://ollama.com" + card["href"] + "/tags",
            "description": paragraphs[0].get_text(" ", strip=True),
            "capabilities": [badge for badge in badges if badge not in sizes],
            "sizes": sizes,
            "pulls": parse_count(pulls_label),
            "pullsLabel": pulls_label,
            "tags": parse_count(stat("Tag")),
            "updatedAt": updated.isoformat().replace("+00:00", "Z"),
        })
    if not models:
        raise ValueError("No model cards found; the source markup may have changed.")
    if len({model["name"] for model in models}) != len(models):
        raise ValueError("Duplicate model names found.")
    return sorted(models, key=lambda model: model["name"])


def parse_tags(html, model):
    soup = BeautifulSoup(html, "html.parser")
    if soup.select('a[rel="next"], [hx-get*="page="], a[href*="page="]'):
        raise ValueError(f"Pagination detected for {model['name']}")
    variants = {}
    prefix = f"/library/{model['name']}:"
    for link in soup.select('a[href]'):
        href = link['href']
        if not href.startswith(prefix) or not link.select_one('.font-mono'):
            continue  # Ignore duplicate desktop links without metadata.
        text = link.get_text(' ', strip=True)
        digest = link.select_one('.font-mono').get_text(strip=True)
        details = text.split(digest, 1)[-1].split('•')
        details = [part.strip() for part in details if part.strip()]
        name = href.removeprefix('/library/')
        size = next((part for part in details if re.fullmatch(r'[\d.]+\s*[KMGT]?B', part, re.I)), None)
        context = next((part.removesuffix(' context window').strip() for part in details if 'context window' in part), None)
        inputs = next((part.removesuffix(' input').strip() for part in details if part.endswith(' input')), None)
        variants[name] = {
            'name': name, 'tag': name.split(':', 1)[1],
            'url': 'https://ollama.com' + href,
            'pullCommand': f'ollama pull {name}',
            'digest': digest, 'sizeLabel': size, 'contextLabel': context,
            'inputLabel': inputs,
            'sourceText': text,
        }
    if not variants:
        raise ValueError(f"No variants found for {model['name']}")
    count_label = soup.find(string=re.compile(r'^\s*[\d,]+ models?\s*$'))
    if count_label:
        expected = int(re.search(r'[\d,]+', count_label).group().replace(',', ''))
        if len(variants) != expected:
            raise ValueError(f"Expected {expected} variants for {model['name']}, found {len(variants)}")
    return list(variants.values())


def fetch_library(url=SOURCE):
    request = Request(url, headers={"User-Agent": "OllamaModelCatalog/1.0 (public library snapshot)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8")
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def save_snapshot(models, output):
    snapshot = {
        "schemaVersion": 2,
        "source": SOURCE,
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "count": len(models),
        "models": models,
    }
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            json.dump(snapshot, file, ensure_ascii=False, indent=2)
            file.write("\n")
        os.replace(temporary, output)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Destination JSON file")
    parser.add_argument("--index-only", action="store_true", help="Skip fetching per-family tags")
    parser.add_argument("--model", help="Extract only this family, e.g. llama3.1")
    args = parser.parse_args()
    try:
        models = parse_library(fetch_library())
        if args.model:
            models = [model for model in models if model['name'] == args.model]
            if not models:
                raise ValueError(f"Model not found: {args.model}")
        if not args.index_only:
            for index, model in enumerate(models, 1):
                print(f"[{index}/{len(models)}] {model['tagsUrl']}", flush=True)
                time.sleep(0.25)
                model['variants'] = parse_tags(fetch_library(model['tagsUrl']), model)
                model['variantCount'] = len(model['variants'])
        save_snapshot(models, args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Scrape failed: {error}\n")
    print(f"Saved {len(models)} model families to {args.output.resolve()}")


if __name__ == "__main__":
    main()
