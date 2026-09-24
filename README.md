# Ollama Models

**Live site: [swhoyle.github.io/ollama-models](https://swhoyle.github.io/ollama-models/)**

A fast, searchable catalog of every model in the [Ollama library](https://ollama.com/library) — built to make finding the right model and tag actually easy.

## Why this exists

Ollama's library is hard to search and compare models, especially for different sizes and capabilities. This project pulls that data into a simple interface so you can browse, filter, and sort the whole catalog in seconds.

Typical uses:

- Find models that fit your hardware or task
- View and compare different model tags
- See what's popular and what changed recently

## How it works

The project has two parts:

1. **Python scraper** — collects the public Ollama library index and each model family's tags, then saves a clean JSON snapshot. It validates the data before replacing the snapshot, so a bad run never breaks the site.
2. **React UI** — a table frontend that loads that JSON and runs entirely in the browser. No backend, database, or API key; it's a static site you can host anywhere.

**Stack:** React 19 + Vite for the UI, Python (Beautiful Soup) for scraping, hosted free on GitHub Pages.

## Using the table

- Switch between **Models** (families) and **Tags** (every variant)
- Search by name, tag, capability, or description — multiple words all have to match
- Filter by model family, capability, parameter count, file size, and context window (multi-select)
- Click column headers to sort (file size and context sort numerically)
- Paginate with Previous / Next; the bar shows which results you're viewing
- Model names link to Ollama's pages; clicking a tag count jumps to that family's tags
- **About this data** explains where the numbers come from and their limits

## A few caveats

- Pull counts are approximate (the source abbreviates them, e.g. "1.2M")
- File sizes are download sizes, not RAM/VRAM requirements
- Tags can be aliases of the same weights, so tag count ≠ unique models
- Data is a snapshot — **Last checked** on the site shows when it was collected
- This is an independent project, not affiliated with Ollama
