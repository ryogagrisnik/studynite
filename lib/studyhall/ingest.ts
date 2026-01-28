import pdfParse from "pdf-parse";
import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_INPUT_CHARS,
  MAX_TOTAL_FILE_SIZE_BYTES,
} from "./constants";
import { ocrImage, ocrPdf } from "./ocr";

type IngestInput = {
  text?: string | null;
  files?: File[];
  userId?: string;
};

export async function extractStudyText({ text, files = [], userId }: IngestInput) {
  const chunks: string[] = [];
  const safeFiles = files.filter(Boolean);

  if (safeFiles.length > MAX_FILE_COUNT) {
    throw new Error(`Too many files. Max ${MAX_FILE_COUNT} files per deck.`);
  }

  const totalBytes = safeFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  if (totalBytes > MAX_TOTAL_FILE_SIZE_BYTES) {
    throw new Error("Combined file size is too large. Remove a file and try again.");
  }

  if (text && text.trim()) {
    chunks.push(text.trim());
  }

  for (const file of safeFiles) {
    const fileLabel = file.name || "uploaded file";
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large: ${fileLabel}.`);
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      let pdfText = "";
      try {
        pdfText = await extractPdfText(file);
      } catch (error: any) {
        throw new Error(`Could not read ${fileLabel}: ${error?.message || "PDF parsing failed."}`);
      }
      if (pdfText.trim()) {
        chunks.push(pdfText.trim());
      }
      continue;
    }

    const name = file.name.toLowerCase();
    const isImage =
      file.type.startsWith("image/") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp");

    if (isImage) {
      let imageText = "";
      try {
        imageText = await ocrImage(file);
      } catch (error: any) {
        throw new Error(
          `Unable to read ${fileLabel}: ${error?.message || "Image OCR is not available."}`
        );
      }
      if (imageText.trim()) {
        chunks.push(imageText.trim());
      }
      continue;
    }

    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const combined = chunks.join("\n\n").trim();
  const withoutNulls = combined.replace(/\u0000/g, "");
  const cleaned = compactStudyText(filterPolicyText(withoutNulls));

  if (!cleaned) {
    throw new Error("No text could be extracted from the provided inputs.");
  }

  if (cleaned.length > MAX_INPUT_CHARS) {
    return cleaned.slice(0, MAX_INPUT_CHARS).trim();
  }

  return cleaned;
}

async function extractPdfText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text = parsed.text?.trim() ?? "";
  if (text.length >= 200) {
    return text;
  }

  if (!text.trim()) {
    try {
      await ocrPdf(file);
    } catch (error: any) {
      throw new Error(
        error?.message ||
          "This PDF looks like a scan and couldn't be read. Upload a text-based PDF or paste text instead."
      );
    }
  }

  return text;
}

function filterPolicyText(input: string) {
  if (!input) return input;
  const lines = input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !looksLikePolicyLine(line));
  return lines.join("\n");
}

function compactStudyText(input: string) {
  if (!input) return input;
  const seen = new Set<string>();
  const lines = input
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => line.length >= 3);
  const pruned: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pruned.push(line);
  }
  return pruned.join("\n");
}

function looksLikePolicyLine(line: string) {
  const lowered = line.toLowerCase();
  if (lowered.length < 8) return false;
  const hardPatterns = [
    /do not (reproduce|distribute|display|share|copy)/i,
    /unauthorized/i,
    /copyright/i,
    /all rights reserved/i,
    /lecture notes/i,
    /course materials?/i,
    /recordings?/i,
    /syllabus/i,
    /grading/i,
    /attendance/i,
    /academic integrity/i,
    /\bplagiarism\b/i,
    /\b(course|class|academic)\s+policy\b/i,
    /\b(course|class)\s+(overview|description|objectives|outcomes|goals|requirements|info|focus)\b/i,
    /\btextbook\b/i,
    /\brequired (text|reading|materials)\b/i,
    /\bprereq(u?isite)?s?\b/i,
    /\bcoreq(u?isite)?s?\b/i,
    /\b(instructor|professor|teacher|ta|teaching assistant)\b/i,
    /\boffice hours\b/i,
    /\b(email|phone|contact|room|location|building)\b/i,
    /\b(canvas|blackboard|moodle|lms|course website)\b/i,
    /\b(add\/drop|withdraw(al)?)\b/i,
    /\bcredits?\b|\bunits?\b|\bcredit hours?\b/i,
  ];

  if (hardPatterns.some((pattern) => pattern.test(lowered))) {
    return true;
  }

  const softKeywords = [
    "exam",
    "midterm",
    "final",
    "quiz",
    "homework",
    "assignment",
    "project",
    "due",
    "deadline",
    "late",
    "schedule",
    "calendar",
    "week",
    "session",
    "lecture",
    "class",
    "course",
  ];
  let hits = 0;
  for (const keyword of softKeywords) {
    if (lowered.includes(keyword)) hits += 1;
  }
  if (hits >= 2) return true;
  if (
    hits >= 1 &&
    /(%|percent|points?|pts\b|due\b|deadline|date\b|time\b|\b\d{1,2}:\d{2}\b)/i.test(lowered)
  ) {
    return true;
  }

  if (/\b[A-Z]{2,}\s?\d{2,}\b/.test(line) && /\b(course|class|section)\b/i.test(lowered)) {
    return true;
  }

  if (/^(week|lecture|session)\s*\d+[:\-]/i.test(line)) {
    return true;
  }

  return false;
}
