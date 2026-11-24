import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy,
  Gamepad2,
  Award,
  Flame,
  Plus,
  ThumbsUp,
  Play,
  RotateCcw,
  CheckCircle2,
  Zap,
  Brain,
  Hash,
  Type,
  HelpCircle,
  Palette,
  Target,
  Grid3X3,
  Calculator,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../BrandMark';
import { LoadingSkeleton } from '../ErrorBoundary';

// --- PLAYABLE MINI-GAME 1: MEMORY MATCH ---
const MEMORY_SYMBOLS = ['🐅', '⚡', '🔥', '🚀', '🛡️', '💎', '🎯', '🌟'];

const MemoryGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [cards, setCards] = useState<Array<{ id: number; symbol: string; flipped: boolean; matched: boolean }>>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]
      .sort(() => Math.random() - 0.5)
      .map((symbol, idx) => ({ id: idx, symbol, flipped: false, matched: false }));
    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
    setDone(false);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  const flip = (idx: number) => {
    if (done || flippedIndices.length >= 2 || cards[idx].flipped || cards[idx].matched) return;
    const nextCards = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(nextCards);
    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [a, b] = nextFlipped;
      if (nextCards[a].symbol === nextCards[b].symbol) {
        const matchedCards = nextCards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
        setCards(matchedCards);
        setFlippedIndices([]);
        if (matchedCards.every((c) => c.matched)) {
          setDone(true);
          const score = Math.max(100, 1200 - nextMoves * 35);
          onFinish(score);
        }
      } else {
        setTimeout(() => {
          setCards((cur) => cur.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setFlippedIndices([]);
        }, 650);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span>{lang === 'ar' ? `الحركات: ${moves}` : `Moves: ${moves}`}</span>
        <button onClick={reset} className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 inline-flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> {lang === 'ar' ? 'إعادة' : 'Reset'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => flip(idx)}
            className={`aspect-square rounded-xl text-2xl font-bold flex items-center justify-center border transition-all ${
              c.flipped || c.matched
                ? 'bg-orange-500/15 border-orange-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50'
            }`}
          >
            {c.flipped || c.matched ? c.symbol : '?'}
          </button>
        ))}
      </div>
      {done && (
        <div className="text-center text-xs text-emerald-500 font-bold">
          {lang === 'ar' ? `أحسنت! تم تسجيل نتيجتك في لوحة المتصدرين` : `Completed! Score recorded on leaderboard.`}
        </div>
      )}
    </div>
  );
};

// --- PLAYABLE MINI-GAME 2: REACTION SPEED TEST ---
const ReactionGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'ready' | 'result' | 'early'>('idle');
  const [ms, setMs] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const begin = () => {
    setPhase('waiting');
    setMs(null);
    const delay = 1400 + Math.random() * 2400;
    timerRef.current = window.setTimeout(() => {
      startRef.current = performance.now();
      setPhase('ready');
    }, delay);
  };

  const tap = () => {
    if (phase === 'waiting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('early');
    } else if (phase === 'ready') {
      const diff = Math.round(performance.now() - startRef.current);
      setMs(diff);
      setPhase('result');
      const score = Math.max(50, 1000 - diff);
      onFinish(score);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <button
        type="button"
        onClick={phase === 'idle' || phase === 'result' || phase === 'early' ? begin : tap}
        className={`w-full max-w-md mx-auto h-44 rounded-2xl border font-bold text-sm transition-colors flex flex-col items-center justify-center gap-2 ${
          phase === 'ready'
            ? 'bg-emerald-500 border-emerald-400 text-white'
            : phase === 'waiting'
            ? 'bg-amber-500/15 border-amber-500 text-amber-500'
            : phase === 'early'
            ? 'bg-red-500/15 border-red-500 text-red-500'
            : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-orange-500'
        }`}
      >
        {phase === 'idle' && (lang === 'ar' ? 'اضغط لبدء اختبار سرعة الاستجابة' : 'Tap to Start Reaction Test')}
        {phase === 'waiting' && (lang === 'ar' ? 'انتظر اللون الأخضر...' : 'Wait for Green...')}
        {phase === 'ready' && (lang === 'ar' ? 'اضغط الآن!' : 'TAP NOW!')}
        {phase === 'early' && (lang === 'ar' ? 'ضغطت مبكراً! اضغط للمحاولة مجدداً' : 'Too early! Tap to retry')}
        {phase === 'result' && (
          <span className="tabular-nums text-lg">
            {ms} ms · {lang === 'ar' ? 'اضغط للعب مجدداً' : 'Tap to play again'}
          </span>
        )}
      </button>
    </div>
  );
};

// --- PLAYABLE MINI-GAME 3: TECH & GENERAL TRIVIA QUIZ ---
const TRIVIA_BANK = [
  {
    qAr: 'ما البروتوكول المستخدم في TIGER للمكالمات الفورية بالصوت والفيديو؟',
    qEn: 'Which protocol powers real-time browser audio/video calls in TIGER?',
    options: ['WebRTC', 'FTP', 'SMTP', 'Telnet'],
    correct: 0,
  },
  {
    qAr: 'أي طبقة توفر تشفير الرسائل من طرف إلى طرف في TIGER CHAT؟',
    qEn: 'Which cryptographic pairing secures E2EE messaging in TIGER CHAT?',
    options: ['MD5 + Base64', 'ECDH-P256 + AES-GCM', 'ROT13', 'HTTP Basic'],
    correct: 1,
  },
  {
    qAr: 'ما لغة الاستعلام المستخدمة مع PostgreSQL في خادم المنصة؟',
    qEn: 'Which database engine backs TIGER CONNECT persistent storage?',
    options: ['PostgreSQL', 'CSV Files', 'Local Cookies', 'INI Config'],
    correct: 0,
  },
  {
    qAr: 'ما فائدة مؤشر tabular-nums في واجهات الأرقام والجداول؟',
    qEn: 'What does CSS font-variant-numeric: tabular-nums guarantee?',
    options: ['Italic headings', 'Equal-width aligned numerals', 'Auto translation', 'Audio playback'],
    correct: 1,
  },
];

const TriviaGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const answer = (optIdx: number) => {
    const isCorrect = optIdx === TRIVIA_BANK[idx].correct;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(nextCorrect);
    if (idx + 1 >= TRIVIA_BANK.length) {
      setDone(true);
      onFinish(nextCorrect * 250);
    } else {
      setIdx(idx + 1);
    }
  };

  if (done) {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="text-base font-bold text-orange-500 tabular-nums">
          {correctCount} / {TRIVIA_BANK.length} {lang === 'ar' ? 'إجابات صحيحة' : 'Correct Answers'}
        </div>
        <button
          onClick={() => {
            setIdx(0);
            setCorrectCount(0);
            setDone(false);
          }}
          className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
        >
          {lang === 'ar' ? 'إعادة الاختبار' : 'Play Again'}
        </button>
      </div>
    );
  }

  const cur = TRIVIA_BANK[idx];
  return (
    <div className="space-y-3 max-w-lg mx-auto">
      <div className="text-xs text-zinc-500 tabular-nums">
        {idx + 1} / {TRIVIA_BANK.length}
      </div>
      <div className="text-sm font-bold">{lang === 'ar' ? cur.qAr : cur.qEn}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cur.options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => answer(i)}
            className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 text-xs font-semibold text-start"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- PLAYABLE MINI-GAME 4: WORD SCRAMBLE ---
const SCRAMBLE_WORDS = ['TIGER', 'CLOUD', 'SIGNAL', 'ORBIT', 'VAULT', 'ARENA', 'STREAM'];

const WordScrambleGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [target, setTarget] = useState('TIGER');
  const [scrambled, setScrambled] = useState('IGERT');
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);

  const nextWord = useCallback(() => {
    const w = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
    const sc = w.split('').sort(() => Math.random() - 0.5).join('');
    setTarget(w);
    setScrambled(sc === w ? w.split('').reverse().join('') : sc);
    setGuess('');
  }, []);

  useEffect(() => {
    nextWord();
  }, [nextWord]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = guess.trim().toUpperCase() === target;
    const nextScore = score + (ok ? 200 : 0);
    setScore(nextScore);
    if (round >= 4) {
      onFinish(nextScore);
      setRound(1);
      setScore(0);
      nextWord();
    } else {
      setRound(round + 1);
      nextWord();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-sm mx-auto text-center">
      <div className="text-xs text-zinc-500 tabular-nums">
        {lang === 'ar' ? `الجولة ${round}/4 · النقاط ${score}` : `Round ${round}/4 · Score ${score}`}
      </div>
      <div className="text-2xl font-mono font-extrabold tracking-widest text-orange-500">{scrambled}</div>
      <div className="flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={lang === 'ar' ? 'رتب الكلمة بالإنجليزية...' : 'Unscramble word...'}
          className="flex-1 px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 uppercase"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold">
          {lang === 'ar' ? 'تحقق' : 'Check'}
        </button>
      </div>
    </form>
  );
};

// --- PLAYABLE MINI-GAME 5: NUMBER SEQUENCE ---
const NumberSequenceGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [seq, setSeq] = useState<number[]>([2, 4, 8, 16]);
  const [answerVal, setAnswerVal] = useState(32);
  const [input, setInput] = useState('');
  const [streak, setStreak] = useState(0);

  const generateSeq = useCallback(() => {
    const start = Math.floor(Math.random() * 5) + 2;
    const step = Math.floor(Math.random() * 6) + 2;
    const arr = [start, start + step, start + step * 2, start + step * 3];
    setSeq(arr);
    setAnswerVal(start + step * 4);
    setInput('');
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(input.trim()) === answerVal) {
      const next = streak + 1;
      setStreak(next);
      if (next >= 3) {
        onFinish(next * 250);
        setStreak(0);
      }
      generateSeq();
    } else {
      onFinish(streak * 150);
      setStreak(0);
      generateSeq();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-sm mx-auto text-center">
      <div className="text-xs text-zinc-500 tabular-nums">
        {lang === 'ar' ? `أكمل المتتالية (تتابع: ${streak}/3)` : `Complete the sequence (Streak: ${streak}/3)`}
      </div>
      <div className="text-xl font-mono font-bold tracking-wider tabular-nums">
        {seq.join(' , ')} , <span className="text-orange-500">?</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="?"
          className="flex-1 px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center font-mono"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold">
          {lang === 'ar' ? 'تأكيد' : 'Submit'}
        </button>
      </div>
    </form>
  );
};

// --- PLAYABLE MINI-GAME 6: STROOP COLOR RUSH (30s) ---
const COLOR_OPTIONS = [
  { id: 'red', ar: 'أحمر', en: 'RED', cls: 'text-red-500', btn: 'bg-red-500' },
  { id: 'blue', ar: 'أزرق', en: 'BLUE', cls: 'text-sky-500', btn: 'bg-sky-500' },
  { id: 'green', ar: 'أخضر', en: 'GREEN', cls: 'text-emerald-500', btn: 'bg-emerald-500' },
  { id: 'amber', ar: 'أصفر', en: 'YELLOW', cls: 'text-amber-400', btn: 'bg-amber-400' },
];

const ColorRushGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25);
  const [score, setScore] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [inkIdx, setInkIdx] = useState(1);
  const scoreRef = useRef(0);

  const rollPrompt = useCallback(() => {
    setWordIdx(Math.floor(Math.random() * COLOR_OPTIONS.length));
    setInkIdx(Math.floor(Math.random() * COLOR_OPTIONS.length));
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          setRunning(false);
          onFinish(Math.max(20, scoreRef.current));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, onFinish]);

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(25);
    rollPrompt();
    setRunning(true);
  };

  const pickColor = (idx: number) => {
    if (!running) return;
    const delta = idx === inkIdx ? 80 : -30;
    const next = Math.max(0, scoreRef.current + delta);
    scoreRef.current = next;
    setScore(next);
    rollPrompt();
  };

  return (
    <div className="space-y-4 max-w-md mx-auto text-center">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span>{lang === 'ar' ? `الوقت: ${timeLeft}ث` : `Time: ${timeLeft}s`}</span>
        <span className="font-bold text-orange-500">{lang === 'ar' ? `النقاط: ${score}` : `Score: ${score}`}</span>
      </div>
      {!running ? (
        <div className="py-6 space-y-3">
          <p className="text-xs text-zinc-500">
            {lang === 'ar' ? 'اختر لون الحبر المكتوب به النص وليس الكلمة نفسها!' : 'Tap the INK COLOR of the word, not what the word says!'}
          </p>
          <button onClick={start} className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold">
            {timeLeft === 0 ? (lang === 'ar' ? 'لعب مجدداً' : 'Play Again') : lang === 'ar' ? 'بدء تحدي الألوان' : 'Start Color Rush'}
          </button>
        </div>
      ) : (
        <>
          <div className={`text-4xl font-display font-extrabold py-4 ${COLOR_OPTIONS[inkIdx].cls}`}>
            {lang === 'ar' ? COLOR_OPTIONS[wordIdx].ar : COLOR_OPTIONS[wordIdx].en}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_OPTIONS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => pickColor(i)}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <span className={`w-4 h-4 rounded-full ${c.btn}`} />
                <span>{lang === 'ar' ? c.ar : c.en}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- PLAYABLE MINI-GAME 7: TIGER TARGET CATCHER (20s) ---
const EmojiCatchGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [score, setScore] = useState(0);
  const [activeCell, setActiveCell] = useState<number>(0);
  const [isBomb, setIsBomb] = useState(false);
  const scoreRef = useRef(0);

  const spawnNext = useCallback(() => {
    setActiveCell(Math.floor(Math.random() * 9));
    setIsBomb(Math.random() < 0.22);
  }, []);

  useEffect(() => {
    if (!running) return;
    const countdown = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(countdown);
          setRunning(false);
          onFinish(Math.max(20, scoreRef.current));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    const mover = window.setInterval(() => spawnNext(), 780);
    return () => {
      window.clearInterval(countdown);
      window.clearInterval(mover);
    };
  }, [running, spawnNext, onFinish]);

  const hitCell = (idx: number) => {
    if (!running || idx !== activeCell) return;
    const next = Math.max(0, scoreRef.current + (isBomb ? -60 : 75));
    scoreRef.current = next;
    setScore(next);
    spawnNext();
  };

  return (
    <div className="space-y-4 max-w-xs mx-auto text-center">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span>{lang === 'ar' ? `الوقت: ${timeLeft}ث` : `Time: ${timeLeft}s`}</span>
        <span className="font-bold text-orange-500">{lang === 'ar' ? `النقاط: ${score}` : `Score: ${score}`}</span>
      </div>
      {!running ? (
        <div className="py-6 space-y-3">
          <p className="text-xs text-zinc-500">
            {lang === 'ar' ? 'اصطد النمر 🐅 وتجنب القنبلة 💣 بأسرع ما يمكن!' : 'Tap the Tiger 🐅 fast and avoid the Bomb 💣!'}
          </p>
          <button
            onClick={() => {
              scoreRef.current = 0;
              setScore(0);
              setTimeLeft(20);
              spawnNext();
              setRunning(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold"
          >
            {timeLeft === 0 ? (lang === 'ar' ? 'لعب مجدداً' : 'Play Again') : lang === 'ar' ? 'ابدأ الصيد' : 'Start Catching'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => hitCell(idx)}
              className={`aspect-square rounded-2xl border text-2xl flex items-center justify-center transition ${
                activeCell === idx
                  ? isBomb
                    ? 'bg-red-500/20 border-red-500 scale-105'
                    : 'bg-orange-500/20 border-orange-500 scale-105'
                  : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {activeCell === idx ? (isBomb ? '💣' : '🐅') : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- PLAYABLE MINI-GAME 8: XO (TIC-TAC-TOE) VS SMART TIGER AI ---
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Array<'X' | 'O' | null>): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

const TicTacToeGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [board, setBoard] = useState<Array<'X' | 'O' | null>>(Array(9).fill(null));
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const [wins, setWins] = useState(0);

  const pickAiMove = (b: Array<'X' | 'O' | null>): number => {
    const empty = b.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
    for (const sym of ['O', 'X'] as const) {
      for (const idx of empty) {
        const test = [...b];
        test[idx] = sym;
        if (checkWinner(test) === sym) return idx;
      }
    }
    if (b[4] === null) return 4;
    return empty[Math.floor(Math.random() * empty.length)];
  };

  const playCell = (idx: number) => {
    if (board[idx] || winner) return;
    const next = [...board];
    next[idx] = 'X';
    const res1 = checkWinner(next);
    if (res1) {
      setBoard(next);
      setWinner(res1);
      if (res1 === 'X') {
        const nextWins = wins + 1;
        setWins(nextWins);
        onFinish(350 + nextWins * 100);
      } else {
        onFinish(120);
      }
      return;
    }
    const aiIdx = pickAiMove(next);
    if (aiIdx !== undefined) next[aiIdx] = 'O';
    const res2 = checkWinner(next);
    setBoard(next);
    if (res2) {
      setWinner(res2);
      onFinish(res2 === 'draw' ? 150 : 60);
    }
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
  };

  return (
    <div className="space-y-4 max-w-xs mx-auto text-center">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span>{lang === 'ar' ? `انتصاراتك: ${wins}` : `Your Wins: ${wins}`}</span>
        <button onClick={reset} className="px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 inline-flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> {lang === 'ar' ? 'جولة جديدة' : 'New Round'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => playCell(idx)}
            className={`aspect-square rounded-2xl border text-2xl font-display font-extrabold flex items-center justify-center ${
              cell === 'X'
                ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                : cell === 'O'
                ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-orange-500/50'
            }`}
          >
            {cell}
          </button>
        ))}
      </div>
      {winner && (
        <div className="text-xs font-bold text-orange-500">
          {winner === 'X'
            ? lang === 'ar' ? 'فزت على الذكاء الاصطناعي! 🎉' : 'You beat Tiger AI! 🎉'
            : winner === 'O'
            ? lang === 'ar' ? 'فاز النمر هذه المرة! جرّب مجدداً' : 'Tiger AI won this round!'
            : lang === 'ar' ? 'تعادل متكافئ!' : 'Draw match!'}
        </div>
      )}
    </div>
  );
};

// --- PLAYABLE MINI-GAME 9: QUICK MATH SPRINT (30s) ---
const MathSprintGame: React.FC<{ lang: 'ar' | 'en'; onFinish: (score: number) => void }> = ({ lang, onFinish }) => {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState({ a: 4, b: 5, op: '+', ans: 9, opts: [8, 9, 10, 11] });
  const scoreRef = useRef(0);

  const rollMath = useCallback(() => {
    const ops = ['+', '-', '×'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 14) + 2;
    let b = Math.floor(Math.random() * 12) + 2;
    if (op === '-' && a < b) [a, b] = [b, a];
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const set = new Set<number>([ans]);
    while (set.size < 4) {
      set.add(Math.max(0, ans + Math.floor(Math.random() * 9) - 4));
    }
    setQuestion({ a, b, op, ans, opts: Array.from(set).sort(() => Math.random() - 0.5) });
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          setRunning(false);
          onFinish(Math.max(20, scoreRef.current));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, onFinish]);

  const answer = (val: number) => {
    if (!running) return;
    const next = Math.max(0, scoreRef.current + (val === question.ans ? 100 : -25));
    scoreRef.current = next;
    setScore(next);
    rollMath();
  };

  return (
    <div className="space-y-4 max-w-sm mx-auto text-center">
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span>{lang === 'ar' ? `الوقت: ${timeLeft}ث` : `Time: ${timeLeft}s`}</span>
        <span className="font-bold text-orange-500">{lang === 'ar' ? `النقاط: ${score}` : `Score: ${score}`}</span>
      </div>
      {!running ? (
        <div className="py-6 space-y-3">
          <p className="text-xs text-zinc-500">
            {lang === 'ar' ? 'حل أكبر عدد من المسائل الحسابية خلال 30 ثانية!' : 'Solve as many math equations as possible in 30s!'}
          </p>
          <button
            onClick={() => {
              scoreRef.current = 0;
              setScore(0);
              setTimeLeft(30);
              rollMath();
              setRunning(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold"
          >
            {timeLeft === 0 ? (lang === 'ar' ? 'لعب مجدداً' : 'Play Again') : lang === 'ar' ? 'ابدأ سباق الحساب' : 'Start Math Sprint'}
          </button>
        </div>
      ) : (
        <>
          <div className="text-3xl font-mono font-extrabold py-3 tabular-nums">
            {question.a} {question.op} {question.b} = <span className="text-orange-500">?</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {question.opts.map((opt) => (
              <button
                key={opt}
                onClick={() => answer(opt)}
                className="py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 font-mono font-bold text-base tabular-nums"
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const EngagementView: React.FC<{ initialTab?: 'progress' | 'arena' | 'games' }> = ({
  initialTab = 'progress',
}) => {
  const { lang, notifyToast, refreshUser } = useAuth();
  const [tab, setTab] = useState<'progress' | 'arena' | 'games'>(initialTab);
  const [loading, setLoading] = useState(true);

  const [progressData, setProgressData] = useState<any>(null);
  const [challengesList, setChallengesList] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Challenge creation / submission
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chType, setChType] = useState('creativity');
  const [subInputs, setSubInputs] = useState<Record<number, string>>({});

  // Games
  const [activeGame, setActiveGame] = useState<
    'memory' | 'reaction' | 'trivia' | 'word' | 'number' | 'color_rush' | 'emoji_catch' | 'tictactoe' | 'math_sprint'
  >('memory');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prog, chs, lb] = await Promise.all([
        apiFetch('/api/engagement/progress'),
        apiFetch<{ challenges: any[] }>('/api/engagement/challenges'),
        apiFetch<{ leaderboard: any[] }>('/api/engagement/games/leaderboard'),
      ]);
      setProgressData(prog);
      setChallengesList(chs.challenges || []);
      setLeaderboard(lb.leaderboard || []);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load engagement data', 'error');
    } finally {
      setLoading(false);
    }
  }, [notifyToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const submitGameScore = async (gameKey: string, score: number) => {
    try {
      await apiFetch('/api/engagement/games/score', {
        method: 'POST',
        body: JSON.stringify({ gameKey, score }),
      });
      notifyToast(
        lang === 'ar' ? `تم حفظ نتيجتك (${score} نقطة) وإضافة +15 XP` : `Score (${score}) saved & +15 XP awarded!`,
        'success'
      );
      await Promise.all([loadAll(), refreshUser()]);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to save score', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-display font-bold">
          {tab === 'progress'
            ? lang === 'ar'
              ? 'التقدم والإنجازات والسلاسل'
              : 'XP, Streaks & Leaderboard'
            : tab === 'arena'
            ? 'TIGER ARENA'
            : 'TIGER GAMES'}
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { key: 'progress', ar: 'التقدم والمستوى', en: 'Progress', icon: Award },
            { key: 'arena', ar: 'ساحة التحديات', en: 'Tiger Arena', icon: Trophy },
            { key: 'games', ar: 'الألعاب المصغرة', en: 'Mini Games', icon: Gamepad2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  tab === item.key ? 'bg-orange-500 text-white' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? item.ar : item.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PROGRESS & ACHIEVEMENTS */}
      {tab === 'progress' && progressData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'نقاط الخبرة' : 'Total XP'}</div>
              <div className="text-2xl font-display font-extrabold text-orange-500 mt-1">
                {progressData.profile.xp}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{progressData.profile.level}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'سلسلة النشاط' : 'Active Streak'}</div>
              <div className="text-2xl font-display font-extrabold text-emerald-500 mt-1 inline-flex items-center gap-1.5">
                <Flame className="w-5 h-5" /> {progressData.profile.streakDays}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {lang === 'ar' ? `الأعلى: ${progressData.profile.longestStreak}` : `Best: ${progressData.profile.longestStreak}`}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'عملات TIGER' : 'Tiger Coins'}</div>
              <div className="text-2xl font-display font-extrabold text-amber-500 mt-1">
                {progressData.profile.coins}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'الإنجازات المفتوحة' : 'Achievements'}</div>
              <div className="text-2xl font-display font-extrabold mt-1">
                {progressData.achievements?.length || 0}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'إنجازاتي' : 'Unlocked Achievements'}</h3>
              {progressData.achievements?.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  {lang === 'ar' ? 'شارك في المنشورات والدروس والتحديات لفتح الأوسمة!' : 'Post, learn & join challenges to unlock badges!'}
                </p>
              ) : (
                <div className="space-y-2">
                  {progressData.achievements.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">{a.title}</div>
                        <div className="text-[11px] text-zinc-500">{a.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'لوحة المتصدرين (XP)' : 'Global XP Leaderboard'}</h3>
              <div className="space-y-2 tabular-nums">
                {(progressData.leaderboard || []).map((row: any) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 font-mono font-bold text-orange-500">#{row.rank}</span>
                      <UserAvatar src={row.user?.avatarUrl} name={row.user?.displayName || 'U'} size="xs" />
                      <span className="font-semibold truncate">{row.user?.displayName || `User #${row.userId}`}</span>
                    </div>
                    <span className="font-mono font-bold">{row.xp} XP · {row.level}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TIGER ARENA */}
      {tab === 'arena' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {lang === 'ar'
                ? 'أنشئ تحدياً للمجتمع أو شارك بإبداعك وصوّت لأفضل المشاركات'
                : 'Create community challenges, submit your work & vote for entries'}
            </p>
            <button
              onClick={() => setShowCreateChallenge((v) => !v)}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'تحدي جديد' : 'New Challenge'}
            </button>
          </div>

          {showCreateChallenge && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <input
                value={chTitle}
                onChange={(e) => setChTitle(e.target.value)}
                placeholder={lang === 'ar' ? 'عنوان التحدي...' : 'Challenge title...'}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <textarea
                value={chDesc}
                onChange={(e) => setChDesc(e.target.value)}
                rows={2}
                placeholder={lang === 'ar' ? 'وصف التحدي وشروطه...' : 'Challenge prompt & rules...'}
                className="w-full px-3 py-2 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <div className="flex items-center gap-2">
                <select
                  value={chType}
                  onChange={(e) => setChType(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="creativity">{lang === 'ar' ? 'إبداع وكتابة' : 'Creativity'}</option>
                  <option value="coding">{lang === 'ar' ? 'برمجة وتقنية' : 'Coding'}</option>
                  <option value="knowledge">{lang === 'ar' ? 'معرفة وتعليم' : 'Knowledge'}</option>
                  <option value="photo">{lang === 'ar' ? 'تصوير وتصميم' : 'Design & Photo'}</option>
                </select>
                <button
                  onClick={async () => {
                    if (!chTitle.trim() || !chDesc.trim()) return;
                    try {
                      await apiFetch('/api/engagement/challenges', {
                        method: 'POST',
                        body: JSON.stringify({ title: chTitle, description: chDesc, challengeType: chType }),
                      });
                      setChTitle('');
                      setChDesc('');
                      setShowCreateChallenge(false);
                      await loadAll();
                      notifyToast(lang === 'ar' ? 'تم إطلاق التحدي' : 'Challenge launched', 'success');
                    } catch (err: any) {
                      notifyToast(err?.message || 'Failed to create challenge', 'error');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                >
                  {lang === 'ar' ? 'نشر التحدي' : 'Launch'}
                </button>
              </div>
            </div>
          )}

          {challengesList.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد تحديات حالياً. كن أول من يطلق تحدياً في الساحة!' : 'No challenges yet. Launch the first Arena challenge!'}
            </div>
          ) : (
            <div className="space-y-4">
              {challengesList.map((ch) => (
                <div key={ch.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-orange-500 font-semibold tabular-nums">
                        {ch.challengeType} · +{ch.xpReward} XP · +{ch.coinsReward} Coins
                      </div>
                      <h3 className="text-base font-bold mt-0.5">{ch.title}</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{ch.description}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={subInputs[ch.id] || ''}
                      onChange={(e) => setSubInputs((prev) => ({ ...prev, [ch.id]: e.target.value }))}
                      placeholder={lang === 'ar' ? 'أضف مشاركتك في التحدي...' : 'Submit your entry...'}
                      className="flex-1 px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <button
                      onClick={async () => {
                        const val = (subInputs[ch.id] || '').trim();
                        if (!val) return;
                        try {
                          await apiFetch(`/api/engagement/challenges/${ch.id}/submit`, {
                            method: 'POST',
                            body: JSON.stringify({ content: val }),
                          });
                          setSubInputs((prev) => ({ ...prev, [ch.id]: '' }));
                          await Promise.all([loadAll(), refreshUser()]);
                          notifyToast(lang === 'ar' ? 'تم تسجيل مشاركتك' : 'Entry submitted!', 'success');
                        } catch (err: any) {
                          notifyToast(err?.message || 'Submission failed', 'error');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                    >
                      {lang === 'ar' ? 'مشاركة' : 'Submit'}
                    </button>
                  </div>

                  {ch.submissions?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      {ch.submissions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold">{s.author?.displayName}</div>
                            <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">{s.content}</p>
                          </div>
                          <button
                            onClick={() =>
                              void apiFetch(`/api/engagement/submissions/${s.id}/vote`, { method: 'POST' })
                                .then(() => loadAll())
                                .catch((err: any) => notifyToast(err?.message || 'Vote failed', 'error'))
                            }
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums shrink-0 ${
                              s.hasVoted
                                ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                                : 'border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>{s.votesCount}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MINI GAMES */}
      {tab === 'games' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'memory', ar: 'مطابقة الذاكرة', en: 'Memory Match', icon: Brain },
                { key: 'reaction', ar: 'سرعة الاستجابة', en: 'Reaction Speed', icon: Zap },
                { key: 'color_rush', ar: 'تحدي الألوان', en: 'Color Rush', icon: Palette },
                { key: 'emoji_catch', ar: 'اصطياد النمر', en: 'Tiger Catch', icon: Target },
                { key: 'tictactoe', ar: 'XO ضد الذكاء', en: 'XO vs AI', icon: Grid3X3 },
                { key: 'math_sprint', ar: 'سباق الحساب', en: 'Math Sprint', icon: Calculator },
                { key: 'trivia', ar: 'اختبار المعرفة', en: 'Trivia Quiz', icon: HelpCircle },
                { key: 'word', ar: 'ترتيب الكلمات', en: 'Word Scramble', icon: Type },
                { key: 'number', ar: 'المتتالية الرقمية', en: 'Number Seq', icon: Hash },
              ].map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.key}
                    onClick={() => setActiveGame(g.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                      activeGame === g.key
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? g.ar : g.en}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              {activeGame === 'memory' && <MemoryGame lang={lang} onFinish={(s) => void submitGameScore('memory', s)} />}
              {activeGame === 'reaction' && <ReactionGame lang={lang} onFinish={(s) => void submitGameScore('reaction', s)} />}
              {activeGame === 'color_rush' && <ColorRushGame lang={lang} onFinish={(s) => void submitGameScore('color_rush', s)} />}
              {activeGame === 'emoji_catch' && <EmojiCatchGame lang={lang} onFinish={(s) => void submitGameScore('emoji_catch', s)} />}
              {activeGame === 'tictactoe' && <TicTacToeGame lang={lang} onFinish={(s) => void submitGameScore('tictactoe', s)} />}
              {activeGame === 'math_sprint' && <MathSprintGame lang={lang} onFinish={(s) => void submitGameScore('math_sprint', s)} />}
              {activeGame === 'trivia' && <TriviaGame lang={lang} onFinish={(s) => void submitGameScore('trivia', s)} />}
              {activeGame === 'word' && <WordScrambleGame lang={lang} onFinish={(s) => void submitGameScore('word', s)} />}
              {activeGame === 'number' && <NumberSequenceGame lang={lang} onFinish={(s) => void submitGameScore('number', s)} />}
            </div>
          </div>

          {/* Game Leaderboard */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Play className="w-4 h-4 text-orange-500" />
              {lang === 'ar' ? 'أعلى النتائج المسجلة' : 'Top Game Scores'}
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-500">{lang === 'ar' ? 'العب أول جولة لتظهر هنا' : 'Play a round to set the first score'}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto tabular-nums">
                {leaderboard.slice(0, 15).map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        #{i + 1} {r.player?.displayName || 'Player'}
                      </div>
                      <div className="text-[11px] text-zinc-500 uppercase">{r.gameKey}</div>
                    </div>
                    <span className="font-mono font-bold text-orange-500">{r.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
