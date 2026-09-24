import json
from pathlib import Path
import tempfile
import unittest

from scripts.scrape import parse_count, parse_library, parse_tags, save_snapshot


CARD = '''<div id="repo"><li><a href="/library/example"><h2>example</h2>
<p>A model &amp; description.</p><span class="rounded-md">tools</span>
<span class="rounded-md">7b</span><p>
<span><span>1.2M</span><span> Pulls</span></span>
<span><span>1</span><span> Tag</span></span>
<span title="Mar 18, 2026 6:05 PM UTC"><span>Updated</span></span>
</p></a></li></div>'''


class ScraperTests(unittest.TestCase):
    def test_variants_and_duplicate_links(self):
        html = '''<p>1 model</p><a href="/library/example:7b">
        example:7b <span class="font-mono">abc123</span> • 4.9GB • 128K context window • Text input • yesterday
        </a><a href="/library/example:7b">example:7b</a>'''
        variants = parse_tags(html, {'name': 'example'})
        self.assertEqual(len(variants), 1)
        self.assertEqual(variants[0]['pullCommand'], 'ollama pull example:7b')
        self.assertEqual(variants[0]['contextLabel'], '128K')
        self.assertEqual(variants[0]['sizeLabel'], '4.9GB')
        with self.assertRaises(ValueError):
            parse_tags(html.replace('1 model', '2 models'), {'name': 'example'})

    def test_counts(self):
        for text, expected in [("119.8M", 119800000), ("2.5K", 2500), ("1,234", 1234)]:
            self.assertEqual(parse_count(text), expected)
        with self.assertRaises(ValueError):
            parse_count("unknown")

    def test_card_and_singular_tag(self):
        model = parse_library(CARD)[0]
        self.assertEqual(model["tags"], 1)
        self.assertEqual(model["pulls"], 1200000)
        self.assertEqual(model["sizes"], ["7b"])
        self.assertEqual(model["capabilities"], ["tools"])
        self.assertEqual(model["description"], "A model & description.")
        self.assertEqual(model["updatedAt"], "2026-03-18T18:05:00Z")
        self.assertEqual(parse_library(CARD.replace(" Tag<", " Tags<"))[0]["tags"], 1)

    def test_rejects_invalid_pages(self):
        for html in ["Blocked", CARD.replace("Pulls", "Other"), CARD + CARD, CARD + '<a rel="next" href="?page=2">Next</a>']:
            with self.subTest(html=html), self.assertRaises(ValueError):
                parse_library(html)

    def test_write_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "data/models.json"
            save_snapshot(parse_library(CARD), output)
            snapshot = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(snapshot["count"], 1)
            self.assertEqual(snapshot["models"][0]["name"], "example")


if __name__ == "__main__":
    unittest.main()
