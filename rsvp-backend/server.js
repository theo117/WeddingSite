import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import twilio from "twilio";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "rsvps.json");

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
const twilioEnabled = Boolean(twilioSid && twilioToken && twilioFrom);
const twilioClient = twilioEnabled ? twilio(twilioSid, twilioToken) : null;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function normalizePhone(input) {
  const cleaned = String(input || "").replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  return `+${cleaned}`;
}

function validateBody(body) {
  const name = String(body.name || "").trim();
  const phone = normalizePhone(body.phone);
  const attendance = String(body.attendance || "").trim().toLowerCase();
  const guests = Number(body.guests);
  const message = String(body.message || "").trim();

  if (!name) return "Name is required.";
  if (!phone) return "Phone is required.";
  if (!/^\+[1-9]\d{9,14}$/.test(phone)) {
    return "Phone must be full international format, for example +27731234567.";
  }
  if (!["yes", "no"].includes(attendance)) return "Attendance must be yes or no.";
  if (!Number.isFinite(guests) || guests < 1 || guests > 10) {
    return "Guests must be between 1 and 10.";
  }

  return {
    name,
    phone,
    attendance,
    guests,
    message
  };
}

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readRsvps() {
  await ensureStorage();
  const raw = await fs.readFile(dataFile, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRsvps(rows) {
  await ensureStorage();
  await fs.writeFile(dataFile, JSON.stringify(rows, null, 2), "utf8");
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "rsvp-backend",
    whatsapp: twilioEnabled ? "configured" : "not-configured"
  });
});

app.post("/api/rsvp", async (req, res) => {
  const valid = validateBody(req.body || {});
  if (typeof valid === "string") {
    return res.status(400).json({ ok: false, error: valid });
  }

  const rsvp = {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    ...valid
  };

  try {
    const rows = await readRsvps();
    rows.push(rsvp);
    await writeRsvps(rows);
  } catch {
    return res.status(500).json({ ok: false, error: "Could not store RSVP." });
  }

  let whatsappSent = false;
  let whatsappError = null;

  if (twilioClient) {
    const attendanceText =
      rsvp.attendance === "yes" ? "Great news, we received your RSVP as attending." : "We received your RSVP.";

    const body = [
      `Hi ${rsvp.name},`,
      attendanceText,
      "Thank you for responding to our wedding invitation.",
      "With love, Name1 and Name2"
    ].join(" ");

    try {
      await twilioClient.messages.create({
        from: twilioFrom,
        to: `whatsapp:${rsvp.phone}`,
        body
      });
      whatsappSent = true;
    } catch (err) {
      whatsappError = err?.message || "WhatsApp send failed.";
    }
  }

  return res.status(201).json({
    ok: true,
    rsvpId: rsvp.id,
    whatsappSent,
    whatsappError
  });
});

app.get("/api/rsvps", async (_req, res) => {
  try {
    const rows = await readRsvps();
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, total: rows.length, items: rows });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load RSVPs." });
  }
});

app.listen(port, () => {
  console.log(`RSVP backend running on http://localhost:${port}`);
  console.log(`WhatsApp status: ${twilioEnabled ? "configured" : "not-configured"}`);
});
