/**
 * Upload a recorded Expo audio URI to the app's speech-to-text endpoint.
 *
 * The endpoint is deliberately kept behind this small boundary so the UI can
 * remain unaware of transport details. The endpoint should return `{ text }`.
 */
export type SpeechTranscriptionOptions = {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
  filename?: string;
  mimeType?: string;
  signal?: AbortSignal;
  web?: boolean;
};

const configuredApiUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_SPEECH_API_URL?.trim() : undefined;

export async function transcribeAudio(audioUri: string, options: SpeechTranscriptionOptions = {}): Promise<string> {
  if (!audioUri?.trim()) throw new Error('audio URI is required');

  const apiUrl = options.apiUrl?.trim() || configuredApiUrl;
  if (!apiUrl) throw new Error('Speech API URL is not configured');

  const body = new FormData();
  if (options.web) {
    const file = await (options.fetchImpl ?? fetch)(audioUri, { signal: options.signal });
    const blob = await file.blob();
    body.append('audio', blob, blob.type.includes('mp4') ? 'recording.m4a' : 'recording.webm');
  } else body.append('audio', {
    uri: audioUri,
    name: options.filename ?? 'recording.m4a',
    type: options.mimeType ?? 'audio/m4a',
  } as unknown as Blob);

  const response = await (options.fetchImpl ?? fetch)(apiUrl, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
    signal: options.signal,
  });

  if (!response.ok) throw new Error(`Speech API request failed (${response.status})`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Speech API returned invalid JSON');
  }
  const text = payload && typeof payload === 'object' && typeof (payload as { text?: unknown }).text === 'string'
    ? (payload as { text: string }).text.trim()
    : '';
  if (!text) throw new Error('Speech API response did not include text');
  return text;
}
