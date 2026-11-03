import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, session } from '@/api/client';

/** Local picker URIs never receive credentials; path is an API-relative file endpoint. */
export type AttachmentSource = { name: string; mime: string } & (
  | { uri: string; path?: never }
  | { path: string; uri?: never }
);

export function previewError(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return 'Your session expired. Sign in again to open this file.';
  if (status === 403) return 'You do not have permission to open this file.';
  if (status === 404) return 'This file is no longer available.';
  if (axios.isCancel(error)) return 'Preview canceled. Please try again.';
  return error instanceof Error && !axios.isAxiosError(error)
    ? error.message : 'Could not load this file. Check your connection and retry.';
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.onabort = () => reject(new axios.CanceledError());
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.includes(',')) reject(new Error('Could not read this file.'));
      else resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

let sequence = 0;
export async function prepareAttachment(source: AttachmentSource, signal?: AbortSignal) {
  const revision = session.revision;
  function assertCurrent() {
    if (signal?.aborted || revision !== session.revision) throw new axios.CanceledError('Account changed or preview closed');
  }
  assertCurrent();
  if (source.uri !== undefined) {
    if (!/^(file|content|ph|assets-library):\/\//i.test(source.uri)) throw new Error('Unsupported local attachment.');
    return { uri: source.uri, dispose: async () => {}, assertCurrent };
  }
  // Never forward session credentials to caller-provided absolute URLs.
  if (!/^\/(attachments|invoices)\/[^/?#]+\/(file|pdf)$/.test(source.path)) throw new Error('Unsupported attachment path.');
  if (!FileSystem.cacheDirectory) throw new Error('File storage is unavailable on this device.');
  const { data } = await api.get<Blob>(source.path, {
    responseType: 'blob',
    signal,
    timeout: 60000,
    headers: { 'Cache-Control': 'no-cache' },
    params: { preview: `${Date.now()}-${sequence}` },
  });
  assertCurrent();
  if (!data.size) throw new Error('This file is empty.');
  const encoded = await base64(data);
  assertCurrent();
  const name = source.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
  const uri = `${FileSystem.cacheDirectory}preview-${Date.now()}-${sequence++}-${name}`;
  const dispose = () => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  try {
    await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
    assertCurrent();
    return { uri, dispose, assertCurrent };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export async function openAttachment(source: AttachmentSource, signal?: AbortSignal, isCurrent: () => boolean = () => true) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Opening files is unavailable on this device.');
  const file = await prepareAttachment(source, signal);
  try {
    file.assertCurrent();
    if (!isCurrent()) throw new axios.CanceledError('Preview closed');
    await Sharing.shareAsync(file.uri, {
      mimeType: source.mime,
      UTI: source.mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
      dialogTitle: source.name,
    });
  } finally {
    await file.dispose();
  }
}
