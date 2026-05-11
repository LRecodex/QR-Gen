# QR Generator

Create modern, professional QR images with:
- Custom canvas size (square, story, or custom)
- Logo in the center
- Promo headline and subtext
- Live preview before download

## Requirements

- Node.js 18+ (recommended)
- npm

## Install

```bash
npm install
```

## Run

```bash
node server.js
```

Open in browser:

```text
http://localhost:3000
```

## How To Use

1. Enter a URL (required).
2. (Optional) Upload a center logo.
3. (Optional) Add promo text:
   - `Promo Headline` (example: `LIMITED TIME OFFER`)
   - `Promo Subtext` (example: `DM us now to book your slot`)
4. Choose canvas size:
   - `Square 1080 x 1080`
   - `Instagram Story 1080 x 1920`
   - `Custom Size`
5. Adjust `QR Size`, `QR Color`, and `Background`.
6. Click **Preview QR Code**.
7. If satisfied, click **Download PNG**.

## Output Style

The generator applies a modern layout by default:
- Centered QR panel with soft depth
- Optional center logo with clean ring treatment
- Promotional caption area below the QR
- PNG export optimized for quality

## API Endpoint

`POST /generate` (multipart form-data)

Fields:
- `url` (required)
- `logo` (optional file)
- `text` (optional headline)
- `subtext` (optional subtitle)
- `width` (optional number)
- `height` (optional number)
- `qrSize` (optional number)
- `qrColor` (optional hex, e.g. `#111827`)
- `bgColor` (optional hex, e.g. `#ffffff`)

Response:
- `image/png` file stream

## Troubleshooting

### 1) Preview or style changes not showing

Restart server and hard refresh browser:

```bash
# stop server with Ctrl+C, then run again
node server.js
```

Hard refresh page:
- Windows/Linux: `Ctrl+Shift+R`

### 2) Sharp blur error

If you see:

`Expected number between 0.3 and 1000 for sigma`

Use blur values `>= 0.3` in `sharp.blur(...)`.

### 3) Upload folder

Temporary uploads are stored in `uploads/` and ignored by git.

## Project Structure

```text
qr-generator/
  public/
    index.html
  uploads/
  server.js
  package.json
```

## Notes

- This project currently has no npm start script. Use `node server.js`.
- CORS is enabled in the server.
