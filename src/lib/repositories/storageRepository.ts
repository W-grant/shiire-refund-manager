import type { LegacyImage, LegacyRecord } from "../mappers/purchaseMapper";
import { insertPurchaseEvidence } from "./evidenceRepository";
import { supabase } from "../supabase";

const EVIDENCE_BUCKET = "evidence";

export type EvidenceUploadSuccess = {
  storagePath: string;
  fileName: string;
  label: string | null;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
};

export type EvidenceUploadFailure = {
  fileName: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type EvidenceUploadResult = {
  successes: EvidenceUploadSuccess[];
  failures: EvidenceUploadFailure[];
};

function sanitizePathPart(value: string, fallback: string) {
  const safe = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || fallback;
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/heic") return ".heic";
  if (mimeType === "image/heif") return ".heif";
  return ".jpg";
}

function fileNameForStorage(fileName: string, mimeType: string) {
  const safe = sanitizePathPart(fileName, "evidence");
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  return `${base}${extensionFromMime(mimeType)}`;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function evidenceStoragePath(record: LegacyRecord, image: LegacyImage, index: number, mimeType = "image/jpeg") {
  const [year = "unknown", month = "unknown"] = String(record.date || "").split("-");
  const order = String(index + 1).padStart(3, "0");
  const label = sanitizePathPart(image.label || "evidence", "evidence");
  const fileName = fileNameForStorage(image.fileName || `evidence_${order}`, mimeType);
  return `purchases/${year}/${month}/${record.id}/${order}_${label}_${fileName}`;
}

function errorPayload(error: unknown, fileName: string): EvidenceUploadFailure {
  const value = error as Partial<EvidenceUploadFailure>;
  return {
    fileName,
    message: value?.message || String(error),
    code: value?.code,
    details: value?.details,
    hint: value?.hint
  };
}

export async function uploadEvidenceImages(
  record: LegacyRecord,
  images: LegacyImage[],
  uploadedBy: string | null
): Promise<EvidenceUploadResult> {
  const successes: EvidenceUploadSuccess[] = [];
  const failures: EvidenceUploadFailure[] = [];

  for (const [index, image] of images.entries()) {
    const source = image.full;
    const fileName = image.fileName || `evidence_${index + 1}.jpg`;
    if (!source) continue;

    try {
      console.log("[Storage] Upload start", { id: record.id, fileName });
      const blob = await dataUrlToBlob(source);
      const mimeType = blob.type || "image/jpeg";
      const storagePath = evidenceStoragePath(record, image, index, mimeType);
      const { error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, blob, { contentType: mimeType, upsert: false });

      if (error) throw error;
      console.log("[Storage] Upload success", { id: record.id, storagePath });
      successes.push({
        storagePath,
        fileName,
        label: image.label || null,
        mimeType,
        fileSize: blob.size,
        sortOrder: index
      });
    } catch (error) {
      const failure = errorPayload(error, fileName);
      console.warn("[Storage] Upload failed", failure);
      failures.push(failure);
    }
  }

  if (successes.length) {
    try {
      await insertPurchaseEvidence(successes.map((item) => ({
        purchase_id: record.id,
        storage_bucket: EVIDENCE_BUCKET,
        storage_path: item.storagePath,
        file_name: item.fileName,
        label: item.label,
        mime_type: item.mimeType,
        file_size: item.fileSize,
        sort_order: item.sortOrder,
        uploaded_by: uploadedBy
      })));
      console.log("[Storage] Evidence metadata insert success", { id: record.id, count: successes.length });
    } catch (error) {
      const failure = errorPayload(error, "purchase_evidence");
      console.error("[Storage] Evidence metadata insert failed", failure);
      failures.push(failure);
    }
  }

  return { successes, failures };
}
