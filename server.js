const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");
const sharp = require("sharp");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.post("/generate", upload.single("logo"), async (req, res) => {
  try {
    const {
      url,
      text = "",
      subtext = "",
      qrColor = "#000000",
      bgColor = "#ffffff",
      width = 1080,
      height = 1080,
      qrSize = 700,
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const canvasWidth = clampInt(width, 320, 4000, 1080);
    const canvasHeight = clampInt(height, 320, 4000, 1080);
    const safeQrColor = normalizeHexColor(qrColor, "#111827");
    const safeBgColor = normalizeHexColor(bgColor, "#ffffff");
    const maxQrSize = Math.min(canvasWidth, canvasHeight) - 120;
    const finalQrSize = clampInt(qrSize, 200, maxQrSize, Math.min(700, maxQrSize));

    if (safeQrColor.toLowerCase() === safeBgColor.toLowerCase()) {
      return res.status(400).json({ error: "QR color and background color must be different." });
    }

    const qrBuffer = await QRCode.toBuffer(url, {
      width: finalQrSize,
      margin: 3,
      color: {
        dark: safeQrColor,
        light: safeBgColor,
      },
      errorCorrectionLevel: "H",
    });

    let qrImage = sharp(qrBuffer).resize(finalQrSize, finalQrSize);

    if (req.file) {
      const logoSize = Math.round(finalQrSize * 0.2);

      const logoBuffer = await sharp(req.file.path)
        .resize(logoSize, logoSize, { fit: "contain" })
        .png()
        .toBuffer();

      const ringThickness = Math.max(8, Math.round(logoSize * 0.09));
      const ringSize = logoSize + ringThickness * 2;

      const circularMask = Buffer.from(`
        <svg width="${logoSize}" height="${logoSize}">
          <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" fill="#fff"/>
        </svg>
      `);

      const circularLogo = await sharp(logoBuffer)
        .composite([{ input: circularMask, blend: "dest-in" }])
        .png()
        .toBuffer();

      const logoBackground = await sharp({
        create: {
          width: ringSize,
          height: ringSize,
          channels: 4,
          background: "#ffffff",
        },
      })
        .png()
        .composite([
          {
            input: circularLogo,
            gravity: "center",
          },
        ])
        .blur(0.3)
        .toBuffer();

      qrImage = qrImage.composite([
        {
          input: logoBackground,
          gravity: "center",
        },
      ]);
    }

    const qrFinalBuffer = await qrImage.png().toBuffer();

    const cardPadding = Math.max(30, Math.round(finalQrSize * 0.06));
    const hasHeadline = Boolean(text && String(text).trim());
    const hasSubtext = Boolean(subtext && String(subtext).trim());
    const textReservedHeight = hasHeadline || hasSubtext ? 230 : 0;
    const panelWidth = finalQrSize + cardPadding * 2;
    const panelHeight = finalQrSize + cardPadding * 2 + textReservedHeight;
    const panelX = Math.round((canvasWidth - panelWidth) / 2);
    const panelY = Math.round((canvasHeight - panelHeight) / 2);
    const qrX = panelX + cardPadding;
    const qrY = panelY + cardPadding;

    const panelSvg = `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <defs>
          <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.12"/>
          </filter>
        </defs>
        <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="32" ry="32"
          fill="${safeBgColor}" filter="url(#panelShadow)"/>
      </svg>
    `;

    const headlineText = hasHeadline ? escapeXml(String(text).trim()) : "";
    const sublineText = hasSubtext ? escapeXml(String(subtext).trim()) : "";
    const badgeY = qrY + finalQrSize + 28;
    const textBaseY = qrY + finalQrSize + 116;

    const svgText = hasHeadline || hasSubtext
      ? `
      <svg width="${canvasWidth}" height="${canvasHeight}">
        <defs>
          <linearGradient id="titleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${safeQrColor}"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.14"/>
          </filter>
        </defs>
        <style>
          .headline {
            fill: url(#titleGradient);
            font-size: 44px;
            font-weight: 700;
            letter-spacing: 2px;
            font-family: "Avenir Next", "Montserrat", "Poppins", "Helvetica Neue", Arial, sans-serif;
            text-transform: uppercase;
          }
          .subline {
            fill: #64748b;
            font-size: 30px;
            font-weight: 600;
            letter-spacing: 0.6px;
            font-family: "Avenir Next", "Montserrat", "Poppins", "Helvetica Neue", Arial, sans-serif;
          }
        </style>
        <rect x="${Math.round(canvasWidth / 2) - 210}" y="${badgeY}" width="420" height="52" rx="26" ry="26" fill="${safeQrColor}" opacity="0.94"/>
        <text x="50%" y="${badgeY + 35}" text-anchor="middle" style="fill:#ffffff;font-size:26px;font-weight:800;letter-spacing:1.8px;font-family:'Avenir Next','Montserrat','Poppins',Arial,sans-serif;text-transform:uppercase;">${headlineText}</text>
        ${
          hasSubtext
            ? `<text x="50%" y="${textBaseY + (hasHeadline ? 48 : 0)}" text-anchor="middle" class="subline">${sublineText}</text>`
            : ""
        }
      </svg>`
      : null;

    const composites = [
      {
        input: Buffer.from(panelSvg),
        left: 0,
        top: 0,
      },
      {
        input: qrFinalBuffer,
        left: qrX,
        top: qrY,
      },
    ];

    if (svgText) {
      composites.push({
        input: Buffer.from(svgText),
        left: 0,
        top: 0,
      });
    }

    const outputBuffer = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: safeBgColor,
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "attachment; filename=qr-code.png");
    res.send(outputBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (char) => {
    const map = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return map[char];
  });
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeHexColor(color, fallback) {
  if (typeof color !== "string") return fallback;
  const value = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

app.listen(3000, () => {
  console.log("QR Generator running at http://localhost:3000");
});
