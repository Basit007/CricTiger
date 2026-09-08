
export function speak(text: string, rate: number = 0.9, pitch: number = 1.0) {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Try to find a good English voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.name.includes('Google UK English Male') || 
    v.name.includes('Male') || 
    v.lang.startsWith('en-GB')
  ) || voices.find(v => v.lang.startsWith('en'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

/**
 * Plays raw PCM audio from a base64 string.
 * Gemini TTS returns raw PCM (linear16) at 24000Hz.
 */
export async function playBase64Audio(base64Data: string, sampleRate: number = 24000) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert Int16Array to Float32Array (normalized -1.0 to 1.0)
    const int16Buffer = new Int16Array(bytes.buffer);
    const float32Buffer = new Float32Array(int16Buffer.length);
    for (let i = 0; i < int16Buffer.length; i++) {
        float32Buffer[i] = int16Buffer[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32Buffer.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Buffer);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    source.start();
    
    // Cleanup context when finished
    source.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error("Error playing audio:", error);
    audioContext.close();
  }
}
