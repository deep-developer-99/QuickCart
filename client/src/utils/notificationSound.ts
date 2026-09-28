let audioContext: AudioContext | null = null;

export const playNotificationSound = () => {
  try {
    audioContext ??= new AudioContext();

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } catch (error) {
    console.warn("Notification sound could not be played:", error);
  }
};
