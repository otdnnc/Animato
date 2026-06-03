import type { UploadedModel } from "@/types/model";

import { useSyncExternalStore } from "react";

// Client-side singleton holding the model uploaded via /api/upload, so it can
// be handed from the home page to the editor route across navigation. The
// descriptor is small (just URLs), but keeping it in module memory avoids
// re-uploading on navigation. A hard refresh clears it; the editor handles
// that by letting the user pick a file again.

let current: UploadedModel | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setModel(model: UploadedModel | null) {
  current = model;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

export function useModel() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
