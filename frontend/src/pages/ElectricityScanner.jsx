import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { api } from "../services/api";
import { useToast } from "../components/Toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyForm = () => ({
  quantity: "",
  activity_date: today(),
  period_start: "",
  period_end: "",
  region: "IN",
  notes: "Electricity bill scanned using OCR",
  provider: "",
  accountNumber: "",
  billNumber: "",
  amount: "",
  previousReading: "",
  currentReading: "",
  dueDate: "",
});

function parseBillDate(value) {
  if (!value) return "";

  const match = String(value).match(
    /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/
  );
  if (!match) return "";

  let [, first, second, year] = match;
  if (year.length === 2) year = `20${year}`;

  // Electricity bills in India commonly use DD/MM/YYYY.
  const day = Number(first);
  const month = Number(second);
  const yyyy = Number(year);

  const date = new Date(yyyy, month - 1, day);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }

  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function numberFrom(value) {
  if (!value) return "";
  const parsed = Number(String(value).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function extractBillDetails(rawText) {
  // Keep line breaks because bill tables often rely on line order.
  const text = rawText
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[ \t]+/g, " ");

  const flat = text.replace(/\s+/g, " ");

  const billDateText = firstMatch(flat, [
    /(?:current\s*)?bill\s*date\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /(?:invoice\s*date|date\s*of\s*issue)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const dueDateText = firstMatch(flat, [
    /(?:please\s*pay\s*by|due\s*date|payment\s*due\s*date)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const periodStartText = firstMatch(flat, [
    /(?:billing\s*period\s*)?(?:start\s*date|period\s*from|from)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /billing\s*period\s*start\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const periodEndText = firstMatch(flat, [
    /(?:billing\s*period\s*)?(?:end\s*date|period\s*to|to)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /billing\s*period\s*end\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  // Prefer an explicitly labelled total/current consumption value.
  // Avoid choosing average daily use or comparison-column values first.
  const unitsText = firstMatch(flat, [
    /(?:total\s*energy\s*consumed|total\s*units\s*consumed|net\s*units|units\s*consumed|energy\s*consumed|consumption)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:consumed\s*units|billed\s*units)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*kwh\b/i,
  ]);

  const previousText = firstMatch(flat, [
    /previous\s*(?:meter\s*)?reading\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
    /old\s*(?:meter\s*)?reading\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
  ]);

  const currentText = firstMatch(flat, [
    /current\s*(?:meter\s*)?reading\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
    /present\s*(?:meter\s*)?reading\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i,
  ]);

  let quantity = numberFrom(unitsText);

  // Only calculate from meter readings when both labelled readings exist.
  if (!quantity && previousText && currentText) {
    const difference =
      Number(numberFrom(currentText)) - Number(numberFrom(previousText));
    if (difference > 0) quantity = String(difference);
  }

  const accountNumber = firstMatch(flat, [
    /account\s*(?:number|no\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{3,})/i,
    /consumer\s*(?:number|no\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{3,})/i,
  ]);

  const billNumber = firstMatch(flat, [
    /bill\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9-]+)/i,
    /invoice\s*(?:number|no\.?)\s*[:\-]?\s*([A-Z0-9-]+)/i,
  ]);

  const amountText = firstMatch(flat, [
    /(?:total\s*)?amount\s*due\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /please\s*pay\s*amount\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /total\s*bill\s*amount\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]);

  const provider = firstMatch(text, [
    /^\s*([A-Z][A-Z0-9 &.-]{3,}(?:ELECTRIC|ELECTRICITY|POWER|ENERGY))/im,
    /^\s*([A-Z][A-Za-z0-9 &.-]{3,})\s*$/m,
  ]);

  return {
    quantity,
    billDate: parseBillDate(billDateText),
    dueDate: parseBillDate(dueDateText),
    periodStart: parseBillDate(periodStartText),
    periodEnd: parseBillDate(periodEndText),
    provider,
    accountNumber: accountNumber.replace(/\s+/g, " ").trim(),
    billNumber,
    amount: numberFrom(amountText),
    previousReading: numberFrom(previousText),
    currentReading: numberFrom(currentText),
  };
}

async function preprocessForOCR(source) {
  const canvas = document.createElement("canvas");

  const scale = Math.min(4, Math.max(2, 2200 / source.width));
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare the image for OCR.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const gray =
      0.299 * pixels[i] +
      0.587 * pixels[i + 1] +
      0.114 * pixels[i + 2];

    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
    pixels[i] = contrast;
    pixels[i + 1] = contrast;
    pixels[i + 2] = contrast;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function recognizeImage(file, worker) {
  const bitmap = await createImageBitmap(file);
  try {
    const processed = await preprocessForOCR(bitmap);
    return await worker.recognize(processed);
  } finally {
    bitmap.close();
  }
}

async function recognizePdf(file, worker, setProgress) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  let combinedText = "";
  let weightedConfidence = 0;
  let totalPages = 0;

  const pageCount = Math.min(pdf.numPages, 5);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    setProgress(`Preparing PDF page ${pageNumber} of ${pageCount}...`);

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    setProgress(`Recognizing text on PDF page ${pageNumber} of ${pageCount}...`);
    const processed = await preprocessForOCR(canvas);
    const result = await worker.recognize(processed);

    combinedText += `\n\n--- PAGE ${pageNumber} ---\n${result.data.text}`;
    weightedConfidence += Number(result.data.confidence || 0);
    totalPages += 1;
  }

  return {
    data: {
      text: combinedText,
      confidence: totalPages ? weightedConfidence / totalPages : 0,
    },
  };
}

export default function ElectricityScanner() {
  const notify = useToast();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [rawText, setRawText] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setPreview(null);
  };

  const selectFile = (selected) => {
    setError("");
    setProgress("");
    setRawText("");
    setConfidence(null);
    setPreview(null);
    setForm(emptyForm());

    if (!selected) {
      setFile(null);
      return;
    }

    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(selected.type);
    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setFile(null);
      setError("Please upload a JPG, PNG, WebP or PDF file.");
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setFile(null);
      setError("File size must be less than 15 MB.");
      return;
    }

    setFile(selected);
  };

  const scanBill = async () => {
    if (!file) {
      setError("Please select an electricity bill first.");
      return;
    }

    setLoading(true);
    setError("");
    setRawText("");
    setConfidence(null);
    setPreview(null);
    setProgress("Loading OCR engine...");

    let worker;

    try {
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(`Recognizing text: ${Math.round(message.progress * 100)}%`);
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: "3",
        preserve_interword_spaces: "1",
      });

      let result;

      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        result = await recognizePdf(file, worker, setProgress);
      } else {
        setProgress("Enhancing image and recognizing text...");
        const processedResult = await recognizeImage(file, worker);
        result = processedResult;
      }

      const text = result?.data?.text || "";
      const score = Number(result?.data?.confidence || 0);

      setRawText(text);
      setConfidence(score);

      if (!text.trim()) {
        setProgress("No readable text found. Try a sharper scan or a clearer photo.");
        return;
      }

      const details = extractBillDetails(text);

      setForm((previous) => ({
        ...previous,
        quantity: details.quantity || previous.quantity,
        activity_date: details.billDate || previous.activity_date,
        period_start: details.periodStart || previous.period_start,
        period_end: details.periodEnd || previous.period_end,
        provider: details.provider || previous.provider,
        accountNumber: details.accountNumber || previous.accountNumber,
        billNumber: details.billNumber || previous.billNumber,
        amount: details.amount || previous.amount,
        previousReading: details.previousReading || previous.previousReading,
        currentReading: details.currentReading || previous.currentReading,
        dueDate: details.dueDate || previous.dueDate,
      }));

      setProgress(
        details.quantity
          ? "OCR completed. Consumption was detected; verify every field before saving."
          : "OCR completed, but consumption was not confidently identified. Check the text and enter it manually."
      );
    } catch (err) {
      console.error("Electricity bill OCR error:", err);
      setError(err?.message || "OCR failed. Try another clear image or PDF.");
      setProgress("");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          console.warn("Could not stop OCR worker:", terminateError);
        }
      }
      setLoading(false);
    }
  };

  const calculatePreview = async () => {
    const quantity = Number(form.quantity);

    if (!form.quantity || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a valid electricity consumption value in kWh.");
      return;
    }

    setError("");

    try {
      const result = await api.calculate({
        category: "electricity",
        quantity,
        unit: "kWh",
        region: form.region,
        activity_date: form.activity_date,
        period_start: form.period_start || undefined,
        period_end: form.period_end || undefined,
      });
      setPreview(result);
    } catch (err) {
      setError(err.message || "Could not calculate emissions.");
    }
  };

  const saveActivity = async () => {
    const quantity = Number(form.quantity);

    if (!form.quantity || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a valid electricity consumption value before saving.");
      return;
    }

    if (!form.activity_date) {
      setError("Choose an activity date.");
      return;
    }

    if (form.activity_date > today()) {
      setError("Activity date cannot be in the future.");
      return;
    }

    if (
      form.period_start &&
      form.period_end &&
      form.period_start > form.period_end
    ) {
      setError("Billing period end must be after the start date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // The current backend Activity model stores these supported fields.
      // Bill metadata is included in notes so it is not silently discarded.
      const metadata = [
        "Electricity bill scanned using OCR",
        form.provider && `Provider: ${form.provider}`,
        form.accountNumber && `Account: ${form.accountNumber}`,
        form.billNumber && `Bill number: ${form.billNumber}`,
        form.amount && `Amount due: ${form.amount}`,
        form.previousReading && `Previous meter reading: ${form.previousReading}`,
        form.currentReading && `Current meter reading: ${form.currentReading}`,
        form.dueDate && `Due date: ${form.dueDate}`,
        form.notes,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 255);

      const activity = await api.addActivity({
        category: "electricity",
        quantity,
        unit: "kWh",
        region: form.region,
        activity_date: form.activity_date,
        period_start: form.period_start || undefined,
        period_end: form.period_end || undefined,
        notes: metadata,
      });

      notify("Electricity bill activity saved!");
      navigate(`/activities/${activity.id}/calculation`);
    } catch (err) {
      setError(err.message || "Could not save the electricity activity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Electricity Bill AI Scanner</h1>
          <p>Upload a bill image or PDF, extract its details, verify them and calculate emissions.</p>
        </div>
      </div>

      <div className="grid g2">
        <section className="card">
          <h2>1. Upload electricity bill</h2>

          <label>
            Select bill (JPG, PNG, WebP or PDF)
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>

          {file && (
            <p className="small muted">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          <button
            className="btn"
            type="button"
            onClick={scanBill}
            disabled={!file || loading}
          >
            {loading ? "Scanning..." : "Scan electricity bill"}
          </button>

          {progress && <p className="hint" aria-live="polite">{progress}</p>}
          {confidence !== null && (
            <p className="small muted">
              OCR confidence: {confidence.toFixed(1)}% (this measures text recognition, not field accuracy).
            </p>
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>

        <section className="card form">
          <h2>2. Verify extracted details</h2>

          <label>
            Electricity consumption (kWh)
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
              placeholder="Example: 285"
            />
          </label>

          <label>
            Bill date / activity date
            <input
              type="date"
              value={form.activity_date}
              max={today()}
              onChange={(event) => update("activity_date", event.target.value)}
            />
          </label>

          <label>
            Billing period start
            <input
              type="date"
              value={form.period_start}
              onChange={(event) => update("period_start", event.target.value)}
            />
          </label>

          <label>
            Billing period end
            <input
              type="date"
              value={form.period_end}
              onChange={(event) => update("period_end", event.target.value)}
            />
          </label>

          <label>
            Due date
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => update("dueDate", event.target.value)}
            />
          </label>

          <label>
            Electricity provider
            <input
              value={form.provider}
              onChange={(event) => update("provider", event.target.value)}
              placeholder="Provider name"
            />
          </label>

          <label>
            Account / consumer number
            <input
              value={form.accountNumber}
              onChange={(event) => update("accountNumber", event.target.value)}
              placeholder="Account number"
            />
          </label>

          <label>
            Bill number
            <input
              value={form.billNumber}
              onChange={(event) => update("billNumber", event.target.value)}
              placeholder="Bill number"
            />
          </label>

          <label>
            Amount due
            <input
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="Amount on bill"
            />
          </label>

          <label>
            Previous meter reading
            <input
              value={form.previousReading}
              onChange={(event) => update("previousReading", event.target.value)}
              placeholder="Previous reading"
            />
          </label>

          <label>
            Current meter reading
            <input
              value={form.currentReading}
              onChange={(event) => update("currentReading", event.target.value)}
              placeholder="Current reading"
            />
          </label>

          <label>
            Grid region
            <select
              value={form.region}
              onChange={(event) => update("region", event.target.value)}
            >
              <option value="IN">India</option>
              <option value="OTHER">Other (generic)</option>
            </select>
          </label>

          <label>
            Notes
            <input
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              maxLength={255}
            />
          </label>

          <div className="row">
            <button
              className="btn ghost"
              type="button"
              onClick={calculatePreview}
              disabled={!form.quantity || saving}
            >
              Calculate emissions
            </button>

            <button
              className="btn"
              type="button"
              onClick={saveActivity}
              disabled={!form.quantity || saving}
            >
              {saving ? "Saving..." : "Save activity"}
            </button>
          </div>
        </section>
      </div>

      {preview && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>3. Carbon emission preview</h2>
          <p style={{ fontSize: "1.6rem", fontWeight: 700 }}>
            {Number(preview.emissions_kg).toFixed(3)} kg CO2e
          </p>
          {preview.substitution && (
            <p className="small muted">{preview.substitution}</p>
          )}
        </section>
      )}

      {rawText && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>4. OCR extraction results</h2>
          <p className="hint">
            This is the raw text recognized by OCR. If a field above is blank or incorrect, you can enter the correct value manually.
          </p>
          <textarea
            readOnly
            rows={16}
            value={rawText}
            style={{
              width: "100%",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              fontSize: "14px",
            }}
          />
          <p className="small muted">
            Characters extracted: {rawText.length}
          </p>
        </section>
      )}
    </div>
  );
}
