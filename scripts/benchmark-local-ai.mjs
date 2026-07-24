import { performance } from "node:perf_hooks";

import {
  checkOllamaHealth,
  createCoachFeedback,
} from "../local-launcher/coach.mjs";

const samples = [
  {
    name: "gym-collocations",
    question: "Describe the place where you exercise and explain why it matters to you.",
    koreanPlan: {
      answer: "나는 집 근처 헬스장에서 운동한다.",
      reason: "회사 스트레스를 풀고 건강을 유지하기 좋다.",
      example: "지난 금요일에 친구와 한 시간 운동했다.",
      closing: "그곳은 나에게 가장 편한 충전 공간이다.",
    },
    englishDraft: "I usually exercise at a gym near my home. I can release my stress and keep my health there. Last Friday, I had a promise with my friend and we played exercise for one hour. It is my best charging place.",
  },
  {
    name: "health-literal-translation",
    question: "Tell me about a time when you had to change your plans because you were not feeling well.",
    koreanPlan: {
      answer: "몸이 좋지 않아 친구와의 약속을 취소했다.",
      reason: "열이 나고 너무 피곤했다.",
      example: "약을 먹고 집에서 쉬었다.",
      closing: "다음 날에는 훨씬 나아졌다.",
    },
    englishDraft: "My condition was bad, so I canceled a promise with my friend. I had a fever and I was very tired. I ate medicine and took a rest at home. I became much better next day.",
  },
  {
    name: "travel-pension",
    question: "Describe a memorable place where you stayed during a trip.",
    koreanPlan: {
      answer: "바다 근처 펜션에 묵었다.",
      reason: "방에서 바다가 보여서 좋았다.",
      example: "아침에 친구와 해변을 걸었다.",
      closing: "오랜만에 정말 편하게 쉬었다.",
    },
    englishDraft: "We stayed at a pension near the beach. I liked it because I could see the sea in the room. I walked the beach with my friend in the morning. I took a comfortable rest after a long time.",
  },
  {
    name: "recommendation",
    question: "Recommend a place in your neighborhood and explain why people should visit it.",
    koreanPlan: {
      answer: "집 근처 공원을 추천한다.",
      reason: "조용하고 산책로가 잘 되어 있다.",
      example: "지난주에는 친구와 걸으며 회사 이야기를 했다.",
      closing: "쉬고 싶을 때 가기 좋은 곳이다.",
    },
    englishDraft: "I recommend you to visit a park near my home. It is quiet and the walking road is well made. Last week, I walked there with my friend and talked about company. It is a good place when you want to take a rest.",
  },
  {
    name: "transport-change",
    question: "How has public transportation in your area changed, and which change has helped you the most?",
    koreanPlan: {
      answer: "우리 동네에는 최근 버스 도착 안내 화면이 생겼다.",
      reason: "버스가 언제 오는지 정확히 알 수 있어 기다리는 시간이 덜 답답하다.",
      example: "지난주 비 오는 날에는 화면을 보고 카페에서 조금 더 기다렸다.",
      closing: "작은 변화지만 출퇴근이 훨씬 편해졌다.",
    },
    englishDraft: "Recently my neighborhood made bus arrival screens. I can know when the bus comes, so waiting is less frustrating. Last week it was rainy, and I waited more in a cafe after watching the screen. It is a small change, but my commute became convenient.",
  },
];

const health = await checkOllamaHealth({ timeoutMs: 3_000 });
console.log(JSON.stringify({ health }));
if (!health.primaryAvailable) process.exitCode = 2;

for (const sample of samples) {
  const started = performance.now();
  const result = await createCoachFeedback({
    stage: "feedback",
    targetLevel: "AL",
    question: sample.question,
    koreanPlan: sample.koreanPlan,
    englishDraft: sample.englishDraft,
    rewriteDraft: "",
  }, { timeoutMs: 180_000 });
  console.log(JSON.stringify({
    name: sample.name,
    seconds: Number(((performance.now() - started) / 1_000).toFixed(2)),
    source: result.source,
    model: result.modelUsed,
    fallbackReason: result.fallbackReason,
    issueCount: result.issues.length,
    factsPreserved: result.factsPreserved,
  }));
}

const finalSample = samples[0];
const finalStarted = performance.now();
const finalResult = await createCoachFeedback({
  stage: "post_rewrite",
  targetLevel: "AL",
  question: finalSample.question,
  koreanPlan: finalSample.koreanPlan,
  englishDraft: finalSample.englishDraft,
  rewriteDraft: "I work out at a gym near my home. It helps me relieve stress from work and stay healthy. Last Friday, I had plans with my friend, and we worked out for an hour. It is the best place for me to recharge.",
}, { timeoutMs: 180_000 });

const finalFields = [
  "correctedEnglish",
  "naturalEnglish",
  "modelAnswer",
  "stretchAnswer",
];
const presentFinalFields = finalFields.filter((field) =>
  typeof finalResult[field] === "string" && finalResult[field].trim());
const generatedText = presentFinalFields.map((field) => finalResult[field]).join("\n");

console.log(JSON.stringify({
  name: "post-rewrite",
  seconds: Number(((performance.now() - finalStarted) / 1_000).toFixed(2)),
  source: finalResult.source,
  model: finalResult.modelUsed,
  fallbackReason: finalResult.fallbackReason,
  answerCount: presentFinalFields.length,
  nullFields: finalFields.filter((field) => !presentFinalFields.includes(field)),
  malformedTransition:
    /\b(?:because It|While We|although It|when We|since It)\b/.test(generatedText) ||
    /\b(?:although|because|since|while|when)\b[^.!?]{0,100},\s*so\b/i.test(generatedText),
  coverage: finalResult.score?.metrics?.coverage,
  factsPreserved: finalResult.factsPreserved,
}));
