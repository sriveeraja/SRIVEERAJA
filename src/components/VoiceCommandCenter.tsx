import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  Customer,
  DetectedLanguage,
  InsightResponse,
  LanguageMode,
  PendingTransactionDraft,
  PttState,
  Transaction,
  TransactionType,
} from '../types/ledger';
import {
  LANGUAGE_OPTIONS,
  formatINR,
  getConfirmationCopy,
  getDisambiguationCopy,
  getLanguageLabel,
  resolveActiveLanguage,
} from '../utils/localization';
import { computeCustomerBalance, QUICK_TEST_COMMANDS, QuickTestCommand } from '../utils/seedData';
import { AudioWaveform } from './AudioWaveform';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

interface VoiceCommandCenterProps {
  pttState: PttState;
  isSpeaking: boolean;
  languageMode: LanguageMode;
  onLanguageModeChange: (mode: LanguageMode) => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onSetPttState: (state: PttState) => void;
  onSubmitCommand: (text: string) => void;
  disambiguationCandidates: Customer[];
  disambiguationQueryName: string;
  disambiguationDetectedLang: DetectedLanguage;
  onSelectDisambiguation: (customer: Customer) => void;
  pendingDraft: PendingTransactionDraft | null;
  customers: Customer[];
  transactions: Transaction[];
  onConfirmDraft: (draft: PendingTransactionDraft) => void;
  onUpdatePendingDraft: (updated: PendingTransactionDraft) => void;
  onCancelPending: () => void;
  errorMessage: string;
  unmatchedCustomerName: string;
  onQuickCreateCustomer: (name: string) => void;
  onSelectFallbackCustomer: (customer: Customer) => void;
  prefillCommand?: string;
  onClearPrefillCommand?: () => void;
  activeCustomer: Customer | null;
  onClearActiveCustomer: () => void;
  insightResponse: InsightResponse | null;
  onDismissInsight: () => void;
  onTriggerDailySummary: () => void;
}

function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function VoiceCommandCenter({
  pttState,
  isSpeaking,
  languageMode,
  onLanguageModeChange,
  ttsEnabled,
  onToggleTts,
  onSetPttState,
  onSubmitCommand,
  disambiguationCandidates,
  disambiguationQueryName,
  disambiguationDetectedLang,
  onSelectDisambiguation,
  pendingDraft,
  customers,
  transactions,
  onConfirmDraft,
  onUpdatePendingDraft,
  onCancelPending,
  errorMessage,
  unmatchedCustomerName,
  onQuickCreateCustomer,
  onSelectFallbackCustomer,
  prefillCommand = '',
  onClearPrefillCommand,
  activeCustomer,
  onClearActiveCustomer,
  insightResponse,
  onDismissInsight,
  onTriggerDailySummary,
}: VoiceCommandCenterProps) {
  const [textInput, setTextInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micMode, setMicMode] = useState<'hold' | 'tap'>('tap');
  const [speechNotice, setSpeechNotice] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('Parsing command with Gemini...');
  const [isEditingDraft, setIsEditingDraft] = useState(false);

  const [editCustomerId, setEditCustomerId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<TransactionType>('CREDIT');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const isListeningRef = useRef(false);
  const isStartingMicRef = useRef(false);
  const shouldCommitRef = useRef(true);
  const pendingActionOnStartRef = useRef<'none' | 'stop' | 'cancel'>('none');
  const pressStartMsRef = useRef(0);
  const transcriptRef = useRef('');
  const spaceHeldRef = useRef(false);
  const cardTopRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canRecordAudio =
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';
  const speechSupported = canRecordAudio || Boolean(getSpeechRecognitionCtor());

  useEffect(() => {
    if (prefillCommand) {
      setTextInput(prefillCommand);
      inputRef.current?.focus();
      onClearPrefillCommand?.();
    }
  }, [prefillCommand, onClearPrefillCommand]);

  useEffect(() => {
    if (pendingDraft) {
      setIsEditingDraft(false);
      setEditCustomerId(pendingDraft.customerId);
      setEditAmount(String(pendingDraft.amount));
      setEditType(pendingDraft.type);
      setEditDate(pendingDraft.date);
      setEditNote(pendingDraft.note);
    }
  }, [pendingDraft]);

  useEffect(() => {
    if (pttState !== 'Processing') {
      setProcessingLabel('Parsing command with Gemini...');
    }
  }, [pttState]);

  const cleanupAudioHardware = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (levelRafRef.current !== null) {
      window.cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMicLevel(0);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    return () => {
      shouldCommitRef.current = false;
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      cleanupAudioHardware();
    };
  }, []);

  const stopListening = (commit: boolean) => {
    shouldCommitRef.current = commit;

    // If getUserMedia is still awaiting permission/stream, defer action until it resolves
    if (isStartingMicRef.current && !isListeningRef.current) {
      pendingActionOnStartRef.current = commit ? 'stop' : 'cancel';
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      isListeningRef.current = false;
      try {
        recorder.stop();
      } catch {
        cleanupAudioHardware();
        onSetPttState('Idle');
      }
      if (!commit) {
        setLiveTranscript('');
        onSetPttState('Idle');
      }
      return;
    }

    const rec = recognitionRef.current;
    if (rec && isListeningRef.current) {
      isListeningRef.current = false;
      try {
        if (commit) {
          rec.stop();
        } else {
          rec.abort();
        }
      } catch {
        // ignore
      }
      if (!commit) {
        transcriptRef.current = '';
        setLiveTranscript('');
        onSetPttState('Idle');
      }
    }
  };

  const startWebSpeechFallback = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechNotice('Microphone is unavailable in this browser. Use the text command bar or Quick Test chips below.');
      onSetPttState('Idle');
      return;
    }

    try {
      const rec = new Ctor();
      const selectedOpt = LANGUAGE_OPTIONS.find((o) => o.id === languageMode);
      rec.lang = selectedOpt?.speechLang || 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      isListeningRef.current = true;
      onSetPttState('Listening');

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let finalText = '';
        let interimText = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalText += `${text} `;
          } else {
            interimText += `${text} `;
          }
        }
        const combined = `${finalText}${interimText}`.trim();
        transcriptRef.current = combined;
        setLiveTranscript(combined);
        if (combined) {
          setTextInput(combined);
        }
      };

      rec.onerror = (event) => {
        isListeningRef.current = false;
        const code = event?.error || 'unknown';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setSpeechNotice('Microphone permission blocked. Allow mic access in browser settings or type below.');
        } else if (code === 'no-speech') {
          setSpeechNotice('No speech detected. Tap the mic and speak clearly.');
        } else if (code !== 'aborted') {
          setSpeechNotice(`Voice input error (${code}). You can type your command below.`);
        }
        onSetPttState('Idle');
      };

      rec.onend = () => {
        const wasListening = isListeningRef.current;
        isListeningRef.current = false;
        const captured = transcriptRef.current.trim();
        if (captured && shouldCommitRef.current) {
          onSubmitCommand(captured);
        } else if (wasListening) {
          onSetPttState('Idle');
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      isListeningRef.current = false;
      setSpeechNotice('Unable to start microphone in this browser context. Use the text command bar.');
      onSetPttState('Idle');
    }
  };

  const startListening = async () => {
    if (pttState === 'Processing' || isListeningRef.current || isStartingMicRef.current) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setSpeechNotice('');
    setLiveTranscript('');
    transcriptRef.current = '';
    shouldCommitRef.current = true;
    pendingActionOnStartRef.current = 'none';

    if (!canRecordAudio) {
      startWebSpeechFallback();
      return;
    }

    isStartingMicRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      isStartingMicRef.current = false;

      const pendingAfterPermission = pendingActionOnStartRef.current as 'none' | 'stop' | 'cancel';
      if (pendingAfterPermission === 'cancel') {
        pendingActionOnStartRef.current = 'none';
        stream.getTracks().forEach((t) => t.stop());
        onSetPttState('Idle');
        return;
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Set up real-time mic input level indicator
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateLevel = () => {
            if (!audioContextRef.current) return;
            analyser.getByteTimeDomainData(dataArray);
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const norm = (dataArray[i] - 128) / 128;
              sumSquares += norm * norm;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            setMicLevel(Math.min(100, Math.round(rms * 350)));
            levelRafRef.current = window.requestAnimationFrame(updateLevel);
          };
          levelRafRef.current = window.requestAnimationFrame(updateLevel);
        }
      } catch {
        // Level meter optional; recording continues
      }

      const preferredMime = pickSupportedAudioMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onerror = () => {
        isListeningRef.current = false;
        cleanupAudioHardware();
        setSpeechNotice('Microphone recording failed. Please check your mic or type below.');
        onSetPttState('Idle');
      };

      recorder.onstop = async () => {
        const commit = shouldCommitRef.current;
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        isListeningRef.current = false;
        cleanupAudioHardware();

        if (!commit) {
          onSetPttState('Idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 400) {
          setSpeechNotice('Recording was too short. Tap the mic, speak your command, then tap again.');
          onSetPttState('Idle');
          return;
        }

        try {
          setProcessingLabel('Transcribing voice with Gemini...');
          onSetPttState('Processing');
          const audioBase64 = await blobToBase64(audioBlob);
          const transcribeRes = await fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64,
              mimeType,
              languageMode,
            }),
          });

          const data = await transcribeRes.json();
          if (!transcribeRes.ok) {
            throw new Error(data?.error || 'Could not transcribe audio.');
          }

          const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : '';
          if (!transcript) {
            setSpeechNotice('No speech detected. Speak clearly near your microphone and try again.');
            onSetPttState('Idle');
            return;
          }

          setTextInput(transcript);
          setProcessingLabel('Parsing command with Gemini...');
          onSubmitCommand(transcript);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to transcribe microphone audio.';
          setSpeechNotice(`${msg} You can also type your command below.`);
          onSetPttState('Idle');
        }
      };

      recorder.start(200);
      isListeningRef.current = true;
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      onSetPttState('Listening');

      const pendingAfterStart = pendingActionOnStartRef.current as 'none' | 'stop' | 'cancel';
      if (pendingAfterStart === 'stop') {
        pendingActionOnStartRef.current = 'none';
        // Give user at least a moment if they stopped while permission dialog was open
        window.setTimeout(() => {
          if (isListeningRef.current) {
            stopListening(true);
          }
        }, 150);
      }
    } catch (err) {
      isStartingMicRef.current = false;
      isListeningRef.current = false;
      pendingActionOnStartRef.current = 'none';
      cleanupAudioHardware();

      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setSpeechNotice(
          'Microphone permission denied. Allow microphone access in your browser bar and try again, or type below.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setSpeechNotice(
          'No microphone device found. Connect a microphone or use the text command bar below.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setSpeechNotice(
          'Microphone is currently in use by another app or tab. Close it and try again.'
        );
      } else if (getSpeechRecognitionCtor()) {
        startWebSpeechFallback();
        return;
      } else {
        setSpeechNotice(
          'Microphone could not start in this browser context. Use the text command bar or Quick Test chips below.'
        );
      }
      onSetPttState('Idle');
    }
  };

  useEffect(() => {
    if (micMode !== 'hold') return;

    const handleGlobalRelease = () => {
      if (!isListeningRef.current && !isStartingMicRef.current) return;
      const elapsed = Date.now() - pressStartMsRef.current;
      // Only auto-stop on release if user genuinely held >= 280ms; quick click stays in tap-to-stop mode
      if (elapsed >= 280) {
        stopListening(true);
      }
    };

    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
    };
  });

  useEffect(() => {
    const isInteractiveField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isInteractiveField(e.target)) return;
      e.preventDefault();
      if (micMode === 'hold') {
        if (!spaceHeldRef.current && !isListeningRef.current && !isStartingMicRef.current) {
          spaceHeldRef.current = true;
          pressStartMsRef.current = Date.now();
          startListening();
        }
      } else {
        if (isListeningRef.current || isStartingMicRef.current) {
          stopListening(true);
        } else {
          startListening();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isInteractiveField(e.target)) return;
      if (micMode === 'hold' && spaceHeldRef.current) {
        e.preventDefault();
        spaceHeldRef.current = false;
        stopListening(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || pttState === 'Processing') return;
    onSubmitCommand(textInput.trim());
  };

  const handleQuickTest = (item: QuickTestCommand) => {
    if (pttState === 'Processing') return;
    if (item.preferredMode) {
      onLanguageModeChange(item.preferredMode);
    }
    setTextInput(item.command);
    onSubmitCommand(item.command);
  };

  const handleSaveInlineDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDraft) return;
    const customer = customers.find((c) => c.id === editCustomerId);
    const amt = Number(editAmount);
    if (!customer || !Number.isFinite(amt) || amt <= 0) return;
    onUpdatePendingDraft({
      ...pendingDraft,
      customerId: customer.id,
      customerName: customer.name,
      customerArea: customer.area,
      amount: Math.round(amt),
      type: editType,
      date: editDate || pendingDraft.date,
      note: editNote.trim(),
    });
    setIsEditingDraft(false);
  };

  const activeLangForDisambig = resolveActiveLanguage(languageMode, disambiguationDetectedLang);
  const disambigCopy = getDisambiguationCopy(
    disambiguationQueryName || 'Customer',
    activeLangForDisambig
  );

  const activeLangForConfirm = pendingDraft
    ? resolveActiveLanguage(languageMode, pendingDraft.detectedLanguage)
    : 'en';
  const confirmCopy = pendingDraft
    ? getConfirmationCopy(
        `${pendingDraft.customerName} (${pendingDraft.customerArea})`,
        pendingDraft.amount,
        pendingDraft.type,
        activeLangForConfirm
      )
    : null;

  const displayStateLabel =
    isSpeaking && pttState !== 'Listening' && pttState !== 'Processing'
      ? 'Speaking'
      : pttState;

  const stateDescription: Record<PttState, string> = {
    Idle: isSpeaking ? 'Speaking voice prompt...' : 'Ready for voice or text command',
    Listening:
      micMode === 'hold'
        ? `Listening (${formatDuration(recordingSeconds)}) · release or tap to send`
        : `Listening (${formatDuration(recordingSeconds)}) · tap mic again to send`,
    Processing: processingLabel,
    'Needs Disambiguation': isSpeaking
      ? 'Speaking disambiguation prompt...'
      : 'Multiple customers match — pick one below',
    Confirming: isSpeaking
      ? 'Speaking confirmation prompt...'
      : 'Review details before saving to khata',
    Error: 'Could not complete command — check details below',
  };

  const stateTextColor: Record<PttState, string> = {
    Idle: isSpeaking
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-slate-600 dark:text-slate-300',
    Listening: 'text-red-700 dark:text-red-400',
    Processing: 'text-indigo-700 dark:text-indigo-400',
    'Needs Disambiguation': 'text-amber-700 dark:text-amber-400',
    Confirming: 'text-slate-900 dark:text-slate-100',
    Error: 'text-red-700 dark:text-red-400',
  };

  const testCategories: QuickTestCommand['category'][] = [
    'Smart Insights',
    'Kannada',
    'Hinglish / Hindi',
    'English & Safety',
  ];

  const handlePttPointerDown = () => {
    if (pttState === 'Processing') return;
    if (micMode === 'hold') {
      if (isListeningRef.current) {
        stopListening(true);
      } else {
        pressStartMsRef.current = Date.now();
        startListening();
      }
    }
  };

  const handlePttClick = () => {
    if (pttState === 'Processing' || micMode !== 'tap') return;
    if (isListeningRef.current || isStartingMicRef.current) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  const pttButtonHandlers =
    micMode === 'hold'
      ? { onPointerDown: handlePttPointerDown }
      : { onClick: handlePttClick };

  return (
    <>
      <div
        ref={cardTopRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-6"
      >
        {/* Language & Voice Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <label htmlFor="language-selector" className="sr-only">
              Voice Language
            </label>
            <select
              id="language-selector"
              value={languageMode}
              onChange={(e) => onLanguageModeChange(e.target.value as LanguageMode)}
              className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.nativeLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMicMode('hold')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  micMode === 'hold'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Hold PTT
              </button>
              <button
                type="button"
                onClick={() => setMicMode('tap')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  micMode === 'tap'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Tap PTT
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleTts}
              aria-label={ttsEnabled ? 'Mute spoken voice prompts' : 'Enable spoken voice prompts'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                ttsEnabled
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{ttsEnabled ? 'Voice On' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* Active Customer Context & Daily Voice Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {activeCustomer ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200">
              <UserCheck className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
              <span>
                Active Customer:{' '}
                <strong className="font-semibold">
                  {activeCustomer.name} ({activeCustomer.area})
                </strong>
              </span>
              <span aria-hidden="true" className="text-indigo-400">
                ·
              </span>
              <button
                type="button"
                onClick={onClearActiveCustomer}
                className="font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              No active customer context yet
            </span>
          )}

          <button
            type="button"
            onClick={onTriggerDailySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-800 dark:hover:text-indigo-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Daily Voice Summary</span>
          </button>
        </div>

        {/* Prominent PTT Mic Anchor + Refined Waveform */}
        <div className="flex flex-col items-center text-center py-2 space-y-3.5">
          <div className="relative flex items-center justify-center">
            {pttState === 'Listening' && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
              />
            )}
            <button
              type="button"
              {...pttButtonHandlers}
              disabled={pttState === 'Processing'}
              aria-label={
                pttState === 'Listening'
                  ? 'Stop recording and parse command'
                  : 'Push to talk microphone button'
              }
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 dark:focus-visible:ring-indigo-800 ${
                pttState === 'Listening'
                  ? 'bg-red-600 text-white scale-105 shadow-md'
                  : pttState === 'Processing'
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 cursor-wait'
                    : pttState === 'Error'
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950'
                      : 'bg-indigo-700 hover:bg-indigo-800 text-white active:scale-95 shadow-sm'
              }`}
            >
              {pttState === 'Processing' ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : speechSupported ? (
                <Mic className="w-8 h-8" />
              ) : (
                <MicOff className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Refined Audio Waveform Visualizer */}
          <AudioWaveform pttState={pttState} isSpeaking={isSpeaking} />

          {pttState === 'Listening' && (
            <div className="flex items-center justify-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 dark:bg-red-500 transition-all duration-75"
                  style={{ width: `${Math.max(8, micLevel)}%` }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums text-red-700 dark:text-red-400">
                {formatDuration(recordingSeconds)}
              </span>
              <button
                type="button"
                onClick={() => stopListening(false)}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 underline"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-1">
            <div className={`text-sm font-semibold ${stateTextColor[pttState]}`}>
              {displayStateLabel} ·{' '}
              <span className="font-normal text-slate-600 dark:text-slate-400">
                {stateDescription[pttState]}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {micMode === 'hold'
                ? 'Hold mic button or Spacebar while speaking · Release to transcribe'
                : 'Tap mic button or Spacebar to start · Tap again to transcribe'}
            </p>
          </div>

          {liveTranscript && pttState === 'Listening' && (
            <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100">
              “{liveTranscript}”
            </div>
          )}

          {speechNotice && (
            <p className="w-full text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              {speechNotice}
            </p>
          )}
        </div>

        {/* Text Fallback Command Bar */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label htmlFor="text-command-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Voice Transcript or Manual Command Fallback
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="text-command-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                activeCustomer
                  ? `Follow-up for ${activeCustomer.name}: "Innu 200 add maadu" or ask a query`
                  : 'Try: "Ramesh ge 500 add maadu" or "Indina hisab heli"'
              }
              className="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || pttState === 'Processing'}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 dark:bg-indigo-700 hover:bg-slate-800 dark:hover:bg-indigo-800 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Parse</span>
            </button>
          </div>
        </form>

        {/* INSIGHT / QUERY RESPONSE CARD */}
        {insightResponse && pttState !== 'Needs Disambiguation' && pttState !== 'Confirming' && (
          <div
            className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3"
            role="status"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {insightResponse.title} · {getLanguageLabel(insightResponse.language)}
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {insightResponse.answer}
                </p>
                {insightResponse.scriptSubtitle && (
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {insightResponse.scriptSubtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onDismissInsight}
                aria-label="Dismiss insight"
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {insightResponse.highlights && insightResponse.highlights.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {insightResponse.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{h.label}</div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        h.tone === 'credit'
                          ? 'text-red-700 dark:text-red-400'
                          : h.tone === 'payment'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {h.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATE: DISAMBIGUATION CARD */}
        {pttState === 'Needs Disambiguation' && disambiguationCandidates.length > 0 && (
          <div
            className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 sm:p-5 space-y-4"
            role="region"
            aria-label="Customer Disambiguation"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Duplicate Name Check · {getLanguageLabel(activeLangForDisambig)}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
                  {disambigCopy.headline}
                </h3>
                {disambigCopy.scriptSubtitle && (
                  <p className="text-sm text-slate-700 dark:text-slate-300">{disambigCopy.scriptSubtitle}</p>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400">{disambigCopy.hint}</p>
              </div>
              <button
                type="button"
                onClick={onCancelPending}
                aria-label="Cancel disambiguation"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {disambiguationCandidates.map((cust, index) => {
                const bal = computeCustomerBalance(cust.id, transactions);
                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => onSelectDisambiguation(cust)}
                    className="w-full text-left bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-lg p-3.5 transition-colors flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-xs text-indigo-700 dark:text-indigo-400">
                          #{index + 1}
                        </span>
                        <span>{cust.name}</span>
                        <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {cust.area}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{cust.note}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{cust.phone}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Balance</div>
                      <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        ₹{formatINR(Math.abs(bal))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STATE: MANDATORY CONFIRMATION CARD */}
        {pttState === 'Confirming' && pendingDraft && confirmCopy && (
          <div
            className="bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-4"
            role="region"
            aria-label="Confirm Transaction"
          >
            {pendingDraft.anomalyWarning && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-lg p-3 flex items-start gap-2.5 text-red-900 dark:text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">
                    Unusually High Amount Alert
                  </p>
                  <p>{pendingDraft.anomalyWarning.reason}</p>
                </div>
              </div>
            )}

            {pendingDraft.duplicateWarning && (
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">
                    Possible Duplicate Entry (within 5 minutes)
                  </p>
                  <p>
                    An identical ₹{formatINR(pendingDraft.amount)}{' '}
                    {pendingDraft.type === 'CREDIT' ? 'Credit' : 'Payment'} for{' '}
                    {pendingDraft.customerName} ({pendingDraft.customerArea}) was saved{' '}
                    {pendingDraft.duplicateWarning.minutesAgo === 0
                      ? 'just now'
                      : `${pendingDraft.duplicateWarning.minutesAgo} min ago`}
                    . Confirm only if this is a second separate entry.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Confirm Before Saving
                </span>
                <span aria-hidden="true">·</span>
                <span>{getLanguageLabel(activeLangForConfirm)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Confidence {pendingDraft.confidence}%
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
                {confirmCopy.headline}
              </h3>
              {confirmCopy.scriptSubtitle && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {confirmCopy.scriptSubtitle}
                </p>
              )}
            </div>

            {isEditingDraft ? (
              <form
                onSubmit={handleSaveInlineDraft}
                className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Customer
                  </label>
                  <select
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.area} ({c.note})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEditType('CREDIT')}
                    className={`py-1.5 text-xs font-medium rounded-md ${
                      editType === 'CREDIT'
                        ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Credit · Udhaar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('PAYMENT')}
                    className={`py-1.5 text-xs font-medium rounded-md ${
                      editType === 'PAYMENT'
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Payment · Jama
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Optional item note"
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingDraft(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
                  >
                    Apply Edits
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Customer</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {pendingDraft.customerName} ({pendingDraft.customerArea})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Amount</div>
                  <div className="font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    ₹{formatINR(pendingDraft.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Type</div>
                  <div
                    className={`font-semibold ${
                      pendingDraft.type === 'CREDIT'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {pendingDraft.type === 'CREDIT' ? 'Credit · Udhaar' : 'Payment · Jama'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Date</div>
                  <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {pendingDraft.date}
                  </div>
                </div>
                {pendingDraft.note && (
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Note</div>
                    <div className="text-slate-800 dark:text-slate-200">{pendingDraft.note}</div>
                  </div>
                )}
              </div>
            )}

            {!isEditingDraft && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onConfirmDraft(pendingDraft)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDraft(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STATE: ERROR / UNMATCHED CUSTOMER RECOVERY */}
        {pttState === 'Error' && errorMessage && (
          <div
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 space-y-3"
            role="alert"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">{errorMessage}</p>
              <button
                type="button"
                onClick={onCancelPending}
                aria-label="Dismiss error"
                className="p-1 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {unmatchedCustomerName && (
              <div className="space-y-2 pt-1 border-t border-red-200 dark:border-red-900">
                <p className="text-xs text-red-800 dark:text-red-300">
                  Create a new account or assign this entry to an existing customer:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onQuickCreateCustomer(unmatchedCustomerName)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add “{unmatchedCustomerName}”</span>
                  </button>
                  {customers.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectFallbackCustomer(c)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                    >
                      {c.name} ({c.area})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Test Commands Panel */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Quick Test Commands
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click to run with Gemini
            </span>
          </div>

          <div className="space-y-3">
            {testCategories.map((category) => {
              const items = QUICK_TEST_COMMANDS.filter((q) => q.category === category);
              return (
                <div key={category} className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        title={item.description}
                        disabled={pttState === 'Processing'}
                        onClick={() => handleQuickTest(item)}
                        className="text-left px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-900 dark:hover:text-indigo-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        “{item.command}”
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile-First Bottom Sticky PTT Action Bar (<= 64px height for 15% sticky budget) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AudioWaveform pttState={pttState} isSpeaking={isSpeaking} compact />
          <div className="min-w-0">
            <div className={`text-xs font-semibold truncate ${stateTextColor[pttState]}`}>
              {displayStateLabel}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {micMode === 'hold' ? 'Hold mic to speak' : 'Tap mic to record'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(pttState === 'Needs Disambiguation' || pttState === 'Confirming') && (
            <button
              type="button"
              onClick={() => cardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg whitespace-nowrap"
            >
              Review
            </button>
          )}
          <button
            type="button"
            {...pttButtonHandlers}
            disabled={pttState === 'Processing'}
            aria-label="Mobile push to talk microphone"
            className={`h-11 px-4 rounded-full inline-flex items-center gap-2 text-sm font-medium text-white transition-transform whitespace-nowrap ${
              pttState === 'Listening'
                ? 'bg-red-600 scale-105'
                : pttState === 'Processing'
                  ? 'bg-indigo-400 cursor-wait'
                  : 'bg-indigo-700 active:scale-95'
            }`}
          >
            {pttState === 'Processing' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span>
              {pttState === 'Listening'
                ? `Stop (${formatDuration(recordingSeconds)})`
                : micMode === 'hold'
                  ? 'Hold to Talk'
                  : 'Tap to Talk'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
