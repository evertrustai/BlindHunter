---
name: api-key-hunter
description: "Google API key recon and exploitation pipeline. Step 1: Gemisc.py batch scans target URLs/JS files to discover exposed API keys. Step 2: keyhunt.py checks found keys against 21 Google API endpoints. Step 3: Gemisc.py verifies Gemini access + generates PoC evidence (text, Imagen 4, Veo 3, TTS)."
---

# api-key-hunter: Google API Key Discovery → Validation → Exploitation

## Authorized Use Only
Only scan targets you own or have explicit written permission to test.

---

## Tool Locations

| Tool | Path | Language |
|------|------|----------|
| `Gemini-api-key-hunter` (Gemisc.py) — DISCOVER + VERIFY | `/home/chinnuy93/Gemini-api-key-hunter/Gemisc.py` | Python 3 |
| `Google-api-key-scanner` (keyhunt.py) — CHECK 21 APIs | `/home/chinnuy93/Google-api-key-scanner/keyhunt.py` | Python 3 |

---

## Pipeline (4 Steps)

```
Target TLD
    ↓
[0] Subdomain Enumeration       ← collect all subdomains
    ↓ (subdomains.txt)
[1] Gemisc.py -f subdomains.txt ← batch scan all subdomains for exposed API keys
    ↓ (found keys)
[2] keyhunt.py -kf keys.txt --poc ← check keys against 21 Google API endpoints
    ↓ (vulnerable URLs with keys)
[3] Gemisc.py -l urls.txt --verify ← validates Gemini, tests capabilities, saves PoC
    ↓
Bug Bounty Report
```

## Step 0: Subdomain Enumeration

```bash
subfinder -d target.com -all -silent > /tmp/subdomains.txt
assetfinder --subs-only target.com >> /tmp/subdomains.txt
curl -s "https://crt.sh/?q=%25.target.com&output=json" | jq -r '.[].name_value' 2>/dev/null >> /tmp/subdomains.txt
sort -u /tmp/subdomains.txt -o /tmp/subdomains.txt
```

## Step 1: Batch Scan All Subdomains for API Keys (Gemisc.py)

```bash
# Batch scan all subdomains from file (-f flag)
python3 /home/chinnuy93/Gemini-api-key-hunter/Gemisc.py -f /tmp/subdomains.txt -o /tmp/scan_results.txt

# Optional: JS file scan mode (interactive menu option 3)
python3 /home/chinnuy93/Gemini-api-key-hunter/Gemisc.py
# → Option 3: JS File Scanner
```

Gemisc.py crawls each subdomain's HTML, extracts JS URLs, fetches JS files, and scans everything for `AIza...` patterns — multi-threaded (100 workers).

**Extract found keys:**
```bash
grep -oP 'AIza[0-9A-Za-z\-_]{35}' /tmp/scan_results.txt | sort -u > /tmp/api_keys.txt
```

## Step 2: Check Keys Against 21 Google APIs (keyhunt.py)

```bash
python3 /home/chinnuy93/Google-api-key-scanner/keyhunt.py \
  -kf /tmp/api_keys.txt \
  --poc \
  -o /tmp/vuln_urls.txt
```

Checks each key against: CustomSearchAPI, StaticMapAPI, StreetViewAPI, DirectionsAPI, GeocodeAPI, DistanceMatrixAPI, FindPlaceFromTextAPI, AutocompleteAPI, ElevationAPI, TimezoneAPI, NearestRoadsAPI, GeolocationAPI, RouteToTraveledAPI, SpeedLimitRoadsAPI, PlaceDetailsAPI, NearbySearchPlacesAPI, TextSearchPlacesAPI, PlacesPhotoAPI, FCMAPI, QueryAutocompleteAPI, **GenerativeLanguageAPI (Gemini)**.

## Step 3: Verify Gemini + Generate PoC (Gemisc.py)

```bash
# Verify keys against Gemini API (with Referer-spoofing bypass)
python3 /home/chinnuy93/Gemini-api-key-hunter/Gemisc.py \
  -l /tmp/vuln_urls.txt \
  --verify \
  -o /tmp/verified_keys.txt
```

For verified vulnerable keys, test capabilities:
```bash
python3 /home/chinnuy93/Gemini-api-key-hunter/Gemisc.py
# → Option 5: Capability Testing
# → Sub-option A: single key / B: keys from file
```

Capabilities: text generation (Gemini 2.0 Flash), image generation (Imagen 4 → PNG), text-to-speech (WAV), video generation (Veo 3 → MP4). Evidence saved to `gemini_evidence/{key_suffix}/` with a full `report.md`.

## Manual PoC

Open `/home/chinnuy93/Gemini-api-key-hunter/lostsec.html` in browser → paste key → demonstrate chat, image gen, file upload.

---

## Quick One-Liner

```bash
TARGET="target.com"; \
OUTDIR="/tmp/api_hunt"; mkdir -p "$OUTDIR"; \
python3 /home/chinnuy93/Gemini-api-key-hunter/Gemisc.py -t "$TARGET" -o "$OUTDIR/scan.txt" -q; \
grep -oP 'AIza[0-9A-Za-z\-_]{35}' "$OUTDIR/scan.txt" 2>/dev/null | sort -u > "$OUTDIR/keys.txt"; \
python3 /home/chinnuy93/Google-api-key-scanner/keyhunt.py -kf "$OUTDIR/keys.txt" --poc -o "$OUTDIR/vuln.txt" 2>/dev/null; \
echo "Done. Keys found: $(wc -l < "$OUTDIR/keys.txt")"
```

---

## Output Files

| File | Contents |
|------|----------|
| `scan_results.txt` | Scan output with keys per URL |
| `api_keys.txt` | Deduplicated API keys |
| `vuln_urls.txt` | Vulnerable endpoint URLs with keys |
| `verified_keys.txt` | Gemini-verified keys with status |
| `gemini_evidence/{key}/` | PoC evidence (images, audio, video, report.md) |

---

## Dependencies

```bash
pip install requests urllib3 colorama tqdm
sudo apt install -y ffmpeg 2>/dev/null
```

---

## Report Template

```
**Vulnerability:** Exposed Google API Key (Full Access)
**Key:** `AIza...` (truncated last 4 chars)
**Source:** Found in [URL to JS file / HTML source]
**APIs Accessible:**
- [list from keyhunt.py output]
**Gemini Capabilities (if applicable):**
- Text generation
- Image generation (Imagen 4)
- Text-to-Speech
- Video generation (Veo 3)
**Impact:** Cost injection / data access / service abuse
**PoC:** [curl commands, links to evidence files]
```
