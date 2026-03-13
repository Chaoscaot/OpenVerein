"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

const UPLOADED_IMAGE_PREFIX = "r2:";

export function toStoredImageRef(fileId: string) {
  return `${UPLOADED_IMAGE_PREFIX}${fileId}`;
}

export function getStoredImageFileId(image: string | null | undefined) {
  if (!image?.startsWith(UPLOADED_IMAGE_PREFIX)) {
    return null;
  }

  return image.slice(UPLOADED_IMAGE_PREFIX.length) || null;
}

export function useStoredImageUrl(image: string | null | undefined) {
  const fileId = getStoredImageFileId(image);
  const uploadedUrl = useQuery(api.files.getUrl, fileId ? { fileId } : "skip");

  if (fileId) {
    return uploadedUrl ?? "";
  }

  return image ?? "";
}
