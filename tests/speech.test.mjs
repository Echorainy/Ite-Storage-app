import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribeAudio } from '../src/speech.ts';

// React Native's FormData accepts a file descriptor object. Node's built-in
// implementation coerces that object to a string, so use a tiny equivalent in
// these transport-boundary tests.
globalThis.FormData = class TestFormData {
  fields = new Map();
  append(name, value) { this.fields.set(name, value); }
  get(name) { return this.fields.get(name); }
};

test('uploads an audio URI and returns trimmed transcription text', async () => {
  let request;
  const text = await transcribeAudio('file:///cache/recording.m4a', {
    apiUrl: 'https://example.test/speech-to-text',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, json: async () => ({ text: '  乌龙茶  ' }) };
    },
  });

  assert.equal(text, '乌龙茶');
  assert.equal(request.url, 'https://example.test/speech-to-text');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Accept, 'application/json');
  const audio = request.init.body.get('audio');
  assert.deepEqual(audio, { uri: 'file:///cache/recording.m4a', name: 'recording.m4a', type: 'audio/m4a' });
});

test('allows upload filename and MIME type overrides', async () => {
  let request;
  await transcribeAudio('file:///cache/recording.wav', {
    apiUrl: 'https://example.test/stt',
    filename: 'voice.wav',
    mimeType: 'audio/wav',
    fetchImpl: async (_url, init) => {
      request = init;
      return { ok: true, status: 200, json: async () => ({ text: '物品' }) };
    },
  });
  assert.deepEqual(request.body.get('audio'), { uri: 'file:///cache/recording.wav', name: 'voice.wav', type: 'audio/wav' });
});

test('web recordings upload actual bytes instead of a native URI descriptor', async () => {
  const signal = new AbortController().signal;
  const text = await transcribeAudio('blob:recording', {
    apiUrl: 'https://example.test/stt', web: true, signal,
    fetchImpl: async (url, init) => {
      assert.equal(init.signal, signal);
      if (url === 'blob:recording') return new Response(new Blob(['voice'], { type: 'audio/webm' }));
      assert.equal(await init.body.get('audio').text(), 'voice');
      return Response.json({ text: '茶叶' });
    },
  });
  assert.equal(text, '茶叶');
});

test('fails clearly when the API URL is not configured', async () => {
  await assert.rejects(() => transcribeAudio('file:///cache/recording.m4a', { apiUrl: '' }), /Speech API URL is not configured/);
});

test('surfaces HTTP failures from the transcription endpoint', async () => {
  await assert.rejects(
    () => transcribeAudio('file:///cache/recording.m4a', {
      apiUrl: 'https://example.test/speech-to-text',
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'busy' }) }),
    }),
    /Speech API request failed \(503\)/,
  );
});

test('rejects malformed or empty transcription responses', async () => {
  const options = {
    apiUrl: 'https://example.test/speech-to-text',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ text: '  ' }) }),
  };
  await assert.rejects(() => transcribeAudio('file:///cache/recording.m4a', options), /response did not include text/);
  await assert.rejects(() => transcribeAudio('file:///cache/recording.m4a', {
    ...options,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  }), /response did not include text/);
});

test('rejects a missing audio URI before making a request', async () => {
  await assert.rejects(() => transcribeAudio('  ', { apiUrl: 'https://example.test/speech-to-text' }), /audio URI is required/);
});

test('reports invalid JSON and preserves transport failures', async () => {
  await assert.rejects(() => transcribeAudio('file:///cache/recording.m4a', {
    apiUrl: 'https://example.test/speech-to-text',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('invalid'); } }),
  }), /invalid JSON/);
  const networkError = new TypeError('Network request failed');
  await assert.rejects(() => transcribeAudio('file:///cache/recording.m4a', {
    apiUrl: 'https://example.test/speech-to-text',
    fetchImpl: async () => { throw networkError; },
  }), error => error === networkError);
});
