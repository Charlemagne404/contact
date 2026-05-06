const path = require("path");
const { randomUUID } = require("crypto");

require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const publicDir = path.join(__dirname, "public");

const PROJECT_OPTIONS = [
  "General",
  "Continental ID",
  "Vanguard",
  "Aegis",
  "Blueprint",
  "Continental Studios",
  "Grimoire",
  "StepCast",
  "The Echo Archives",
  "Minesweeper",
  "Terra Tread",
  "Sovereign",
  "Other",
];

const REASON_OPTIONS = [
  "Bug report",
  "Feature request",
  "Support/help",
  "Security issue",
  "Abuse report",
  "Other",
];

const projectSet = new Set(PROJECT_OPTIONS);
const reasonSet = new Set(REASON_OPTIONS);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

app.disable("x-powered-by");

app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");

  if (req.secure || req.get("x-forwarded-proto") === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large.", requestId: req.requestId });
  }

  if (error instanceof SyntaxError) {
    return res.status(400).json({ error: "Request body must be valid JSON.", requestId: req.requestId });
  }

  return next(error);
});

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: "Too many submissions. Please wait a few minutes and try again.",
      requestId: req.requestId,
    });
  },
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const website = normalizeText(body.website);

  if (website) {
    logWithRequestId("warn", req.requestId, "Submission rejected by honeypot.");
    return res.status(400).json({ error: "Submission rejected as likely spam.", requestId: req.requestId });
  }

  const project = normalizeText(body.project);
  const reason = normalizeText(body.reason);
  const email = normalizeText(body.email);
  const message = normalizeMessage(body.message);

  if (!project || !reason || !message) {
    return res.status(400).json({ error: "Project, reason, and message are required.", requestId: req.requestId });
  }

  if (!projectSet.has(project)) {
    return res.status(400).json({ error: "Please choose a valid project.", requestId: req.requestId });
  }

  if (!reasonSet.has(reason)) {
    return res.status(400).json({ error: "Please choose a valid reason.", requestId: req.requestId });
  }

  if (message.length > 3000) {
    return res.status(400).json({ error: "Message must be 3000 characters or fewer.", requestId: req.requestId });
  }

  if (email && (email.length > 254 || !emailPattern.test(email))) {
    return res.status(400).json({ error: "Please enter a valid email address or leave it blank.", requestId: req.requestId });
  }

  const webhookUrl = process.env.DISCORD_CONTACT_WEBHOOK_URL;

  if (!webhookUrl) {
    logWithRequestId("error", req.requestId, "Contact webhook is not configured.");
    return res.status(500).json({
      error: "Message could not be delivered. Please try again later.",
      requestId: req.requestId,
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDiscordPayload({ requestId: req.requestId, project, reason, email, message })),
    });

    if (!response.ok) {
      logWithRequestId("error", req.requestId, `Discord webhook failed with status ${response.status}.`);
      return res.status(502).json({
        error: "Message could not be delivered. Please try again later.",
        requestId: req.requestId,
      });
    }

    logWithRequestId("info", req.requestId, `Submission accepted for ${project} (${reason}).`);
    return res.json({ success: true, requestId: req.requestId });
  } catch (error) {
    logWithRequestId("error", req.requestId, "Discord webhook request failed.", error);
    return res.status(502).json({
      error: "Message could not be delivered. Please try again later.",
      requestId: req.requestId,
    });
  }
});

app.use(express.static(publicDir));

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(publicDir, "privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(publicDir, "terms.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found.", requestId: req.requestId });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("*", (req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMessage(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function cleanForDiscord(value) {
  return value
    .replace(/\u0000/g, "")
    .replace(/@everyone/gi, "@\u200beveryone")
    .replace(/@here/gi, "@\u200bhere")
    .trim();
}

function buildDiscordPayload({ requestId, project, reason, email, message }) {
  const messageFields = chunkText(cleanForDiscord(message), 1000).map((chunk, index) => ({
    name: index === 0 ? "Message" : `Message continued ${index + 1}`,
    value: chunk,
    inline: false,
  }));

  return {
    username: "Continental Contact",
    allowed_mentions: {
      parse: [],
    },
    embeds: [
      {
        title: "New Continental Contact Message",
        color: 3447003,
        fields: [
          { name: "Request ID", value: cleanForDiscord(requestId), inline: false },
          { name: "Project", value: cleanForDiscord(project), inline: true },
          { name: "Reason", value: cleanForDiscord(reason), inline: true },
          { name: "Email", value: email ? cleanForDiscord(email) : "Not provided", inline: false },
          ...messageFields,
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Continental Contact",
        },
      },
    ],
  };
}

function chunkText(value, maxLength) {
  const chunks = [];

  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }

  return chunks.length > 0 ? chunks : ["Not provided"];
}

function logWithRequestId(level, requestId, message, error) {
  const prefix = `[contact:${requestId}] ${message}`;

  if (level === "error") {
    console.error(error ? `${prefix} ${error.message || error}` : prefix);
    return;
  }

  if (level === "warn") {
    console.warn(prefix);
    return;
  }

  console.info(prefix);
}

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Continental contact site running on http://localhost:${port}`);
  });
}

module.exports = app;
