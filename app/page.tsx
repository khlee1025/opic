"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  CURRICULUM_VERSION,
  QUESTION_BANK_SOURCE_LABEL,
  QUESTION_CATEGORY_IDS,
  QUESTION_CATEGORY_LABELS,
  getQuestionById,
  getQuestionPairForDate,
  type DailyQuestion,
} from "./data/questions";
import { APP_VERSION } from "./lib/version";
import { getPreviousPracticeStage } from "./lib/practice";
import { buildRedlineSegments } from "./lib/redline";
import { applyDeterministicRules, detectRuleIssues } from "./lib/rules";
import {
  clearCoachState,
  createEmptyCoachState,
  createQuestionAttempt,
  exportCoachState,
  getCurrentStreak,
  getDailyCompletedCount,
  getLongestStreak,
  getSeoulDateKey,
  importCoachStateJson,
  loadCoachState,
  saveCoachState,
  shiftDateKey,
  upsertQuestionAttempt,
} from "./lib/storage";
import type {
  CoachFeedback,
  CoachIssue,
  CoachState,
  KoreanPlan,
  QuestionAttempt,
  TargetLevel,
} from "./lib/types";

type Screen = "home" | "practice" | "records" | "settings";
type CoachMode = "checking" | "local-model" | "rules-only";
type SaveStatus = "saving" | "saved" | "error";

interface CoachApiFeedback extends CoachFeedback {
  source?: "local-model" | "rules-only";
  modelUsed?: string | null;
}

const TYPE_LABELS: Record<DailyQuestion["type"], string> = {
  description: "묘사",
  experience: "경험",
  comparison: "비교",
  change: "변화",
  roleplay: "롤플레이",
  problem: "문제 해결",
  opinion: "의견",
};

const ISSUE_LABELS: Record<CoachIssue["category"], string> = {
  meaning: "의미 보존",
  grammar: "꼭 고칠 문법",
  word_choice: "단어 선택",
  naturalness: "더 자연스럽게",
};

const ROLE_OPTIONS = [
  ["worker", "직장인"],
  ["student", "학생"],
  ["job_seeker", "현재 일하지 않음"],
  ["homemaker", "주부·기타"],
] as const;

const RESIDENCE_OPTIONS = [
  ["alone", "혼자 거주"],
  ["family", "가족과 거주"],
  ["shared", "룸메이트와 거주"],
  ["dorm", "기숙사·사택"],
] as const;

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-7h5v7"/></>,
    book: <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 1H20v17H7.5A3.5 3.5 0 0 0 4 21.5z"/><path d="M4 4.5v17"/></>,
    chart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.37.49.68.85.9.33.2.72.3 1.1.3h.1v4h-.1A1.7 1.7 0 0 0 19.4 15z"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    back: <><path d="M19 12H5"/><path d="m10 17-5-5 5-5"/></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    flame: <path d="M13.5 2S14 6 10 9c-3 2.2-3.5 5.5-1.5 8.2C10 19.3 12 20 12 20s-1-2.8 1.5-5c2-1.8 1.2-4.6 1.2-4.6s3.8 2.7 3.3 6.3C17.6 19.6 15 22 11.5 22 7.4 22 4 18.8 4 14.7 4 8 10 6 13.5 2z"/>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.book}
    </svg>
  );
}

function formatKoreanDate(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function wordCount(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function comparableText(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function planComplete(plan: KoreanPlan) {
  return Object.values(plan).every((value) => value.trim().length >= 2);
}

function buildFallbackFeedback(
  stage: "feedback" | "post_rewrite",
  attempt: QuestionAttempt,
): CoachApiFeedback {
  const sourceText = stage === "post_rewrite" ? attempt.englishRewrite : attempt.englishDraft;
  const issues = detectRuleIssues(sourceText, attempt.koreanPlan);
  const corrected = applyDeterministicRules(sourceText, attempt.koreanPlan);
  const coverage = {
    answer: Boolean(attempt.koreanPlan.answer.trim()),
    reason: Boolean(attempt.koreanPlan.reason.trim()),
    example: Boolean(attempt.koreanPlan.example.trim()),
    closing: Boolean(attempt.koreanPlan.closing.trim()),
  };
  const rewriteTargets = issues.length
    ? issues.map((issue) => issue.suggestion).slice(0, 3)
    : ["답변 → 이유 → 구체적인 장면 → 마무리 구조를 한 번 더 확인하세요."];

  return {
    source: "rules-only",
    diagnosisKo: issues.length
      ? `의미는 전달됩니다. 먼저 ${issues.length}개의 한국식 표현을 다듬어 보세요.`
      : "빈출 직역 오류는 보이지 않습니다. 이제 문장 연결과 구체적인 장면을 다듬어 보세요.",
    intentCoverage: coverage,
    issues,
    rewriteTargets,
    ...(stage === "post_rewrite"
      ? {
          correctedEnglish: corrected,
          naturalEnglish: corrected,
          modelAnswer: corrected,
          stretchAnswer: corrected,
          phraseUpgrades: issues.map((issue) => ({
            from: issue.original,
            to: issue.suggestion,
            whyKo: issue.explanationKo,
          })),
          nextTaskKo: "오늘 고친 표현 하나를 소리 내어 세 번 말해 보세요.",
        }
      : {
          nextTaskKo: "완성 답안을 보기 전에 위 표현을 반영해 직접 다시 써 보세요.",
        }),
  };
}

function normalizeApiFeedback(raw: Record<string, unknown>): CoachApiFeedback {
  const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];
  const issues: CoachIssue[] = rawIssues.slice(0, 3).map((value, index) => {
    const issue = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const category = ["meaning", "grammar", "word_choice", "naturalness"].includes(String(issue.category))
      ? issue.category as CoachIssue["category"]
      : "naturalness";
    return {
      id: `api-${index}-${String(issue.original ?? "issue")}`,
      source: "local_ai" as const,
      category,
      priority: (index + 1) as 1 | 2 | 3,
      original: String(issue.original ?? ""),
      suggestion: String(issue.corrected ?? issue.suggestion ?? ""),
      explanationKo: String(issue.explanationKo ?? ""),
    };
  }).filter((issue) => issue.original && issue.suggestion);
  const coverage = raw.intentCoverage && typeof raw.intentCoverage === "object"
    ? raw.intentCoverage as Record<string, unknown>
    : {};
  const nullableText = (key: string) => typeof raw[key] === "string" && raw[key] ? String(raw[key]) : undefined;
  const rawUpgrades = Array.isArray(raw.phraseUpgrades) ? raw.phraseUpgrades : [];

  return {
    source: raw.source === "local-model" ? "local-model" : "rules-only",
    modelUsed: typeof raw.modelUsed === "string" ? raw.modelUsed : null,
    diagnosisKo: String(raw.diagnosisKo ?? "답변을 확인했습니다."),
    intentCoverage: {
      answer: Boolean(coverage.answer),
      reason: Boolean(coverage.reason),
      example: Boolean(coverage.example),
      closing: Boolean(coverage.closing),
    },
    issues,
    rewriteTargets: Array.isArray(raw.rewriteTargets)
      ? raw.rewriteTargets.map(String).filter(Boolean).slice(0, 3)
      : [],
    correctedEnglish: nullableText("correctedEnglish"),
    naturalEnglish: nullableText("naturalEnglish"),
    modelAnswer: nullableText("modelAnswer"),
    stretchAnswer: nullableText("stretchAnswer"),
    phraseUpgrades: rawUpgrades.slice(0, 4).map((value) => {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return { from: String(item.from ?? ""), to: String(item.to ?? ""), whyKo: String(item.whyKo ?? "") };
    }).filter((item) => item.to),
    nextTaskKo: nullableText("nextTaskKo"),
  };
}

async function fetchCoachFeedback(
  stage: "feedback" | "post_rewrite",
  question: DailyQuestion,
  attempt: QuestionAttempt,
  targetLevel: TargetLevel,
): Promise<CoachApiFeedback> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 80_000);
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        stage,
        targetLevel,
        question: question.promptEn,
        koreanPlan: attempt.koreanPlan,
        englishDraft: attempt.englishDraft,
        rewriteDraft: stage === "post_rewrite" ? attempt.englishRewrite : "",
        firstDraftReview: stage === "post_rewrite" &&
          comparableText(attempt.englishRewrite) === comparableText(attempt.englishDraft),
      }),
    });
    window.clearTimeout(timer);
    if (!response.ok) throw new Error("coach unavailable");
    const raw = await response.json() as Record<string, unknown>;
    return normalizeApiFeedback(raw);
  } catch {
    return buildFallbackFeedback(stage, attempt);
  }
}

interface SurveyPayload {
  role: string;
  residence: string;
  interests: string[];
  targetLevel: TargetLevel;
}

function Onboarding({
  onComplete,
  initial,
  onCancel,
}: {
  onComplete: (payload: SurveyPayload) => void;
  initial?: SurveyPayload;
  onCancel?: () => void;
}) {
  const [role, setRole] = useState(initial?.role ?? "worker");
  const [residence, setResidence] = useState(initial?.residence ?? "family");
  const [targetLevel, setTargetLevel] = useState<TargetLevel>(initial?.targetLevel ?? "AL");
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? [
    "home_neighborhood",
    "friends_social",
    "restaurants_cafes",
    "fitness_sports",
  ]);

  const toggleInterest = (id: string) => {
    setInterests((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  return (
    <main className="onboarding-shell">
      <section className="onboarding-panel">
        <div className="onboarding-grid">
          <aside className="onboarding-intro">
            <div className="brand-mark">OPIc</div>
            <h1>생각은 한국어로,<br />답변은 자연스러운 영어로.</h1>
            <p>매일 두 문제만 풀어도 됩니다. 먼저 말할 내용을 만들고 영어로 표현하면, 내 원문 위에 바로 첨삭하고 자연스러운 완성 문단을 보여드립니다.</p>
            <div className="onboarding-steps">
              {["영어 질문 확인", "한국어 아이디어 4칸", "내 영어 답변 작성", "빨간펜 첨삭과 완성 문단"].map((label, index) => (
                <div className="onboarding-step" key={label}><i>{index + 1}</i><span>{label}</span></div>
              ))}
            </div>
          </aside>
          <div className="onboarding-form">
            <p className="eyebrow">OPIc SURVEY</p>
            <h2>나에게 맞는 문제를 골라드릴게요</h2>
            <p>실제 시험의 사전 설문처럼 보기에서 선택합니다. 주관식 입력은 없습니다.</p>

            <div className="survey-group">
              <div className="survey-label"><span>현재 상황</span><small>1개 선택</small></div>
              <div className="choice-grid">
                {ROLE_OPTIONS.map(([id, label]) => (
                  <button type="button" aria-pressed={role === id} className={`choice-button ${role === id ? "selected" : ""}`} onClick={() => setRole(id)} key={id}>
                    <span className="choice-check" aria-hidden="true">✓</span>{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="survey-group">
              <div className="survey-label"><span>거주 형태</span><small>1개 선택</small></div>
              <div className="choice-grid">
                {RESIDENCE_OPTIONS.map(([id, label]) => (
                  <button type="button" aria-pressed={residence === id} className={`choice-button ${residence === id ? "selected" : ""}`} onClick={() => setResidence(id)} key={id}>
                    <span className="choice-check" aria-hidden="true">✓</span>{label}
                  </button>
                ))}
              </div>
            </div>

            <div className="survey-group">
              <div className="survey-label"><span>관심 주제</span><small>{interests.length}개 선택 · 최소 4개</small></div>
              <div className="choice-grid">
                {QUESTION_CATEGORY_IDS.map((id) => (
                  <button type="button" aria-pressed={interests.includes(id)} className={`choice-button ${interests.includes(id) ? "selected" : ""}`} onClick={() => toggleInterest(id)} key={id}>
                    <span className="choice-check" aria-hidden="true">✓</span>{QUESTION_CATEGORY_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            <div className="survey-group">
              <div className="survey-label"><span>목표 등급</span><small>학습 난이도에 반영</small></div>
              <div className="choice-grid">
                {(["IH", "AL"] as const).map((level) => (
                  <button type="button" aria-pressed={targetLevel === level} className={`choice-button ${targetLevel === level ? "selected" : ""}`} onClick={() => setTargetLevel(level)} key={level}>
                    <span className="choice-check" aria-hidden="true">✓</span>{level === "IH" ? "IH 안정권" : "AL 도전"}
                  </button>
                ))}
              </div>
            </div>

            <div className="onboarding-actions">
              <p><Icon name="lock" size={14} /> 계정 없이 이 PC에만 저장됩니다.</p>
              <div className="feedback-actions">
                {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>취소</button>}
                <button type="button" className="primary-button accent" disabled={interests.length < 4} onClick={() => onComplete({ role, residence, interests, targetLevel })}>
                  {onCancel ? "설문 선택 저장" : "오늘 학습 시작"} <Icon name="arrow" size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SideRail({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  return (
    <aside className="side-rail">
      <div className="brand">
        <div className="brand-mark">OPIc</div>
        <div><span className="brand-name">Daily Coach</span><span className="brand-sub">LOCAL EDITION · v{APP_VERSION}</span></div>
      </div>
      <nav className="rail-nav" aria-label="주요 메뉴">
        <button type="button" aria-label="오늘 학습" className={`nav-button ${screen === "home" ? "active" : ""}`} onClick={() => onNavigate("home")}><Icon name="home" /><span>오늘 학습</span></button>
        <button type="button" aria-label="학습 기록" className={`nav-button ${screen === "records" ? "active" : ""}`} onClick={() => onNavigate("records")}><Icon name="chart" /><span>학습 기록</span></button>
        <button type="button" aria-label="설정 및 백업" className={`nav-button ${screen === "settings" ? "active" : ""}`} onClick={() => onNavigate("settings")}><Icon name="settings" /><span>설정·백업</span></button>
      </nav>
      <div className="privacy-note"><strong><Icon name="shield" size={16} /> 완전 로컬 모드</strong>답변과 교정 내용은 외부 서버로 전송되지 않습니다.</div>
    </aside>
  );
}

function Topbar({ coachMode }: { coachMode: CoachMode }) {
  return (
    <header className="topbar">
      <span className="date-line">{formatKoreanDate()}</span>
      <div className="status-cluster">
        <span className={`local-status ${coachMode === "rules-only" ? "waiting" : ""}`}><span className="status-dot" />{coachMode === "checking" ? "로컬 엔진 확인 중" : coachMode === "local-model" ? "로컬 AI 준비됨" : "기본 교정 사용 중 · AI 준비 대기"}</span>
      </div>
    </header>
  );
}

function HomeScreen({
  state,
  todayKey,
  questions,
  onStart,
}: {
  state: CoachState;
  todayKey: string;
  questions: readonly [DailyQuestion, DailyQuestion];
  onStart: (question: DailyQuestion) => void;
}) {
  const completed = getDailyCompletedCount(state, todayKey);
  const streak = getCurrentStreak(state, todayKey);
  const longest = getLongestStreak(state);
  const day = state.days[todayKey];
  const firstOpen = questions.find((question) => day?.attempts[question.id]?.stage !== "completed") ?? questions[0];
  const recentDays = Array.from({ length: 7 }, (_, index) => shiftDateKey(todayKey, index - 6));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="content-wrap">
      <section className="hero-row">
        <div className="hero-card">
          <p className="eyebrow">TODAY&apos;S PRACTICE</p>
          <h1>오늘도 딱 <span>두 문제,</span><br />내 영어로 만들어봐요.</h1>
          <p className="hero-description">번역문을 외우지 않습니다. 한국어로 생각을 정리하고 영어로 직접 쓴 뒤, 꼭 필요한 표현만 고쳐 한 번 더 써봅니다.</p>
          <div className="hero-actions">
            <button type="button" className="primary-button accent" onClick={() => onStart(firstOpen)}>
              {completed === 2 ? "오늘 답변 다시 보기" : completed > 0 ? "다음 문제 이어하기" : "오늘 학습 시작"} <Icon name="arrow" size={17} />
            </button>
            <span className="streak-chip"><Icon name="flame" size={17} /> {streak}일 연속</span>
          </div>
        </div>
        <div className="daily-stat-card">
          <div>
            <p className="daily-stat-label">TODAY&apos;S GOAL</p>
            <div className="daily-count"><strong>{completed}</strong><span>/ 2 문제</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${completed * 50}%` }} /></div>
          </div>
          <div className="daily-stat-foot"><span>예상 15분</span><span>{completed === 2 ? "오늘 완료 ✓" : `${2 - completed}문제 남음`}</span></div>
        </div>
      </section>

      <div className="section-head">
        <div><h2>오늘의 두 질문</h2><p>첫 문제는 익숙하게, 두 번째는 한 단계 깊게 갑니다.</p></div>
        <span className="date-line">빈출 유형 기반 자체 제작</span>
      </div>
      <section className="question-grid">
        {questions.map((question, index) => {
          const attempt = day?.attempts[question.id];
          const isCompleted = attempt?.stage === "completed";
          const hasStarted = Boolean(attempt && attempt.stage !== "not_started");
          return (
            <article className={`question-card ${isCompleted ? "completed" : ""}`} key={question.id}>
              <div className="question-card-index">
                <span className="question-number">QUESTION {index + 1}</span>
                <div className="question-meta"><span className="type-pill">{TYPE_LABELS[question.type]}</span><span className="difficulty-pill">{index === 0 ? "WARM-UP" : "STRETCH"}</span></div>
              </div>
              <h3>{question.categoryKo} · {index === 0 ? "기본 답변" : "확장 답변"}</h3>
              <p className="question-preview" lang="en">{question.promptEn}</p>
              <div className="card-footer">
                <span>{question.targetSeconds}초 권장</span>
                <button type="button" className="text-button" onClick={() => onStart(question)}>{isCompleted ? "해설 다시 보기" : hasStarted ? "이어서 풀기" : "문제 시작"} →</button>
              </div>
            </article>
          );
        })}
      </section>

      <div className="section-head"><div><h2>학습 리듬</h2><p>두 문제의 첨삭 결과까지 확인하면 하루가 기록됩니다.</p></div></div>
      <section className="streak-grid">
        <div className="mini-stat"><span className="mini-stat-label">현재 연속 학습</span><strong className="mini-stat-value">{streak}일</strong></div>
        <div className="mini-stat"><span className="mini-stat-label">최고 기록</span><strong className="mini-stat-value">{longest}일</strong></div>
        <div className="mini-stat"><span className="mini-stat-label">최근 7일</span><div className="week-dots">
          {recentDays.map((key) => {
            const isDone = getDailyCompletedCount(state, key) === 2;
            const dayDate = new Date(`${key}T12:00:00+09:00`);
            return <span className={`day-dot ${isDone ? "done" : ""} ${key === todayKey ? "today" : ""}`} key={key}><i>{isDone ? "✓" : "·"}</i>{weekday[dayDate.getDay()]}</span>;
          })}
        </div></div>
      </section>
    </div>
  );
}

function RecordsScreen({ state, todayKey }: { state: CoachState; todayKey: string }) {
  const streak = getCurrentStreak(state, todayKey);
  const longest = getLongestStreak(state);
  const completedAnswers = Object.values(state.days).reduce(
    (total, day) => total + Object.values(day.attempts).filter((attempt) => attempt.stage === "completed").length,
    0,
  );
  const completedDays = Object.keys(state.days).filter((dateKey) => getDailyCompletedCount(state, dateKey) === 2).length;
  const recentDays = Array.from({ length: 14 }, (_, index) => shiftDateKey(todayKey, index - 13));

  return (
    <div className="content-wrap records-screen">
      <section className="practice-card">
        <p className="eyebrow">LOCAL LEARNING RECORD</p>
        <h1 className="page-title">내가 끝낸 만큼만 기록됩니다.</h1>
        <p className="question-instruction">첨삭 결과까지 확인한 답변만 완료로 계산합니다. 이 기록도 이 PC 밖으로 전송되지 않습니다.</p>
        <div className="record-stat-grid">
          <div className="mini-stat"><span className="mini-stat-label">완료한 답변</span><strong className="mini-stat-value">{completedAnswers}개</strong></div>
          <div className="mini-stat"><span className="mini-stat-label">완료한 학습일</span><strong className="mini-stat-value">{completedDays}일</strong></div>
          <div className="mini-stat"><span className="mini-stat-label">현재 / 최고 연속</span><strong className="mini-stat-value">{streak}일 / {longest}일</strong></div>
        </div>
        <div className="record-calendar" aria-label="최근 14일 학습 기록">
          <div className="record-calendar-head"><strong>최근 14일</strong><span>하루 2문제 완료 시 체크</span></div>
          <div className="record-day-grid">
            {recentDays.map((dateKey) => {
              const count = getDailyCompletedCount(state, dateKey);
              const [, month, day] = dateKey.split("-");
              return (
                <div className={`record-day ${count === 2 ? "done" : ""} ${dateKey === todayKey ? "today" : ""}`} key={dateKey}>
                  <span>{month}.{day}</span><strong>{count === 2 ? "✓" : `${count}/2`}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stepper({ stage }: { stage: QuestionAttempt["stage"] }) {
  const labels = ["질문", "한국어 생각", "영어 작성", "첨삭 결과"];
  const indexes: Record<QuestionAttempt["stage"], number> = {
    not_started: 0,
    question_seen: 1,
    korean_completed: 2,
    draft_submitted: 2,
    feedback_ready: 2,
    rewrite_submitted: 2,
    completed: 3,
  };
  const current = indexes[stage];
  return <div className="stepper">{labels.map((label, index) => <div className={`step-item ${index < current ? "done" : ""} ${index === current ? "active" : ""}`} key={label}><div className="step-bar" /><span>{label}</span></div>)}</div>;
}

function QuestionIntro({ question, onNext, speaking, onSpeak }: { question: DailyQuestion; onNext: () => void; speaking: boolean; onSpeak: () => void }) {
  return (
    <div className="practice-card">
      <div className="practice-kicker"><div className="practice-kicker-left"><span className="type-pill">{TYPE_LABELS[question.type]}</span><span className="difficulty-pill">LEVEL {question.difficulty}</span></div><button type="button" className="icon-button" onClick={onSpeak} disabled={speaking}><Icon name="volume" size={17} /> {speaking ? "재생 중" : "질문 듣기"}</button></div>
      <p className="eyebrow">TODAY&apos;S QUESTION</p>
      <h1 className="question-english" lang="en">{question.promptEn}</h1>
      <p className="question-instruction">질문을 완벽하게 번역하려 하지 마세요. 무엇을 답해야 하는지만 잡고, 다음 단계에서 한국어로 내용을 만듭니다.</p>
      <div className="coach-callout"><Icon name="book" size={19} /><div><strong>이번 답변에서 연습할 동작</strong><br />{question.requiredMoves.join(" · ")}</div></div>
      <div className="button-row"><button type="button" className="primary-button accent" onClick={onNext}>한국어로 생각 정리하기 <Icon name="arrow" size={17} /></button></div>
    </div>
  );
}

function KoreanPlanning({ question, plan, onChange, onNext }: { question: DailyQuestion; plan: KoreanPlan; onChange: (plan: KoreanPlan) => void; onNext: () => void }) {
  const fields: Array<[keyof KoreanPlan, string]> = [["answer", "1. 핵심 답변"], ["reason", "2. 이유"], ["example", "3. 구체적인 경험·예시"], ["closing", "4. 한 줄 마무리"]];
  return (
    <div className="practice-card">
      <p className="eyebrow">STEP 1 · CONTENT FIRST</p>
      <h1 className="page-title">영어보다 먼저, 할 말을 만드세요.</h1>
      <p className="question-instruction">문장을 번역하기 위한 한국어가 아니라, 답변의 뼈대를 만드는 단계입니다. 짧게 적어도 괜찮습니다.</p>
      <div className="question-reference" aria-label="연습 질문">
        <span>연습 질문</span>
        <p lang="en">{question.promptEn}</p>
      </div>
      <div className="idea-grid">
        {fields.map(([key, label]) => <div className="field-card" key={key}><label htmlFor={`plan-${key}`}>{label}</label><span className="field-hint">{question.koreanIdeaPrompts[key]}</span><textarea id={`plan-${key}`} className="idea-textarea" value={plan[key]} onChange={(event) => onChange({ ...plan, [key]: event.target.value })} placeholder="한국어로 핵심만 적어보세요." /></div>)}
      </div>
      <div className="coach-callout"><Icon name="shield" size={19} /><div><strong>영어 표현 힌트는 아직 보이지 않습니다.</strong><br />먼저 내용이 있어야 영어가 길어지고, 질문이 어려워져도 개인 경험으로 도망가지 않게 됩니다.</div></div>
      <div className="button-row"><button type="button" className="primary-button accent" disabled={!planComplete(plan)} onClick={onNext}>영어로 직접 써보기 <Icon name="arrow" size={17} /></button></div>
    </div>
  );
}

function IdeaPeek({ plan }: { plan: KoreanPlan }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const endsAtRef = useRef(0);

  useEffect(() => {
    if (remaining === null) return;
    const timer = window.setTimeout(() => {
      const millisecondsLeft = endsAtRef.current - Date.now();
      setRemaining(millisecondsLeft <= 0 ? null : Math.ceil(millisecondsLeft / 1000));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const open = remaining !== null;
  const togglePeek = () => {
    if (open) {
      endsAtRef.current = 0;
      setRemaining(null);
      return;
    }
    endsAtRef.current = Date.now() + 10_000;
    setRemaining(10);
  };
  return <div className="idea-peek"><button type="button" aria-expanded={open} onClick={togglePeek}>한국어 아이디어 {open ? `${remaining}초 후 자동으로 닫힘` : "10초 보기"} {open ? "▴" : "▾"}</button>{open && <div className="idea-peek-content"><span>답변: {plan.answer}</span><span>이유: {plan.reason}</span><span>예시: {plan.example}</span><span>마무리: {plan.closing}</span></div>}</div>;
}

function DraftWriting({ attempt, onDraft, onSubmit }: { attempt: QuestionAttempt; onDraft: (value: string) => void; onSubmit: () => void }) {
  return (
    <div className="practice-card">
      <p className="eyebrow">STEP 2 · YOUR ENGLISH</p>
      <h1 className="page-title">같은 내용을 영어로 다시 말해보세요.</h1>
      <div className="coach-callout"><Icon name="book" size={19} /><div><strong>한국어 문장을 순서대로 번역하지 마세요.</strong><br />내가 아는 영어로 먼저 답하고, 막히는 표현은 우회해도 됩니다.</div></div>
      <IdeaPeek plan={attempt.koreanPlan} />
      <div className="draft-wrap"><label className="draft-label" htmlFor="english-draft"><span>내 영어 답변</span><span className="word-count">{wordCount(attempt.englishDraft)} words · 자동 저장</span></label><textarea id="english-draft" lang="en" className="draft-textarea" value={attempt.englishDraft} onChange={(event) => onDraft(event.target.value)} placeholder="Start with your main answer. Then add a reason and a specific example..." autoFocus /></div>
      <div className="button-row"><button type="button" className="primary-button accent" disabled={attempt.englishDraft.trim().length < 10} onClick={onSubmit}>빨간펜 첨삭 결과 보기 <Icon name="arrow" size={17} /></button></div>
    </div>
  );
}

function LoadingFeedback() {
  return <div className="practice-card"><p className="eyebrow">PRIVATE LOCAL REVIEW</p><h1 className="page-title">내 답변을 문단 단위로 다듬고 있어요.</h1><p className="question-instruction">답변은 이 PC 안의 교정 엔진에서만 처리됩니다. 처음 실행할 때는 잠시 더 걸릴 수 있습니다.</p><div className="coach-callout"><div className="loading-dots"><i /><i /><i /></div><div><strong>빨간펜 첨삭 · 완성 문단 · 모범답안 준비 중</strong><br />사용자가 말하지 않은 경험이나 사실은 새로 만들지 않습니다.</div></div></div>;
}

function FeedbackSourceNotice({ feedback, onRetry }: { feedback: CoachFeedback; onRetry?: () => void }) {
  const isLocalModel = feedback.source === "local-model";
  return (
    <div className={`feedback-source ${isLocalModel ? "model" : "rules"}`} role="status">
      <div>
        <strong>{isLocalModel ? "로컬 AI 심층 피드백" : "기본 규칙 교정 결과"}</strong>
        <span>{isLocalModel
          ? `${feedback.modelUsed ? `${feedback.modelUsed} · ` : ""}이 PC 안에서 처리됨`
          : "로컬 AI가 아직 준비되지 않아 확실한 직역·문법 규칙만 적용했습니다."}</span>
      </div>
      {!isLocalModel && onRetry && <button type="button" className="secondary-button compact" onClick={onRetry}>로컬 AI로 다시 시도</button>}
    </div>
  );
}

function IntentCoveragePanel({ feedback }: { feedback: CoachFeedback }) {
  const fields: Array<[keyof CoachFeedback["intentCoverage"], string]> = [
    ["answer", "핵심 답변"],
    ["reason", "이유"],
    ["example", "구체적 예시"],
    ["closing", "마무리"],
  ];
  if (feedback.source !== "local-model") {
    return <div className="coverage-panel unavailable"><div className="coverage-head"><strong>답변 구조 점검</strong><span>로컬 AI 준비 후 판정 가능</span></div><p>기본 규칙 교정은 표현만 확인하므로 답변·이유·예시·마무리의 포함 여부를 임의로 판정하지 않습니다.</p></div>;
  }
  const missing = fields.filter(([key]) => !feedback.intentCoverage[key]).map(([, label]) => label);
  return (
    <div className="coverage-panel">
      <div className="coverage-head"><strong>답변 구조 점검</strong><span>{missing.length ? `${missing.join(" · ")} 보강 필요` : "네 요소가 모두 전달됐어요"}</span></div>
      <div className="coverage-chips">
        {fields.map(([key, label]) => <span className={`coverage-chip ${feedback.intentCoverage[key] ? "covered" : "missing"}`} key={key}>{feedback.intentCoverage[key] ? "✓" : "+"} {label}</span>)}
      </div>
    </div>
  );
}

function IssueCards({ feedback }: { feedback: CoachFeedback }) {
  if (!feedback.issues.length) return <div className="issue-card"><div className="issue-head"><span className="issue-index">✓</span><span className="issue-category">큰 직역 오류 없음</span></div><p className="issue-explanation">현재 규칙에서 반드시 고칠 표현은 발견되지 않았습니다. 이제 연결과 구체성을 살려 다시 써보세요.</p></div>;
  return <div className="issue-list">{feedback.issues.slice(0, 3).map((issue, index) => <article className="issue-card" key={issue.id}><div className="issue-head"><span className="issue-index">{index + 1}</span><span className="issue-category">{ISSUE_LABELS[issue.category]}</span></div><div className="change-line"><span className="before-text" lang="en">{issue.original}</span><span className="change-arrow">→</span><span className="after-text" lang="en">{issue.suggestion}</span></div><p className="issue-explanation">{issue.explanationKo}</p></article>)}</div>;
}

function RedlineAnswer({ text, issues }: { text: string; issues: CoachIssue[] }) {
  const segments = buildRedlineSegments(text, issues);
  const correctionCount = segments.filter((segment) => segment.kind === "change").length;
  return (
    <section className="redline-section">
      <div className="result-section-head">
        <div><span className="section-number">01</span><h3>내 원문 · 빨간펜 첨삭</h3></div>
        <span className="correction-count">{correctionCount ? `${correctionCount}곳 교정` : "큰 오류 없음"}</span>
      </div>
      <div className="redline-paper">
        <p className="redline-copy" lang="en">
          {segments.map((segment, index) => segment.kind === "plain"
            ? <span key={`plain-${index}`}>{segment.text}</span>
            : (
              <span className="redline-change" key={`${segment.issueId}-${index}`}>
                <del>{segment.original}</del>
                <span className="redline-arrow" aria-hidden="true"> → </span>
                <ins>{segment.suggestion}</ins>
              </span>
            ))}
        </p>
      </div>
      <div className="redline-legend"><span><i className="legend-delete" />내가 쓴 표현</span><span><i className="legend-insert" />추천 표현</span></div>
    </section>
  );
}

function FinalExplanation({ question, attempt, answerHidden, speakingSeconds, speakingRunning, onSpeakingToggle, onNext, onRetry, onOptionalRewrite }: { question: DailyQuestion; attempt: QuestionAttempt; answerHidden: boolean; speakingSeconds: number; speakingRunning: boolean; onSpeakingToggle: () => void; onNext: () => void; onRetry: () => void; onOptionalRewrite: (value: string) => void }) {
  const feedback = attempt.feedback ?? buildFallbackFeedback("post_rewrite", attempt);
  const polishedAnswer = feedback.naturalEnglish || feedback.correctedEnglish || attempt.englishDraft;
  const candidates = feedback.source === "local-model"
    ? [
        { title: "말하기용 모범답안", content: feedback.modelAnswer, className: "model" },
        { title: "IH → AL 확장 예시", content: feedback.stretchAnswer, className: "stretch" },
      ]
    : [];
  const seenAnswers = new Set<string>();
  const answerSections = candidates.filter((candidate) => {
    if (!candidate.content) return false;
    const key = comparableText(candidate.content).toLowerCase();
    if (seenAnswers.has(key)) return false;
    seenAnswers.add(key);
    return true;
  });
  return (
    <div className="practice-card">
      <p className="eyebrow">RESULT · RED PEN REVIEW</p>
      <h1 className="page-title">내가 쓴 문단 위에서 바로 확인하세요.</h1>
      <p className="question-instruction">틀리거나 어색한 표현은 원문에 빨간 취소선으로 표시하고, 바로 옆에 추천 표현을 붙였습니다. 아래 완성 문단은 내가 말하려던 사실을 유지해 자연스럽게 다듬은 버전입니다.</p>
      {!answerHidden && <FeedbackSourceNotice feedback={feedback} onRetry={feedback.source === "local-model" ? undefined : onRetry} />}
      {!answerHidden && <>
        <RedlineAnswer text={attempt.englishDraft} issues={feedback.issues} />
        <div className="feedback-summary"><small>한 줄 진단</small><p>{feedback.diagnosisKo}</p></div>
        <IntentCoveragePanel feedback={feedback} />
        <section className="reason-section">
          <div className="result-section-head"><div><span className="section-number">02</span><h3>왜 이렇게 고쳤는지</h3></div></div>
          <IssueCards feedback={feedback} />
        </section>
        {feedback.source !== "local-model" && <p className="rules-limit-note">현재 결과는 기본 규칙 교정입니다. 로컬 AI가 준비되기 전에는 자연스러운 개선본·모범답안·AL 확장 예시를 임의로 표시하지 않습니다.</p>}
        <section className="answer-section polished">
          <div className="result-section-head"><div><span className="section-number">03</span><h3>자연스럽게 다듬은 완성 문단</h3></div><span className="answer-badge">내 내용 유지</span></div>
          <p className="answer-copy" lang="en">{polishedAnswer}</p>
        </section>
        {answerSections.map((section) => <section className={`answer-section ${section.className}`} key={section.title}><h3>{section.title}</h3><p className="answer-copy" lang="en">{section.content}</p></section>)}
        {Boolean(feedback.phraseUpgrades?.length) && <section className="answer-section"><h3>다시 쓸 수 있는 표현</h3><div className="phrase-chips">{feedback.phraseUpgrades?.map((phrase) => <span className="phrase-chip" key={`${phrase.from}-${phrase.to}`}>{phrase.to}</span>)}</div></section>}
        <details className="optional-rewrite">
          <summary>선택 연습 · 내가 직접 다시 써보기</summary>
          <p>필수 단계가 아니며, 쓰지 않아도 오늘 학습은 완료됩니다. 첨삭을 확인한 뒤 내 표현으로 한 번 더 정리하고 싶을 때만 사용하세요.</p>
          <div className="draft-wrap"><label className="draft-label" htmlFor="optional-english-rewrite"><span>나의 선택 재작성</span><span className="word-count">{wordCount(attempt.englishRewrite)} words · 자동 저장</span></label><textarea id="optional-english-rewrite" lang="en" className="draft-textarea compact" value={attempt.englishRewrite} onChange={(event) => onOptionalRewrite(event.target.value)} placeholder="Optional: Rewrite the answer in your own words..." /></div>
        </details>
      </>}
      <div className="speaking-card"><div className="timer-ring">{speakingSeconds}s</div><div><h4>{answerHidden ? "답안을 가리고 말하는 중" : "마지막 60~90초 말하기"}</h4><p>녹음하거나 전송하지 않습니다. 화면만 가리고 혼자 말해보세요.</p></div><button type="button" className="secondary-button" onClick={onSpeakingToggle}>{speakingRunning ? "중지·답안 보기" : "답안 가리고 시작"}</button></div>
      <div className="button-row" style={{ marginTop: 20 }}><button type="button" className="primary-button accent" onClick={onNext}>오늘 문제 목록으로 <Icon name="arrow" size={17} /></button></div>
      <p className="question-instruction">연습 질문: {question.promptEn}</p>
    </div>
  );
}

function PracticeScreen({ question, attempt, onBack, updateAttempt, targetLevel, onCompleted, saveStatus }: { question: DailyQuestion; attempt: QuestionAttempt; onBack: () => void; updateAttempt: (attempt: QuestionAttempt) => void; targetLevel: TargetLevel; onCompleted: () => void; saveStatus: SaveStatus }) {
  const [speakingQuestion, setSpeakingQuestion] = useState(false);
  const [answerHidden, setAnswerHidden] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState<number>(question.targetSeconds);
  const feedbackRequestRef = useRef(0);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setSeconds((current) => {
      if (current <= 1) {
        window.clearInterval(id);
        setTimerRunning(false);
        setAnswerHidden(false);
        return question.targetSeconds;
      }
      return current - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, question.targetSeconds]);

  useEffect(() => () => {
    feedbackRequestRef.current += 1;
    window.speechSynthesis?.cancel();
  }, []);

  const patchAttempt = (patch: Partial<QuestionAttempt>) => updateAttempt({ ...attempt, ...patch, updatedAt: new Date().toISOString() });
  const previousStage = getPreviousPracticeStage(attempt.stage);

  const goBackOneStep = () => {
    if (!previousStage) return;
    feedbackRequestRef.current += 1;
    window.speechSynthesis?.cancel();
    setSpeakingQuestion(false);
    setTimerRunning(false);
    setAnswerHidden(false);
    setSeconds(question.targetSeconds);
    patchAttempt({
      stage: previousStage,
      ...(attempt.stage === "completed" ? { completedAt: undefined } : {}),
    });
  };

  const speakQuestion = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.ttsText || question.promptEn);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.localService && /Eva/i.test(voice.name))
      ?? voices.find((voice) => voice.localService && /Aria/i.test(voice.name))
      ?? voices.find((voice) => voice.localService && /Zira/i.test(voice.name))
      ?? voices.find((voice) => voice.localService && /^en[-_]/i.test(voice.lang))
      ?? null;
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakingQuestion(true);
    utterance.onend = () => setSpeakingQuestion(false);
    utterance.onerror = () => setSpeakingQuestion(false);
    window.speechSynthesis.speak(utterance);
  };

  const submitDraft = async () => {
    const requestId = ++feedbackRequestRef.current;
    const pending = { ...attempt, stage: "draft_submitted" as const, updatedAt: new Date().toISOString() };
    updateAttempt(pending);
    // The existing private API reveals complete answer paragraphs in its
    // post-review mode. Feed it the learner's first draft as the review source
    // so a mandatory second draft is no longer needed.
    const reviewAttempt = { ...pending, englishRewrite: pending.englishDraft };
    const feedback = await fetchCoachFeedback("post_rewrite", question, reviewAttempt, targetLevel);
    if (feedbackRequestRef.current !== requestId) return;
    updateAttempt({ ...pending, stage: "completed", feedback, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  };

  const toggleSpeaking = () => {
    if (timerRunning) {
      setTimerRunning(false);
      setAnswerHidden(false);
      setSeconds(question.targetSeconds);
    } else {
      setAnswerHidden(true);
      setSeconds(question.targetSeconds);
      setTimerRunning(true);
    }
  };

  const saveLabel = saveStatus === "error" ? "저장 실패 · 백업 권장" : saveStatus === "saving" ? "이 PC에 저장 중…" : "✓ 이 PC에 저장됨";

  return <div className="practice-shell"><div className="practice-top"><div className="practice-nav-actions"><button type="button" className="back-button" onClick={onBack}><Icon name="back" size={17} /> 오늘 학습</button>{previousStage && <button type="button" className="back-button previous-step-button" onClick={goBackOneStep}><Icon name="back" size={17} /> 이전 단계</button>}</div><span className={`save-chip ${saveStatus === "error" ? "error" : ""}`} aria-live="polite">{saveLabel}</span></div><Stepper stage={attempt.stage} />
    {attempt.stage === "not_started" && <QuestionIntro question={question} speaking={speakingQuestion} onSpeak={speakQuestion} onNext={() => patchAttempt({ stage: "question_seen" })} />}
    {attempt.stage === "question_seen" && <KoreanPlanning question={question} plan={attempt.koreanPlan} onChange={(koreanPlan) => patchAttempt({ koreanPlan })} onNext={() => patchAttempt({ stage: "korean_completed" })} />}
    {attempt.stage === "korean_completed" && <DraftWriting attempt={attempt} onDraft={(englishDraft) => patchAttempt({ englishDraft })} onSubmit={submitDraft} />}
    {(attempt.stage === "draft_submitted" || attempt.stage === "rewrite_submitted") && <LoadingFeedback />}
    {attempt.stage === "feedback_ready" && <DraftWriting attempt={attempt} onDraft={(englishDraft) => patchAttempt({ englishDraft })} onSubmit={submitDraft} />}
    {attempt.stage === "completed" && <FinalExplanation question={question} attempt={attempt} answerHidden={answerHidden} speakingSeconds={seconds} speakingRunning={timerRunning} onSpeakingToggle={toggleSpeaking} onNext={onCompleted} onRetry={submitDraft} onOptionalRewrite={(englishRewrite) => patchAttempt({ englishRewrite })} />}
  </div>;
}

function SettingsScreen({ state, onState, onReset, onBack, onEditSurvey }: { state: CoachState; onState: (state: CoachState) => void; onReset: () => void; onBack: () => void; onEditSurvey: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const downloadBackup = () => {
    const blob = new Blob([exportCoachState(state)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `opic-daily-backup-${getSeoulDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importCoachStateJson(await file.text());
      if (!saveCoachState(imported)) throw new Error("이 브라우저의 로컬 저장소에 저장할 수 없습니다.");
      onState(imported);
      window.alert("로컬 학습 기록을 가져왔습니다.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "백업 파일을 읽을 수 없습니다.");
    } finally {
      event.target.value = "";
    }
  };
  return <div className="practice-shell">
    <div className="practice-top"><button type="button" className="back-button" onClick={onBack}><Icon name="back" size={17} /> 오늘 학습</button></div>
    <section className="practice-card">
      <p className="eyebrow">SETTINGS & PRIVACY</p>
      <h1 className="page-title">내 데이터는 내가 관리합니다.</h1>
      <p className="question-instruction">계정, 광고, 분석 도구, 외부 동기화가 없습니다. 답변과 학습 기록은 이 브라우저의 로컬 저장소에만 남습니다.</p>
      <div className="answer-section">
        <h3>로컬 백업</h3>
        <p className="question-instruction">PC를 바꾸거나 브라우저 데이터를 지우기 전에 JSON 파일로 보관할 수 있습니다.</p>
        <div className="backup-warning"><Icon name="lock" size={17} /><span><strong>백업 파일에는 답변이 그대로 들어갑니다.</strong> 작성한 한국어·영어 답변과 피드백이 평문으로 포함되므로 다른 사람과 공유하지 마세요.</span></div>
        <div className="button-row"><button type="button" className="secondary-button" onClick={downloadBackup}>학습 기록 내보내기</button><button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>백업 가져오기</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} hidden /></div>
      </div>
      <div className="answer-section">
        <h3>사전 설문</h3>
        <p className="question-instruction">선택한 관심 주제 {state.profile.selectedInterestIds.length}개 · 목표 {state.settings.targetLevel}. 기존 답변과 학습 기록을 지우지 않고 다시 선택할 수 있습니다.</p>
        <button type="button" className="secondary-button" onClick={onEditSurvey}>설문 다시 선택</button>
      </div>
      <div className="answer-section danger-section">
        <h3>모든 로컬 데이터 삭제</h3>
        <p className="question-instruction">질문 답변, 피드백, 연속 학습 기록과 설문 선택을 모두 삭제합니다.</p>
        <button type="button" className="secondary-button" onClick={() => { if (window.confirm("이 PC에 저장된 OPIc Daily Coach 데이터를 모두 삭제할까요?")) onReset(); }}>전체 삭제</button>
      </div>
      <p className="question-instruction">앱 버전 v{APP_VERSION} · 문항 버전 {CURRICULUM_VERSION}</p>
      <p className="question-instruction">문항 안내: {QUESTION_BANK_SOURCE_LABEL}</p>
    </section>
  </div>;
}

export default function Home() {
  const [state, setState] = useState<CoachState>(() => createEmptyCoachState());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [coachMode, setCoachMode] = useState<CoachMode>("checking");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saving");
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [todayKey, setTodayKey] = useState(() => getSeoulDateKey());
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setState(loadCoachState());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let requestRunning = false;
    let activeController: AbortController | undefined;

    const checkHealth = async () => {
      if (stopped || requestRunning) return;
      requestRunning = true;
      let ready = false;
      activeController = new AbortController();
      const timeout = window.setTimeout(() => activeController?.abort(), 3_000);
      try {
        const response = await fetch("/api/health", { cache: "no-store", signal: activeController.signal });
        if (!response.ok) throw new Error("health unavailable");
        const health = await response.json() as { mode?: string };
        ready = health.mode === "local-model";
        setCoachMode(ready ? "local-model" : "rules-only");
      } catch {
        setCoachMode("rules-only");
      } finally {
        window.clearTimeout(timeout);
        activeController = undefined;
        requestRunning = false;
        if (!stopped) timer = window.setTimeout(checkHealth, ready ? 30_000 : 4_000);
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) window.clearTimeout(timer);
      void checkHealth();
    };

    void checkHealth();
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkWhenVisible);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      activeController?.abort();
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const statusTimer = window.setTimeout(() => setSaveStatus("saving"), 0);
    const saveTimer = window.setTimeout(() => setSaveStatus(saveCoachState(state) ? "saved" : "error"), 450);
    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(saveTimer);
    };
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") setSaveStatus(saveCoachState(stateRef.current) ? "saved" : "error");
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [hydrated]);

  useEffect(() => {
    const refreshDate = () => {
      const nextKey = getSeoulDateKey();
      if (nextKey === todayKey) return;
      setTodayKey(nextKey);
      setActiveQuestionId(null);
      setScreen("home");
      window.scrollTo(0, 0);
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") refreshDate();
    };
    const nextDateKey = shiftDateKey(todayKey, 1);
    const midnightDelay = Math.max(1_000, new Date(`${nextDateKey}T00:00:02+09:00`).getTime() - Date.now());
    const midnightTimer = window.setTimeout(refreshDate, Math.min(midnightDelay, 2_147_000_000));
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", refreshDate);
    };
  }, [todayKey]);

  const questions = useMemo(() => {
    const pinnedIds = state.days[todayKey]?.questionIds ?? [];
    const pinnedFirst = pinnedIds[0] ? getQuestionById(pinnedIds[0]) : undefined;
    const pinnedSecond = pinnedIds[1] ? getQuestionById(pinnedIds[1]) : undefined;
    if (pinnedFirst && pinnedSecond) return [pinnedFirst, pinnedSecond] as const;

    const effectiveCategories = new Set(state.profile.selectedInterestIds);
    const role = state.profile.surveyAnswers.role;
    const residence = state.profile.surveyAnswers.residence;
    if (role === "worker") effectiveCategories.add("work_career");
    if (role === "student") effectiveCategories.add("study_learning");
    if (typeof residence === "string" && residence) effectiveCategories.add("home_neighborhood");
    return getQuestionPairForDate(todayKey, [...effectiveCategories]);
  }, [state.days, state.profile.selectedInterestIds, state.profile.surveyAnswers.role, state.profile.surveyAnswers.residence, todayKey]);

  const activeQuestion = questions.find((question) => question.id === activeQuestionId) ?? null;
  const activeAttempt = activeQuestion
    ? state.days[todayKey]?.attempts[activeQuestion.id] ?? createQuestionAttempt(activeQuestion.id)
    : null;

  const updateAttempt = useCallback((attempt: QuestionAttempt) => {
    setState((current) => upsertQuestionAttempt(current, todayKey, attempt));
  }, [todayKey]);

  const startQuestion = (question: DailyQuestion) => {
    let attempt = state.days[todayKey]?.attempts[question.id] ?? createQuestionAttempt(question.id);
    if (["draft_submitted", "feedback_ready", "rewrite_submitted"].includes(attempt.stage)) {
      attempt = { ...attempt, stage: "korean_completed" };
    }
    if (!attempt.startedAt) attempt = { ...attempt, startedAt: new Date().toISOString() };
    setState((current) => {
      const updated = upsertQuestionAttempt(current, todayKey, attempt);
      return {
        ...updated,
        days: {
          ...updated.days,
          [todayKey]: { ...updated.days[todayKey], questionIds: questions.map((item) => item.id) },
        },
      };
    });
    setActiveQuestionId(question.id);
    setScreen("practice");
    window.scrollTo(0, 0);
  };

  const completeOnboarding = ({ role, residence, interests, targetLevel }: SurveyPayload) => {
    setState((current) => ({ ...current, profile: { selectedInterestIds: interests, surveyAnswers: { role, residence } }, settings: { ...current.settings, targetLevel }, updatedAt: new Date().toISOString() }));
    setEditingSurvey(false);
    window.scrollTo(0, 0);
  };

  if (!hydrated) return <main className="loading-pane"><div className="loading-dots"><i /><i /><i /></div></main>;
  if (!state.profile.surveyAnswers.role || state.profile.selectedInterestIds.length < 4) return <Onboarding onComplete={completeOnboarding} />;
  if (editingSurvey) {
    const role = typeof state.profile.surveyAnswers.role === "string" ? state.profile.surveyAnswers.role : "worker";
    const residence = typeof state.profile.surveyAnswers.residence === "string" ? state.profile.surveyAnswers.residence : "family";
    return <Onboarding initial={{ role, residence, interests: state.profile.selectedInterestIds, targetLevel: state.settings.targetLevel }} onComplete={(payload) => { completeOnboarding(payload); setScreen("settings"); }} onCancel={() => setEditingSurvey(false)} />;
  }

  return <div className="app-shell"><SideRail screen={screen} onNavigate={(next) => { setScreen(next); if (next !== "practice") setActiveQuestionId(null); window.scrollTo(0, 0); }} /><main className="main-pane"><Topbar coachMode={coachMode} />
    {saveStatus === "error" && <div className="save-error-banner" role="alert"><strong>자동 저장에 실패했습니다.</strong><span>이 탭을 닫지 말고 설정·백업에서 JSON 파일을 먼저 내보내세요.</span></div>}
    {screen === "home" && <HomeScreen state={state} todayKey={todayKey} questions={questions} onStart={startQuestion} />}
    {screen === "records" && <RecordsScreen state={state} todayKey={todayKey} />}
    {screen === "practice" && activeQuestion && activeAttempt && <PracticeScreen question={activeQuestion} attempt={activeAttempt} onBack={() => { setScreen("home"); setActiveQuestionId(null); }} updateAttempt={updateAttempt} targetLevel={state.settings.targetLevel} onCompleted={() => { setScreen("home"); setActiveQuestionId(null); }} saveStatus={saveStatus} />}
    {screen === "settings" && <SettingsScreen state={state} onState={setState} onBack={() => setScreen("home")} onEditSurvey={() => setEditingSurvey(true)} onReset={() => { clearCoachState(); setState(createEmptyCoachState()); setScreen("home"); }} />}
  </main></div>;
}
