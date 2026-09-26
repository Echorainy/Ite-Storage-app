import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 5 * 1024 * 1024;
export async function handleSpeech(request, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) return Response.json({ error: '语音服务尚未配置' }, { status: 503 });
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob) || !audio.size || audio.size > MAX_BYTES) {
      return Response.json({ error: '请上传有效录音（不超过 5 MB）' }, { status: 400 });
    }
    const body = new FormData();
    body.append('file', audio, audio.name || 'recording.m4a');
    body.append('model', 'whisper-1');
    body.append('language', 'zh');
    const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return Response.json({ error: '转写服务暂时不可用，请稍后重试' }, { status: 502 });
    const data = await response.json();
    if (typeof data.text !== 'string' || !data.text.trim()) return Response.json({ error: '没有识别到清晰语音' }, { status: 422 });
    return Response.json({ text: data.text.trim() });
  } catch {
    return Response.json({ error: '录音处理失败，请重试' }, { status: 502 });
  }
}

// Local development proxy. Do not expose publicly without authentication/rate limits.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== (process.env.SPEECH_WEB_ORIGIN || 'http://localhost:8081')) {
      res.writeHead(403).end(); return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.writeHead(204).end(); return;
    }
    if (req.url !== '/speech-to-text' || req.method !== 'POST') { res.writeHead(404).end(); return; }
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES + 65536) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const result = await handleSpeech(new Request('http://localhost/speech-to-text', {
        method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || '' }, body: Buffer.concat(chunks),
      }), { apiKey: process.env.OPENAI_API_KEY });
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(await result.text());
    } catch { res.writeHead(400).end(); }
  });
  server.requestTimeout = 45_000;
  server.listen(Number(process.env.SPEECH_PORT || 3001), process.env.SPEECH_HOST || '127.0.0.1', () => console.log('Speech proxy ready on port ' + (process.env.SPEECH_PORT || 3001)));
}
