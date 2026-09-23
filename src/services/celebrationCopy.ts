import type { Celebration } from './celebration';

// What the full-screen celebration says. Calm and without pressure: no
// exclamation marks, no next goal, nothing about tomorrow.
export type CelebrationCopy = {
  // The big number: always the current Streak, so it matches Home.
  number: string;
  headline: string;
  line: string;
  // An extra line when a Milestone day also passes the Longest streak.
  longest: string | null;
  // The whole message as one sentence for screen readers, in visible order.
  spoken: string;
};

const MILESTONES: Record<number, { headline: string; line: string }> = {
  3: { headline: '3日、続きました。', line: '一文ずつ、あなたのペースで。' },
  7: { headline: '1週間、続きました。', line: '毎日の一文が、ここに残っています。' },
  14: { headline: '2週間、続きました。', line: '書くことが、日々になじんできました。' },
  30: { headline: 'ひと月、続きました。', line: '一文ずつ、日々がかたちになりました。' },
  50: { headline: '50日、続きました。', line: 'ふり返れる日々が、増えてきました。' },
  100: { headline: '100日、続きました。', line: 'どの一文も、その日だけのことばです。' },
  200: { headline: '200日、続きました。', line: 'いくつもの季節を、一文ずつ。' },
  365: { headline: '1年、続きました。', line: '1年分の日々が、ここにあります。' },
};

function milestoneCopy(milestone: number): { headline: string; line: string } {
  return (
    MILESTONES[milestone] ?? {
      headline: `${milestone}日、続きました。`,
      line: '一文ずつ、日々を重ねてきました。',
    }
  );
}

export function celebrationCopy(c: Celebration): CelebrationCopy {
  const { headline, line } =
    c.milestone !== null
      ? milestoneCopy(c.milestone)
      : {
          headline: 'いちばん長く続いています。',
          line: `これまでの最長記録は${c.previousLongest}日でした。`,
        };
  const longest =
    c.milestone !== null && c.previousLongest !== null
      ? `これまでの最長記録（${c.previousLongest}日）を超えました。`
      : null;
  return {
    number: String(c.streak),
    headline,
    line,
    longest,
    spoken: `${c.streak}日連続。${headline}${line}${longest ?? ''}`,
  };
}
