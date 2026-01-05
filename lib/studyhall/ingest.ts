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
  return (
    /do not (reproduce|distribute|display|share|copy)/i.test(lowered) ||
    /unauthorized/i.test(lowered) ||
    /copyright/i.test(lowered) ||
    /all rights reserved/i.test(lowered) ||
    /lecture notes/i.test(lowered) ||
    /course materials?/i.test(lowered) ||
    /recordings?/i.test(lowered) ||
    /syllabus/i.test(lowered) ||
    /grading/i.test(lowered) ||
    /attendance/i.test(lowered) ||
    /academic integrity/i.test(lowered) ||
    /\b(course|class|academic)\s+policy\b/i.test(lowered)
  );
}
