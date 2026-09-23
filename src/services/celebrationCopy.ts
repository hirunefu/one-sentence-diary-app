import type { MilestoneCelebration } from './celebration';

// What a celebration says. Calm, informational feedback about the writer's own
// progress (not controlling praise):
// - no exclamation marks, no next goal, nothing about tomorrow;
// - no 「あなた」 (Apple's Japanese HIG: avoid possessive pronouns);
// - no requests such as 「この調子で」 or 「続けましょう」, no comparison with others;
// - never claim a habit has formed (「習慣になりました」): habits form gradually
//   and at very different speeds (Lally et al. 2010);
// - every line has a 「、」, where it can wrap at large font sizes.
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
  3: { headline: '3日、続きました。', line: '一文ずつ、自分のペースで。' },
  7: { headline: '1週間、続きました。', line: '毎日の一文が、ここに残っています。' },
  14: { headline: '2週間、続きました。', line: '書くことが、日々になじんできました。' },
  30: { headline: 'ひと月、続きました。', line: '一文ずつ、日々がかたちになりました。' },
  50: { headline: '50日、続きました。', line: 'ふり返れる日々が、増えてきました。' },
  100: { headline: '100日、続きました。', line: 'どの一文も、その日だけのことばです。' },
  200: { headline: '200日、続きました。', line: 'いくつもの季節を、一文ずつ。' },
  365: { headline: '1年、続きました。', line: '1年分の日々が、ここにあります。' },
  1000: { headline: '1000日、続きました。', line: '1000日分の一文が、ここにあります。' },
};

function milestoneCopy(milestone: number): { headline: string; line: string } {
  return (
    MILESTONES[milestone] ?? {
      headline: `${milestone}日、続きました。`,
      line: '一文ずつ、日々を重ねてきました。',
    }
  );
}

// The full-screen celebration of a Milestone.
export function celebrationCopy(c: MilestoneCelebration): CelebrationCopy {
  const { headline, line } = milestoneCopy(c.milestone);
  const longest =
    c.previousLongest !== null ? `最長記録だった${c.previousLongest}日を、超えました。` : null;
  return {
    number: String(c.streak),
    headline,
    line,
    longest,
    spoken: `${c.streak}日連続。${headline}${line}${longest ?? ''}`,
  };
}

// The quiet line on Home for a day that passes the Longest streak without
// reaching a Milestone.
export function longestTodayCopy(previousLongest: number): {
  headline: string;
  line: string;
  spoken: string;
} {
  const headline = 'いちばん長く続いています。';
  const line = `これまでの最長記録は、${previousLongest}日でした。`;
  return { headline, line, spoken: `${headline}${line}` };
}
