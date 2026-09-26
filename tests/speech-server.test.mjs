import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSpeech } from '../server/speech.mjs';

const request = () => {
  const body = new FormData();
  body.append('audio', new Blob(['audio'], { type: 'audio/mp4' }), 'voice.m4a');
  return new Request('http://localhost/speech-to-text', { method: 'POST', body });
};
test('transcription proxy forwards audio and keeps provider credentials on server', async () => {
  const response = await handleSpeech(request(), { apiKey: 'test-secret', fetchImpl: async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-secret');
    assert.equal(await init.body.get('file').text(), 'audio');
    assert.equal(init.body.get('model'), 'whisper-1');
    return Response.json({ text: ' 乌龙茶 ' });
  } });
  assert.deepEqual(await response.json(), { text: '乌龙茶' });
});
test('proxy rejects missing configuration, malformed input and provider failures', async () => {
  assert.equal((await handleSpeech(request(), {})).status, 503);
  const invalid = new Request('http://localhost/speech-to-text', { method: 'POST', body: new FormData() });
  assert.equal((await handleSpeech(invalid, { apiKey: 'test' })).status, 400);
  const result = await handleSpeech(request(), { apiKey: 'test', fetchImpl: async () => new Response('secret diagnostic', { status: 401 }) });
  assert.equal(result.status, 502);
  assert.doesNotMatch(await result.text(), /secret diagnostic/);
});
