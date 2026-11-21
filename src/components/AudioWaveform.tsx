import { PttState } from '../types/ledger';

interface AudioWaveformProps {
  pttState: PttState;
  isSpeaking: boolean;
  compact?: boolean;
}

const BAR_HEIGHTS = [14, 22, 30, 20, 28, 18, 12];
const COMPACT_BAR_HEIGHTS = [10, 16, 20, 14, 18];

export function AudioWaveform({ pttState, isSpeaking, compact = false }: AudioWaveformProps) {
  const isListening = pttState === 'Listening';
  const isProcessing = pttState === 'Processing';
  const activeMode = isListening
    ? 'listening'
    : isProcessing
      ? 'processing'
      : isSpeaking
        ? 'speaking'
        : 'idle';

  const heights = compact ? COMPACT_BAR_HEIGHTS : BAR_HEIGHTS;

  const barColor =
    activeMode === 'listening'
      ? 'bg-red-600 dark:bg-red-500'
      : activeMode === 'processing'
        ? 'bg-indigo-600 dark:bg-indigo-400'
        : activeMode === 'speaking'
          ? 'bg-emerald-600 dark:bg-emerald-400'
          : 'bg-slate-300 dark:bg-slate-700';

  const animClass =
    activeMode === 'listening'
      ? 'animate-wave-listen'
      : activeMode === 'processing'
        ? 'animate-wave-process'
        : activeMode === 'speaking'
          ? 'animate-wave-speak'
          : '';

  return (
    <div
      className={`inline-flex items-center justify-center ${compact ? 'gap-1 h-5' : 'gap-1.5 h-8'}`}
      aria-hidden="true"
    >
      {heights.map((h, idx) => (
        <span
          key={idx}
          style={{
            height: `${h}px`,
            animationDelay: `${idx * 90}ms`,
            transform: activeMode === 'idle' ? 'scaleY(0.35)' : undefined,
          }}
          className={`w-1 rounded-full transition-colors ${barColor} ${animClass}`}
        />
      ))}
    </div>
  );
}
