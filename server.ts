import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "khatawas-ledger" });
  });

  app.post("/api/transcribe-audio", async (req, res) => {
    try {
      const { audioBase64, mimeType = "audio/webm", languageMode = "auto" } = req.body ?? {};

      if (typeof audioBase64 !== "string" || !audioBase64.trim()) {
        return res.status(400).json({ error: "No audio recording received." });
      }

      const cleanMimeType =
        typeof mimeType === "string" && mimeType.includes("/")
          ? mimeType.split(";")[0].trim()
          : "audio/webm";

      const langHint =
        languageMode === "kn-IN"
          ? "Expected language: Kannada (or Kannada-English mix)."
          : languageMode === "hi-IN"
            ? "Expected language: Hindi."
            : languageMode === "hinglish"
              ? "Expected language: Hinglish (Hindi-English mix)."
              : languageMode === "en-IN"
                ? "Expected language: Indian English."
                : "Expected language: Kannada, Hindi, Hinglish, or Indian English.";

      const ai = getGeminiClient();
      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: audioBase64.trim(),
        },
      };

      const promptText = `Listen to the attached audio and transcribe ONLY the exact spoken human words.
${langHint}
Return ONLY the transcribed words with no quotes or extra text.
If the audio is silent, static, or contains no intelligible human speech, reply with exactly: [SILENCE]`;

      const transcribeModels = ["gemini-3.5-transcribe", "gemini-3.1-flash-lite", "gemini-4-hydrogen"];
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      let lastError: unknown = null;

      for (const modelName of transcribeModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [audioPart, { text: promptText }] },
          });
          break;
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isRecoverable =
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("429") ||
            errMsg.includes("404") ||
            errMsg.includes("NOT_FOUND");
          if (!isRecoverable) throw err;
        }
      }

      if (!response) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Audio transcription service is temporarily unavailable.");
      }

      let transcript = (response.text ?? "").trim().replace(/^["']|["']$/g, "").trim();
      if (/^[\[\(]?silence[\]\)]?$/i.test(transcript) || transcript.toLowerCase() === "no speech") {
        transcript = "";
      }
      return res.json({ transcript });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to transcribe microphone audio.";
      console.error("Error in /api/transcribe-audio:", error);
      return res.status(500).json({ error: message });
    }
  });

  app.post("/api/parse-command", async (req, res) => {
    try {
      const {
        transcript,
        languageMode = "auto",
        todayDate,
        customers = [],
        activeCustomer = null,
      } = req.body ?? {};

      if (typeof transcript !== "string" || !transcript.trim()) {
        return res.status(400).json({
          error: "Please speak or type a ledger command before parsing.",
        });
      }

      const trimmed = transcript.trim();
      const referenceDate =
        typeof todayDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todayDate)
          ? todayDate
          : new Date().toISOString().slice(0, 10);

      const customerDirectoryHint = Array.isArray(customers)
        ? customers
            .slice(0, 50)
            .map((c: { name?: string; area?: string; aliases?: string[] }) => {
              const aliasList = Array.isArray(c.aliases) ? c.aliases.join(", ") : "";
              return `- ${c.name || "Unknown"}${c.area ? ` (${c.area})` : ""}${
                aliasList ? ` [aliases: ${aliasList}]` : ""
              }`;
            })
            .join("\n")
        : "";

      const activeCustomerHint =
        activeCustomer && typeof activeCustomer === "object" && activeCustomer.name
          ? `${activeCustomer.name}${activeCustomer.area ? ` (${activeCustomer.area})` : ""}`
          : "None";

      const ai = getGeminiClient();

      const systemInstruction = `You are KHATAWAS's multilingual Indian kirana shop udhaar (credit), jama (payment), and ledger query parser.
Today's local date is ${referenceDate}.
User's selected language mode: ${languageMode}.
Current active conversation customer: ${activeCustomerHint}.

Known customer directory for spelling/phonetic reference (do NOT resolve duplicate names yourself unless activeCustomer applies to an omitted-name follow-up):
${customerDirectoryHint || "(none provided)"}

Parse the shopkeeper's spoken or typed command across Kannada (Romanized or Kannada script), Hindi (Romanized or Devanagari), Hinglish, and Indian English.

CRITICAL MULTILINGUAL & CONVERSATIONAL RULES:
1. Classify intentKind:
   - "UNDO": User asks to undo/revert the last entry ("undo", "cancel last", "wapas lo", "hinde tago", "last entry delete maadu"). Also set isUndoCommand = true.
   - "QUERY": User is asking a question about balances, today's totals, who owes the most, or daily summary/hisab:
     - queryType = "CUSTOMER_BALANCE": e.g., "Ramesh total eshtu kodbeku?", "What is Suresh's balance?", "Ramesh ka kitna baaki hai?", "How much does he owe?", "Total eshtu kodbeku?"
     - queryType = "TODAY_CREDIT": e.g., "Today total credit how much?", "Ivattu eshtu udhaara aaytu?", "Aaj kitna udhaar diya?"
     - queryType = "TODAY_PAYMENTS": e.g., "Today payments?", "Ivattu eshtu jama bandide?", "Aaj kitna vasool hua?"
     - queryType = "TOP_DEBTORS": e.g., "Who owes the most?", "Yaaru jasti kodbeku?", "Sabse zyada kis par baaki hai?"
     - queryType = "DAILY_SUMMARY": e.g., "Indina hisab heli", "Aaj ka hisab batao", "Daily summary", "End of day report"
     - queryType = "TOTAL_OUTSTANDING": e.g., "Total market baaki?", "Total receivable how much?", "Ottaare eshtu barabeku?"
   - "TRANSACTION": User is adding a credit or payment entry.
   - "UNKNOWN": Gibberish, unclear noise, or missing critical info.

2. Active Customer Follow-Up Context (usesActiveCustomer):
   - If the user does NOT explicitly mention a customer name, uses a pronoun ("him", "her", "avarige", "usko", "unko"), or says a continuation phrase like "Innu 200 add maadu", "Add 200 more", "Aur 300 likho", "200 jama bhi add karo", "Avanige total eshtu kodbeku?":
     - Set usesActiveCustomer = true if an active conversation customer (${activeCustomerHint}) exists!
     - If activeCustomer is "None" and no customer name was spoken for a TRANSACTION or CUSTOMER_BALANCE query, set usesActiveCustomer = false, intentKind = "UNKNOWN", and explain in unclearReason that no customer name was specified.
   - If the user DOES explicitly mention a customer name (e.g., "Ramesh", "Suresh"), set usesActiveCustomer = false and return the exact spoken/typed customerName (keeping explicit area qualifiers like "Ramesh MG Road").

3. Transaction Type (for intentKind = "TRANSACTION"):
   - CREDIT: "udhaar", "udhaara", "udhari", "saala", "sala", "baaki", "credit", "debit", "khata", "likho", "barikolli", "haaku", "add maadu" (when adding to khata/udhaar), "add more", "innu ... add", "took", "bought".
   - PAYMENT: "jama", "payment", "paid", "gave", "received", "wapas", "diya", "diye", "kottiddu", "kottaru", "kottide", "kotta", "vasool", "settled", "cash".
   - Note: "Ramesh ge 500 add maadu" or "Innu 200 add maadu" in a kirana udhaar ledger means CREDIT unless "payment"/"jama"/"kottiddu"/"diya" is mentioned!

4. Numbers & Amounts (INR ₹):
   - Convert spoken words across languages into exact numeric INR:
     - Kannada: "ondu"=1, "eradu"=2, "mooru"=3, "naalku"=4, "aidu"=5, "aaru"=6, "elu"=7, "entu"=8, "ombattu"=9, "hattu"=10, "ippattu"=20, "muvattu"=30, "nalavattu"=40, "aivattu"=50, "nooru"=100, "innooru"=200, "eradu nooru"=200, "munnooru"=300, "nalnooru"=400, "ainooru"=500, "saavira"=1000, "ondu saavira"=1000, "eradu saavira"=2000, "ardha"=0.5.
     - Hindi/Hinglish: "ek"=1, "do"=2, "teen"=3, "chaar"=4, "paanch"=5, "sau"=100, "so"=100, "dedh sau"=150, "dhai sau"=250, "paanch sau"=500, "hazaar"=1000, "ek hazaar"=1000, "do hazaar"=2000.
     - English/Shorthand: "k"=1000, "hundred"=100, "thousand"=1000.
   - For QUERY or UNDO intents, amount can be 0.

5. Date:
   - Resolve relative words ("today"/"aaj"/"ivattu" -> ${referenceDate}, "yesterday"/"kal"/"ninne" -> 1 day before ${referenceDate}). Default to ${referenceDate}.

6. Detected Language:
   - Return "kn" for Kannada / Kannada-mixed ("ge", "innu", "maadu", "eshtu", "kodbeku", "heli", "indina", "hisab", "yaaru", "rupaayi", "udhaara", "saala", "kottiddu", "nooru", "saavira", Kannada script).
   - Return "hi" for pure Hindi / Devanagari.
   - Return "hinglish" for Romanized Hindi-English mix ("ko", "rupaye", "udhaar", "likho", "diya", "jama", "aur", "kitna").
   - Return "en" for pure English.`;

      const modelsToTry = ["gemini-3.1-flash-lite", "gemini-4-hydrogen"];
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: `Parse this kirana ledger command:\n"${trimmed}"`,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intentKind: {
                    type: Type.STRING,
                    description: "One of: TRANSACTION, QUERY, UNDO, UNKNOWN",
                  },
                  queryType: {
                    type: Type.STRING,
                    description: "When intentKind is QUERY: CUSTOMER_BALANCE, TODAY_CREDIT, TODAY_PAYMENTS, TOP_DEBTORS, DAILY_SUMMARY, or TOTAL_OUTSTANDING. Empty string otherwise.",
                  },
                  usesActiveCustomer: {
                    type: Type.BOOLEAN,
                    description: "True if this command omits the customer name or uses a pronoun and refers to the active conversation customer.",
                  },
                  customerName: {
                    type: Type.STRING,
                    description: "Extracted customer name without postpositions, keeping explicit area qualifiers if spoken.",
                  },
                  amount: {
                    type: Type.NUMBER,
                    description: "Numeric INR amount, or 0 if query/undo/unclear.",
                  },
                  type: {
                    type: Type.STRING,
                    description: "CREDIT, PAYMENT, or UNKNOWN",
                  },
                  date: {
                    type: Type.STRING,
                    description: "ISO date YYYY-MM-DD",
                  },
                  note: {
                    type: Type.STRING,
                    description: "Short item/reason note if mentioned, else empty string.",
                  },
                  confidence: {
                    type: Type.INTEGER,
                    description: "Confidence score from 0 to 100.",
                  },
                  detectedLanguage: {
                    type: Type.STRING,
                    description: "One of: kn, hi, hinglish, en",
                  },
                  isUndoCommand: {
                    type: Type.BOOLEAN,
                    description: "True if the command asks to undo or revert the last saved transaction.",
                  },
                  unclearReason: {
                    type: Type.STRING,
                    description: "Clear explanation if command is unclear; empty string if clear.",
                  },
                },
                required: [
                  "intentKind",
                  "queryType",
                  "usesActiveCustomer",
                  "customerName",
                  "amount",
                  "type",
                  "date",
                  "note",
                  "confidence",
                  "detectedLanguage",
                  "isUndoCommand",
                  "unclearReason",
                ],
              },
            },
          });
          break;
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isTransient = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("429");
          if (!isTransient) throw err;
        }
      }

      if (!response) {
        throw lastError instanceof Error ? lastError : new Error("Model service is temporarily busy. Please try again.");
      }

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);

      const normalizedIntentKind = ["TRANSACTION", "QUERY", "UNDO", "UNKNOWN"].includes(parsed.intentKind)
        ? parsed.intentKind
        : parsed.isUndoCommand
          ? "UNDO"
          : "TRANSACTION";

      const validQueryTypes = [
        "CUSTOMER_BALANCE",
        "TODAY_CREDIT",
        "TODAY_PAYMENTS",
        "TOP_DEBTORS",
        "DAILY_SUMMARY",
        "TOTAL_OUTSTANDING",
      ];
      const normalizedQueryType = validQueryTypes.includes(parsed.queryType)
        ? parsed.queryType
        : undefined;

      const normalizedType =
        parsed.type === "CREDIT" || parsed.type === "PAYMENT" ? parsed.type : "UNKNOWN";
      const normalizedLang = ["kn", "hi", "hinglish", "en"].includes(parsed.detectedLanguage)
        ? parsed.detectedLanguage
        : languageMode === "kn-IN"
          ? "kn"
          : languageMode === "hi-IN"
            ? "hi"
            : languageMode === "hinglish"
              ? "hinglish"
              : "en";

      return res.json({
        rawText: trimmed,
        intentKind: normalizedIntentKind,
        queryType: normalizedQueryType,
        usesActiveCustomer: Boolean(parsed.usesActiveCustomer),
        customerName: typeof parsed.customerName === "string" ? parsed.customerName.trim() : "",
        amount: typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? Math.max(0, Math.round(parsed.amount)) : 0,
        type: normalizedType,
        date:
          typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? parsed.date
            : referenceDate,
        note: typeof parsed.note === "string" ? parsed.note.trim() : "",
        confidence:
          typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
            ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
            : 0,
        detectedLanguage: normalizedLang,
        isUndoCommand: Boolean(parsed.isUndoCommand) || normalizedIntentKind === "UNDO",
        unclearReason: typeof parsed.unclearReason === "string" ? parsed.unclearReason.trim() : "",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to parse voice command with Gemini.";
      console.error("Error in /api/parse-command:", error);
      return res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build artifacts not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`KHATAWAS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
