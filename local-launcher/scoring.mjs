const WORD_PATTERN = /\b[A-Za-z][A-Za-z'’-]*\b/g;
const SUBORDINATE_PATTERN = /\b(?:although|because|even though|if|since|unless|when|whenever|whereas|which|while|who|that)\b/giu;

const CONNECTORS = [
  ["actually", /\bactually\b/iu],
  ["because", /\bbecause\b/iu],
  ["for example", /\bfor example\b/iu],
  ["however", /\bhowever\b/iu],
  ["in my case", /\bin my case\b/iu],
  ["on top of that", /\bon top of that\b/iu],
  ["as a result", /\bas a result\b/iu],
  ["at the same time", /\bat the same time\b/iu],
  ["that said", /\bthat said\b/iu],
  ["overall", /\boverall\b/iu],
  ["in the end", /\bin the end\b/iu],
  ["so", /\bso\b/iu],
];

const LEXICAL_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "been", "but", "by",
  "for", "from", "had", "has", "have", "he", "her", "him", "his", "i", "in",
  "is", "it", "its", "me", "my", "of", "on", "or", "our", "she", "so", "that",
  "the", "their", "them", "they", "this", "to", "was", "we", "were", "when",
  "which", "while", "who", "with", "you", "your",
]);

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value) {
  return Math.round(value);
}

function sentences(text) {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function words(text) {
  return text.match(WORD_PATTERN) ?? [];
}

function hasPlanField(koreanPlan, field) {
  return typeof koreanPlan?.[field] === "string" && koreanPlan[field].trim().length > 0;
}

function coverageSignals(text, sentenceList, koreanPlan) {
  const sentenceCount = sentenceList.length;
  const lastSentence = sentenceList.at(-1) ?? "";
  const explicitReason =
    /\b(?:because|since|so|the reason is|that is why|so that|in order to)\b/iu.test(text);
  const reasonRealization =
    /\b(?:help|helps|allow|allows|let|lets|make|makes|relax|unwind|release|reduce|keep|stay|maintain|enjoy|feel)\b/iu.test(
      sentenceList.slice(1).join(" "),
    );
  const explicitExample =
    /\b(?:for example|for instance|in my case|one time|once|when)\b/iu.test(text);
  const timedPastEvent =
    /\b(?:last|yesterday|ago|recently|one day|that day|first time|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/iu.test(text) &&
    tenseSignals(text).past;
  const explicitClosing =
    /\b(?:overall|in the end|that is why|for that reason|to sum up)\b/iu.test(text);
  const closingRealization =
    /\b(?:i\s+(?:still\s+)?(?:like|love|prefer|enjoy|think|believe|hope|want|would|will)|it\s+(?:is|was|has become)|this\s+(?:is|was|has become)|that(?:'s| is)|favou?rite|important|meaningful|special|visit again|go again)\b/iu.test(
      lastSentence,
    );

  return {
    answer: sentenceCount >= 1,
    reason: explicitReason ||
      (hasPlanField(koreanPlan, "reason") && sentenceCount >= 2 && reasonRealization),
    example: explicitExample ||
      (hasPlanField(koreanPlan, "example") && sentenceCount >= 3 && timedPastEvent),
    closing: explicitClosing ||
      (hasPlanField(koreanPlan, "closing") && sentenceCount >= 3 && closingRealization),
  };
}

function tenseSignals(text) {
  return {
    past: /\b(?:was|were|did|had|went|came|got|made|took|felt|became|began|started|played|talked|stayed|visited|watched|tried)\b|\b[A-Za-z]+ed\b/iu.test(text),
    present: /\b(?:am|is|are|do|does|usually|often|always|like|likes|help|helps|give|gives|keep|keeps)\b/iu.test(text),
    perfect: /\b(?:have|has|had)\s+(?:been|done|gone|seen|made|taken|felt|become|started|played|visited|tried|[A-Za-z]+ed)\b/iu.test(text),
    progressive: /\b(?:am|is|are|was|were|be|been)\s+[A-Za-z]+ing\b/iu.test(text),
  };
}

function lexicalDiversity(text) {
  const tokens = words(text)
    .map((word) => word.toLocaleLowerCase("en-US").replace(/[’]/g, "'"))
    .filter((word) => !LEXICAL_STOPWORDS.has(word));
  if (!tokens.length) return 0;
  return new Set(tokens).size / tokens.length;
}

function buildGapToTarget(targetLevel, metrics, subScores) {
  const candidates = [];
  if (metrics.coverageCount < 4) {
    candidates.push([100 - subScores.coverage, "답변·이유·예시·마무리 네 요소를 모두 연결해 보세요."]);
  }
  if (metrics.localRuleViolationCount > 0) {
    candidates.push([100 - subScores.accuracy, `반복되는 한국식 표현 ${metrics.localRuleViolationCount}개를 먼저 고치세요.`]);
  }
  if (metrics.sentenceCount < (targetLevel === "AL" ? 5 : 3)) {
    candidates.push([100 - subScores.structure, targetLevel === "AL"
      ? "AL 답변은 최소 5문장으로 도입·근거·예시·마무리를 완성해 보세요."
      : "IH 답변은 최소 3문장으로 이유와 예시까지 이어 보세요."]);
  }
  if (metrics.subordinateClauseCount < (targetLevel === "AL" ? 2 : 1)) {
    candidates.push([100 - subScores.complexity, targetLevel === "AL"
      ? "because·although·when 같은 종속절을 두 번 이상 자연스럽게 사용해 보세요."
      : "because나 when을 사용해 문장 사이의 이유·상황을 연결해 보세요."]);
  }
  if (metrics.connectorDiversity < (targetLevel === "AL" ? 3 : 2)) {
    candidates.push([90 - subScores.complexity, targetLevel === "AL"
      ? "서로 다른 담화 연결어를 세 가지 이상 사용해 흐름을 분명히 만드세요."
      : "이유와 예시를 잇는 연결어를 두 가지 이상 사용해 보세요."]);
  }
  if (targetLevel === "AL" && metrics.tenseDiversity < 2) {
    candidates.push([80 - subScores.tenseControl, "현재·과거·완료 시제 중 두 가지 이상을 문맥에 맞게 통제해 보세요."]);
  }

  return candidates
    .filter(([priority]) => priority > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([, message]) => message);
}

export function scoreResponse({
  rewriteDraft,
  koreanPlan = {},
  localRuleViolations = [],
  targetLevel = "AL",
}) {
  const text = typeof rewriteDraft === "string" ? rewriteDraft.trim() : "";
  const sentenceList = sentences(text);
  const wordList = words(text);
  const coverage = coverageSignals(text, sentenceList, koreanPlan);
  const coverageCount = Object.values(coverage).filter(Boolean).length;
  const subordinateClauseCount = (text.match(SUBORDINATE_PATTERN) ?? []).length;
  const connectorNames = CONNECTORS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  const tenses = tenseSignals(text);
  const tenseDiversity = Object.values(tenses).filter(Boolean).length;
  const typeTokenRatio = lexicalDiversity(text);
  const averageSentenceLength = sentenceList.length
    ? wordList.length / sentenceList.length
    : 0;
  const violationCount = Array.isArray(localRuleViolations)
    ? localRuleViolations.length
    : 0;

  const sentenceVolumeScore = clamp(sentenceList.length * 16);
  const sentenceControlScore = averageSentenceLength >= 6 && averageSentenceLength <= 24
    ? 100
    : averageSentenceLength > 0
      ? 45
      : 0;
  const subScores = {
    coverage: coverageCount * 25,
    structure: rounded(sentenceVolumeScore * 0.7 + sentenceControlScore * 0.3),
    complexity: rounded(clamp(subordinateClauseCount * 18 + connectorNames.length * 12)),
    tenseControl: clamp(tenseDiversity * 25),
    vocabulary: rounded(clamp(typeTokenRatio * 110)),
    accuracy: clamp(100 - violationCount * 22),
  };
  const totalScore = rounded(
    subScores.coverage * 0.25 +
    subScores.structure * 0.2 +
    subScores.complexity * 0.25 +
    subScores.tenseControl * 0.1 +
    subScores.vocabulary * 0.1 +
    subScores.accuracy * 0.1,
  );

  const qualifiesForAl = totalScore >= 78 &&
    sentenceList.length >= 5 &&
    coverageCount >= 3 &&
    subordinateClauseCount >= 2 &&
    connectorNames.length >= 3 &&
    violationCount <= 1;
  const qualifiesForIh = totalScore >= 52 &&
    sentenceList.length >= 3 &&
    coverageCount >= 2 &&
    violationCount <= 3;
  const band = qualifiesForAl ? "AL" : qualifiesForIh ? "IH" : "IM2";

  const metrics = {
    coverage,
    coverageCount,
    sentenceCount: sentenceList.length,
    averageSentenceLength: Number(averageSentenceLength.toFixed(1)),
    subordinateClauseCount,
    subordinateClauseRatio: Number(
      (subordinateClauseCount / Math.max(1, sentenceList.length)).toFixed(2),
    ),
    connectorDiversity: connectorNames.length,
    connectors: connectorNames,
    tenseDiversity,
    tenses,
    typeTokenRatio: Number(typeTokenRatio.toFixed(2)),
    localRuleViolationCount: violationCount,
    plannedElements: Object.values(koreanPlan).filter((value) =>
      typeof value === "string" && value.trim()).length,
  };

  return {
    band,
    totalScore,
    targetLevel: targetLevel === "IH" ? "IH" : "AL",
    subScores,
    metrics,
    gapToTarget: buildGapToTarget(
      targetLevel === "IH" ? "IH" : "AL",
      metrics,
      subScores,
    ),
  };
}
