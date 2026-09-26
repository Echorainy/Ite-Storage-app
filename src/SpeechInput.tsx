import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { transcribeAudio } from './speech';
import { Button, s } from './ui';

export function SpeechInput({ onApply }: { onApply: (text: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'recording' | 'uploading'>('idle');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const cancel = () => {
    generation.current++;
    clearTimeout(timer.current);
    request.current?.abort();
    void recorder.stop().catch(() => undefined);
    void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    busy.current = false;
  };
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') { cancel(); setPhase('idle'); }
    });
    return () => { listener.remove(); cancel(); };
  }, [recorder]);

  const finish = async (id: number) => {
    if (busy.current || id !== generation.current) return;
    busy.current = true;
    clearTimeout(timer.current);
    setPhase('uploading');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (id !== generation.current) return;
      if (!recorder.uri) throw new Error('empty recording');
      const result = await transcribeAudio(recorder.uri, { web: Platform.OS === 'web', signal: controller.signal });
      if (id === generation.current) setText(result);
    } catch {
      if (id === generation.current) setError('未能识别语音，请检查网络后重试，也可以直接输入名称。');
    } finally {
      clearTimeout(timeout);
      if (id === generation.current) { busy.current = false; setPhase('idle'); }
    }
  };
  const start = async () => {
    if (busy.current) return;
    if (!process.env.EXPO_PUBLIC_SPEECH_API_URL?.trim()) { setError('语音服务尚未连接，请先手动输入。'); return; }
    busy.current = true;
    const id = ++generation.current;
    let started = false;
    setPhase('preparing'); setError(''); setText('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (id !== generation.current) return;
      if (!permission.granted) { setError('请在系统设置中允许麦克风权限，或直接输入名称。'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (id !== generation.current) { await recorder.stop(); return; }
      recorder.record();
      started = true;
      setPhase('recording');
      timer.current = setTimeout(() => void finish(id), 15_000);
    } catch { if (id === generation.current) setError('无法启动录音，请检查麦克风权限。'); }
    finally {
      if (id === generation.current) {
        busy.current = false;
        if (!started) { setPhase('idle'); void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined); }
      }
    }
  };
  return <View style={{ gap: 8, marginVertical: 8 }}>
    <Button secondary icon={phase === 'recording' ? 'square' : 'mic'} title={phase === 'recording' ? '停止并识别' : phase === 'preparing' ? '正在准备录音…' : phase === 'uploading' ? '正在识别…' : '语音填写名称'} disabled={phase === 'preparing' || phase === 'uploading'} onPress={() => void (phase === 'recording' ? finish(generation.current) : start())} />
    <Text style={s.sectionCaption}>{phase === 'recording' ? '请说出物品名称，最多录音 15 秒。' : '录音将上传到云端转文字，请仅说物品名称。'}</Text>
    {phase !== 'idle' && <Button secondary title="取消语音录入" onPress={() => { cancel(); setPhase('idle'); }} />}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!text && <><Text selectable style={s.label}>识别结果：{text}</Text><Button secondary title="使用这个名称" onPress={() => { onApply(text); setText(''); }} /></>}
  </View>;
}
