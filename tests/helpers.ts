export function createSilentWav(durationSeconds = 1): File {
  const sampleRate = 16_000;
  const channelCount = 1;
  const bitsPerSample = 16;
  const dataLength = sampleRate * durationSeconds * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function text(offset: number, value: string): void {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  text(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * (bitsPerSample / 8), true);
  view.setUint16(32, channelCount * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  text(36, "data");
  view.setUint32(40, dataLength, true);

  return new File([buffer], "silence.wav", { type: "audio/wav" });
}
