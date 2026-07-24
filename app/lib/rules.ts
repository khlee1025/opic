import type {
  CoachIssue,
  IssueCategory,
  KoreanPlan,
} from "./types.ts";

export const MAX_RULE_ISSUES = 3 as const;

interface RuleMatch {
  start: number;
  end: number;
  original: string;
  suggestion: string;
}

interface RuleDefinition {
  id: string;
  category: IssueCategory;
  priority: 1 | 2 | 3;
  explanationKo: string;
  find: (draft: string, koreanPlan?: KoreanPlan) => RuleMatch[];
}

function matchesFromRegex(
  draft: string,
  regex: RegExp,
  suggestion: (match: RegExpExecArray) => string,
): RuleMatch[] {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const matcher = new RegExp(regex.source, flags);
  const matches: RuleMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(draft)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      original: match[0],
      suggestion: suggestion(match),
    });

    if (match[0].length === 0) matcher.lastIndex += 1;
  }

  return matches;
}

function phraseContext(draft: string, start: number, radius = 110): string {
  return draft.slice(Math.max(0, start - radius), Math.min(draft.length, start + radius));
}

function repeatedActivityContext(context: string): boolean {
  return /\b(?:I|we)\b[\s\S]*\b(?:met|saw|visited|went|played|watched|tried|returned|traveled|travelled|ate|talked|spoke|called|got together)\b/i.test(
    context,
  );
}

function lodgingContext(context: string, koreanPlan?: KoreanPlan): boolean {
  const planText = koreanPlan ? Object.values(koreanPlan).join(" ") : "";
  const combined = `${context} ${planText}`;
  const hasLodgingCue =
    /\b(?:stay(?:ed|ing)?|book(?:ed|ing)?|rent(?:ed|ing)?|trip|travel|vacation|lodging|accommodation|room|night|weekend|check(?:ed)? in)\b/i.test(
      context,
    ) || /(?:숙소|여행|예약|펜션|묵었|숙박)/.test(planText);
  const hasFinanceCue =
    /\b(?:retirement|company|state|monthly|income|fund|benefit)\s+pension\b/i.test(
      combined,
    );

  return hasLodgingCue && !hasFinanceCue;
}

function gerund(verb: string): string {
  const lower = verb.toLowerCase();
  const doubled: Record<string, string> = {
    admit: "admitting",
    begin: "beginning",
    forget: "forgetting",
    get: "getting",
    plan: "planning",
    prefer: "preferring",
    put: "putting",
    run: "running",
    shop: "shopping",
    sit: "sitting",
    stop: "stopping",
    swim: "swimming",
  };
  if (doubled[lower]) return doubled[lower];
  if (lower === "lie") return "lying";
  if (lower.endsWith("ie")) return `${lower.slice(0, -2)}ying`;
  if (lower.endsWith("e") && !lower.endsWith("ee")) return `${lower.slice(0, -1)}ing`;
  return `${lower}ing`;
}

const RULES: RuleDefinition[] = [
  {
    id: "have-plans-not-promise",
    category: "word_choice",
    priority: 2,
    explanationKo:
      '친구와 "약속이 있다"는 일정 의미이므로 have plans with가 자연스럽습니다.',
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bhad a promise with (?:my|a|an|the|our) friends?\b/gi,
        (match) => match[0].replace(/^had a promise with/i, "had plans with"),
      ),
  },
  {
    id: "work-out-not-play-exercise",
    category: "grammar",
    priority: 1,
    explanationKo:
      "exercise는 play와 함께 쓰지 않고, 구어에서는 work out이 자연스럽습니다.",
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\b(play|played|playing) exercise\b/gi,
        (match) =>
          match[1].toLowerCase() === "played"
            ? "worked out"
            : match[1].toLowerCase() === "playing"
              ? "working out"
              : "work out",
      ),
  },
  {
    id: "relieve-stress",
    category: "naturalness",
    priority: 3,
    explanationKo:
      "스트레스를 푼다는 뜻에는 release보다 relieve가 자연스럽습니다.",
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\brelease my stress\b/gi,
        () => "relieve my stress",
      ),
  },
  {
    id: "stay-healthy",
    category: "naturalness",
    priority: 3,
    explanationKo:
      "건강을 유지한다는 뜻은 회화에서 stay healthy가 자연스럽습니다.",
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bkeep my health\b/gi,
        () => "stay healthy",
      ),
  },
  {
    id: "place-to-recharge",
    category: "naturalness",
    priority: 3,
    explanationKo:
      "마음을 충전하는 장소는 charging place보다 place to recharge로 표현합니다.",
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bIt is my best charging place\b/gi,
        () => "It is the best place for me to recharge",
      ),
  },
  {
    id: "hang-out-with-friends",
    category: "naturalness",
    priority: 3,
    explanationKo:
      '성인이 친구와 시간을 보낸다는 뜻에는 play보다 hang out을 씁니다.',
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\b(play|played|playing) with (?:my|our) friends?\b/gi,
        (match) => {
          const replacement =
            match[1].toLowerCase() === "played"
              ? "hung out"
              : match[1].toLowerCase() === "playing"
                ? "hanging out"
                : "hang out";
          return match[0].replace(match[1], replacement);
        },
      ),
  },
  {
    id: "go-home-no-to",
    category: "grammar",
    priority: 1,
    explanationKo: "home이 부사처럼 쓰일 때는 go와 home 사이에 to를 넣지 않습니다.",
    find: (draft) =>
      matchesFromRegex(draft, /\bwent to home\b/gi, () => "went home"),
  },
  {
    id: "feel-unwell-not-bad-condition",
    category: "naturalness",
    priority: 2,
    explanationKo:
      '몸 상태가 좋지 않았다는 뜻은 I wasn\'t feeling well이 자연스럽습니다.',
    find: (draft) =>
      matchesFromRegex(draft, /\bmy condition was bad\b/gi, () =>
        "I wasn't feeling well",
      ),
  },
  {
    id: "take-medicine-get-rest",
    category: "word_choice",
    priority: 2,
    explanationKo:
      '약은 take, 휴식은 get some rest와 함께 쓰는 것이 자연스럽습니다.',
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bate (?:some )?medicine and took (?:a|some) rest\b/gi,
        () => "took some medicine and got some rest",
      ),
  },
  {
    id: "first-time-in-a-long-time",
    category: "naturalness",
    priority: 3,
    explanationKo:
      '오랜만에 다시 한 일은 for the first time in a long time으로 표현합니다.',
    find: (draft) =>
      matchesFromRegex(draft, /\bafter a long time\b/gi, (match) => match[0])
        .filter((match) => repeatedActivityContext(phraseContext(draft, match.start)))
        .map((match) => ({
          ...match,
          suggestion: "for the first time in a long time",
        })),
  },
  {
    id: "pension-lodging",
    category: "word_choice",
    priority: 2,
    explanationKo:
      '한국의 숙박형 펜션은 영어로 vacation rental이라고 해야 의미가 전달됩니다.',
    find: (draft, koreanPlan) =>
      matchesFromRegex(draft, /\bpension\b/gi, () => "vacation rental").filter(
        (match) => lodgingContext(phraseContext(draft, match.start), koreanPlan),
      ),
  },
  {
    id: "have-a-hard-time",
    category: "grammar",
    priority: 1,
    explanationKo:
      '내가 어떤 일을 하기 어렵다는 뜻은 have a hard time 뒤에 -ing를 씁니다.',
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bI (am|was) difficult to (wake up early|get up early|fall asleep|concentrate|speak English|exercise)\b/gi,
        (match) => {
          const lead = match[1].toLowerCase() === "was" ? "I had" : "I have";
          const activityMap: Record<string, string> = {
            "wake up early": "waking up early",
            "get up early": "getting up early",
            "fall asleep": "falling asleep",
            concentrate: "concentrating",
            "speak english": "speaking English",
            exercise: "exercising",
          };
          return `${lead} a hard time ${activityMap[match[2].toLowerCase()]}`;
        },
      ),
  },
  {
    id: "felt-uncomfortable",
    category: "word_choice",
    priority: 2,
    explanationKo:
      '사람이 불편함을 느꼈다는 뜻에는 inconvenient보다 felt uncomfortable을 씁니다.',
    find: (draft) =>
      matchesFromRegex(draft, /\bI (was|am) inconvenient\b/gi, (match) =>
        match[1].toLowerCase() === "was"
          ? "I felt uncomfortable"
          : "I feel uncomfortable",
      ),
  },
  {
    id: "recommend-gerund",
    category: "grammar",
    priority: 1,
    explanationKo:
      'recommend 뒤에는 사람+to부정사 대신 동명사나 that절을 씁니다.',
    find: (draft) =>
      matchesFromRegex(
        draft,
        /\bI recommend you to ([A-Za-z]+)\b/gi,
        (match) => `I'd recommend ${gerund(match[1])}`,
      ),
  },
];

function overlaps(a: RuleMatch, b: RuleMatch): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * 한국인 학습자가 자주 쓰는 직역 표현을 최대 3개까지만 반환합니다.
 * 서버나 외부 API를 호출하지 않는 순수 로컬 규칙입니다.
 */
export function detectRuleIssues(
  draft: string,
  koreanPlan?: KoreanPlan,
): CoachIssue[] {
  if (!draft.trim()) return [];

  const candidates = RULES.flatMap((rule) =>
    rule.find(draft, koreanPlan).map((match) => ({ rule, match })),
  ).sort(
    (a, b) =>
      a.rule.priority - b.rule.priority ||
      a.match.start - b.match.start ||
      b.match.end - b.match.start - (a.match.end - a.match.start),
  );

  const accepted: Array<{ rule: RuleDefinition; match: RuleMatch }> = [];
  for (const candidate of candidates) {
    if (accepted.some(({ match }) => overlaps(match, candidate.match))) continue;
    accepted.push(candidate);
    if (accepted.length === MAX_RULE_ISSUES) break;
  }

  return accepted.map(({ rule, match }, index) => ({
    id: `rule-${rule.id}-${match.start}-${index}`,
    source: "rule",
    category: rule.category,
    priority: rule.priority,
    original: match.original,
    suggestion: match.suggestion,
    explanationKo: rule.explanationKo,
    start: match.start,
    end: match.end,
    ruleId: rule.id,
  }));
}

export const findKoreanSpeakerIssues = detectRuleIssues;

export function applyRuleIssues(draft: string, issues: CoachIssue[]): string {
  return [...issues]
    .filter(
      (issue): issue is CoachIssue & { start: number; end: number } =>
        typeof issue.start === "number" && typeof issue.end === "number",
    )
    .sort((a, b) => b.start - a.start)
    .reduce(
      (corrected, issue) =>
        `${corrected.slice(0, issue.start)}${issue.suggestion}${corrected.slice(issue.end)}`,
      draft,
    );
}

export function applyDeterministicRules(
  draft: string,
  koreanPlan?: KoreanPlan,
): string {
  return applyRuleIssues(draft, detectRuleIssues(draft, koreanPlan));
}

export function reviewWithDeterministicRules(
  draft: string,
  koreanPlan?: KoreanPlan,
): { issues: CoachIssue[]; correctedText: string } {
  const issues = detectRuleIssues(draft, koreanPlan);
  return { issues, correctedText: applyRuleIssues(draft, issues) };
}
