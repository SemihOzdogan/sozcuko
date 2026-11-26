import Sound from 'react-native-sound';

export type DuelOutcome = 'win' | 'lose' | 'draw';

const soundByOutcome: Record<DuelOutcome, string> = {
  win: 'duel_win.wav',
  lose: 'duel_lose.wav',
  draw: 'duel_draw.wav',
};

let soundConfigured = false;

const configureSound = () => {
  if (soundConfigured) return;
  Sound.setCategory('Ambient', true);
  soundConfigured = true;
};

export const playDuelOutcomeSound = (outcome: DuelOutcome) => {
  try {
    configureSound();
    const sound = new Sound(
      soundByOutcome[outcome],
      Sound.MAIN_BUNDLE,
      error => {
        if (error) return;
        sound.setVolume(0.85);
        sound.play(() => sound.release());
      },
    );
  } catch {
    // Ses oynatılamayan cihazlarda görsel ve titreşim geri bildirimi devam eder.
  }
};
