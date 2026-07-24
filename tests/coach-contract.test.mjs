import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";

import { APP_VERSION as CLIENT_APP_VERSION } from "../app/lib/version.ts";
import { APP_VERSION as SERVER_APP_VERSION } from "../local-launcher/version.mjs";

import {
  ANALYSIS_TIMEOUT_MS,
  COACH_RESPONSE_SCHEMA,
  FALLBACK_MODEL,
  FINAL_TIMEOUT_MS,
  FINAL_ANSWER_RESPONSE_SCHEMA,
  MAX_MODEL_TOTAL_TIMEOUT_MS,
  OLLAMA_BASE_URL,
  PRIMARY_MODEL,
  RETRY_TIMEOUT_MS,
  applyLocalRules,
  createCoachFeedback,
  validateCoachRequest,
} from "../local-launcher/coach.mjs";
import {
  LOCAL_HOST,
  createCoachServer,
  startCoachServer,
  warmLocalModel,
} from "../local-launcher/server.mjs";

const baseRequest = {
  stage: "feedback",
  targetLevel: "AL",
  question: "Tell me about a memorable day with a friend.",
  koreanPlan: {
    answer: "오랜만에 친구를 만나서 기억에 남았다.",
    reason: "둘 다 바빴기 때문이다.",
    example: "카페에서 이야기했다.",
    closing: "그래서 기분이 좋았다.",
  },
  englishDraft: "After a long time, I had a promise with my friend. We talked at a cafe.",
};

test("client, server, and package versions stay aligned", () => {
  const packageJson = JSON.parse(readFileSync(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(CLIENT_APP_VERSION, packageJson.version);
  assert.equal(SERVER_APP_VERSION, packageJson.version);
});

function validModelFeedback(overrides = {}) {
  return {
    stage: "feedback",
    diagnosisKo: "뜻은 전달되지만 한국어식 표현을 먼저 다듬어야 합니다.",
    intentCoverage: { answer: true, reason: true, example: true, closing: true },
    issues: [
      {
        priority: 1,
        original: "After a long time",
        corrected: "For the first time in a long time",
        category: "naturalness",
        explanationKo: "오랜만에는 이 표현이 자연스럽습니다.",
      },
      {
        priority: 2,
        original: "I had a promise with my friend",
        corrected: "I had plans with my friend",
        category: "naturalness",
        explanationKo: "친구와 약속이 있었다는 뜻에는 have plans가 자연스럽습니다.",
      },
      {
        priority: 3,
        original: "talked at a cafe",
        corrected: "caught up at a cafe",
        category: "naturalness",
        explanationKo: "밀린 이야기를 했다는 맥락이면 catch up이 자연스럽습니다.",
      },
      {
        priority: 3,
        original: "We talked",
        corrected: "We had a conversation",
        category: "naturalness",
        explanationKo: "네 번째 항목은 서버가 제거해야 합니다.",
      },
    ],
    rewriteTargets: ["오랜만에 표현 고치기", "약속 표현 고치기", "직접 다시 쓰기"],
    correctedEnglish: null,
    naturalEnglish: null,
    modelAnswer: null,
    stretchAnswer: null,
    phraseUpgrades: [],
    nextTaskKo: "세 가지만 반영해 다시 써 보세요.",
    factsPreserved: true,
    factAdditions: [],
    ...overrides,
  };
}

function ollamaEnvelope(feedback) {
  return new Response(JSON.stringify({
    message: { role: "assistant", content: JSON.stringify(feedback) },
    done: true,
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function validPostAnalysis(overrides = {}) {
  return validModelFeedback({
    stage: "post_rewrite",
    issues: [],
    rewriteTargets: ["재작성한 답변의 흐름을 확인했습니다."],
    correctedEnglish: null,
    naturalEnglish: null,
    modelAnswer: null,
    stretchAnswer: null,
    phraseUpgrades: [],
    nextTaskKo: "교정 전후를 소리 내어 비교해 보세요.",
    ...overrides,
  });
}

function validFinalAnswers(rewriteDraft, overrides = {}) {
  return {
    correctedEnglish: rewriteDraft,
    naturalEnglish: `Actually, ${rewriteDraft}`,
    modelAnswer: `Here is the main point. ${rewriteDraft}`,
    stretchAnswer: `Because that experience matters, I can explain the point clearly. However, when I look back on it, the same conclusion stands. Overall, ${rewriteDraft}`,
    ...overrides,
  };
}

function isFinalAnswerPass(body) {
  return body?.format?.required?.length === 4 &&
    !Object.hasOwn(body.format.properties ?? {}, "stage");
}

function schemaKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    schemaKeys(nested, keys);
  }
  return keys;
}

test("Ollama response schema omits unsupported grammar constraints", () => {
  for (const schema of [COACH_RESPONSE_SCHEMA, FINAL_ANSWER_RESPONSE_SCHEMA]) {
    const keys = new Set(schemaKeys(schema));
    for (const unsupported of [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
    ]) {
      assert.equal(keys.has(unsupported), false, `${unsupported} must be normalized in code instead`);
    }
  }
  assert.equal(ANALYSIS_TIMEOUT_MS, 45_000);
  assert.equal(FINAL_TIMEOUT_MS, 30_000);
  assert.equal(RETRY_TIMEOUT_MS, 15_000);
  assert.equal(MAX_MODEL_TOTAL_TIMEOUT_MS, 90_000);
  assert.equal(
    ANALYSIS_TIMEOUT_MS + FINAL_TIMEOUT_MS + RETRY_TIMEOUT_MS,
    MAX_MODEL_TOTAL_TIMEOUT_MS,
  );
});

test("local model request is fixed to loopback, disables thinking/streaming, and hides answers before rewrite", async () => {
  const calls = [];
  const feedback = await createCoachFeedback(baseRequest, {
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return ollamaEnvelope(validModelFeedback());
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${OLLAMA_BASE_URL}/api/chat`);
  assert.equal(calls[0].body.model, PRIMARY_MODEL);
  assert.equal(calls[0].body.think, false);
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.keep_alive, "30m");
  assert.equal(calls[0].body.format.properties.stage.enum[0], "feedback");
  assert.equal(calls[0].body.format.properties.correctedEnglish.type, "null");
  assert.equal(calls[0].body.options.num_predict, 800);
  const systemPrompt = calls[0].body.messages[0].content;
  assert.ok(systemPrompt.length <= Math.floor(3_519 * 0.7));
  assert.match(systemPrompt, /issues.*empty array|issues:\s*\[\]/i);
  assert.equal(feedback.source, "local-model");
  assert.equal(feedback.modelUsed, PRIMARY_MODEL);
  assert.equal(feedback.issues.length, 3);
  assert.equal(feedback.correctedEnglish, null);
  assert.equal(feedback.naturalEnglish, null);
  assert.equal(feedback.modelAnswer, null);
  assert.equal(feedback.stretchAnswer, null);
  assert.deepEqual(feedback.phraseUpgrades, []);
});

test("post-rewrite uses analysis-only then closed-book answer generation", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const calls = [];
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft)
        : validPostAnalysis());
    },
  });

  assert.equal(calls.length, 2);
  const [analysisBody, finalBody] = calls;
  assert.equal(analysisBody.format.properties.correctedEnglish.type, "null");
  assert.equal(analysisBody.format.properties.stretchAnswer.type, "null");
  assert.equal(analysisBody.options.num_predict, 800);
  const analysisInput = JSON.parse(analysisBody.messages[1].content);
  assert.equal(analysisInput.englishDraft, null);
  assert.equal(analysisInput.rewriteDraft, request.rewriteDraft);

  assert.deepEqual(finalBody.format, FINAL_ANSWER_RESPONSE_SCHEMA);
  assert.equal(finalBody.options.temperature, 0);
  assert.equal(finalBody.options.num_predict, 800);
  assert.equal(finalBody.keep_alive, "30m");
  const finalInput = JSON.parse(finalBody.messages[1].content);
  assert.deepEqual(finalInput.source.allowedPropositions, [request.rewriteDraft]);
  assert.deepEqual(finalInput.source.discoursePlan, request.koreanPlan);
  assert.ok(finalInput.source.hardLocks.length >= 4);
  assert.equal(Object.hasOwn(finalInput, "candidates"), false);
  assert.equal(Object.hasOwn(finalInput.source, "englishDraft"), false);
  assert.equal(result.source, "local-model");
  assert.notEqual(result.correctedEnglish, result.naturalEnglish);
  assert.notEqual(result.modelAnswer, result.stretchAnswer);
});

test("Korean coaching fields fall back safely when a model answers them in English", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft)
        : validPostAnalysis({
            diagnosisKo: "This field should have been Korean.",
            issues: [{
              priority: 1,
              original: "met my friend",
              corrected: "caught up with my friend",
              category: "naturalness",
              explanationKo: "This explanation should have been Korean.",
            }],
            rewriteTargets: ["Write this target in Korean."],
            nextTaskKo: "This task should have been Korean.",
          }));
    },
  });

  assert.match(result.diagnosisKo, /[가-힣]/u);
  assert.match(result.nextTaskKo, /[가-힣]/u);
  assert.ok(result.rewriteTargets.every((target) => /[가-힣]/u.test(target)));
  assert.deepEqual(result.issues, []);
});

test("feedback drops a correction that invents an unsupported brand", async () => {
  const result = await createCoachFeedback(baseRequest, {
    fetchImpl: async () => ollamaEnvelope(validModelFeedback({
      issues: [{
        priority: 1,
        original: "We talked at a cafe",
        corrected: "We talked at Starbucks",
        category: "naturalness",
        explanationKo: "브랜드를 임의로 더한 잘못된 제안입니다.",
      }],
    })),
  });

  assert.equal(result.source, "local-model");
  assert.deepEqual(result.issues, []);
});

test("keeps valid analysis and hides final cards after one empty-answer retry", async () => {
  const calls = [];
  const result = await createCoachFeedback({
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  }, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      const model = body.model;
      if (model === FALLBACK_MODEL) return new Response("missing", { status: 404 });
      return ollamaEnvelope(isFinalAnswerPass(body) ? {
        correctedEnglish: "",
        naturalEnglish: "",
        modelAnswer: "",
        stretchAnswer: "",
      } : validPostAnalysis());
    },
  });

  assert.deepEqual(calls.map((body) => body.model), [
    PRIMARY_MODEL,
    PRIMARY_MODEL,
    PRIMARY_MODEL,
  ]);
  assert.equal(result.source, "local-model");
  assert.equal(result.fallbackReason, null);
  assert.ok([
    result.correctedEnglish,
    result.naturalEnglish,
    result.modelAnswer,
    result.stretchAnswer,
  ].every((value) => value === null));
});

test("falls back from qwen3.5:9b to qwen3.5:4b", async () => {
  const models = [];
  const result = await createCoachFeedback(baseRequest, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      models.push(body.model);
      if (body.model === PRIMARY_MODEL) return new Response("missing", { status: 404 });
      return ollamaEnvelope(validModelFeedback());
    },
  });

  assert.deepEqual(models, [PRIMARY_MODEL, FALLBACK_MODEL]);
  assert.equal(result.source, "local-model");
  assert.equal(result.modelUsed, FALLBACK_MODEL);
});

test("skips a fallback model that the health manifest says is not installed", async () => {
  const models = [];
  const result = await createCoachFeedback(baseRequest, {
    availableModels: [PRIMARY_MODEL],
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      models.push(body.model);
      return new Response("primary failed", { status: 500 });
    },
  });

  assert.deepEqual(models, [PRIMARY_MODEL]);
  assert.equal(result.source, "rules-only");
});

test("local-model feedback never borrows rewrite targets from rules-only mode", async () => {
  const result = await createCoachFeedback(baseRequest, {
    fetchImpl: async () => ollamaEnvelope(validModelFeedback({
      issues: [],
      rewriteTargets: [],
    })),
  });

  assert.equal(result.source, "local-model");
  assert.deepEqual(result.rewriteTargets, []);
});

test("rules-only mode remains usable and does not invent facts when both models are unavailable", async () => {
  const unavailable = async () => {
    throw new Error("offline");
  };
  const first = await createCoachFeedback({
    ...baseRequest,
    englishDraft: "I went to home. My condition was bad, so I ate medicine and took a rest.",
  }, { fetchImpl: unavailable, timeoutMs: 20 });

  assert.equal(first.source, "rules-only");
  assert.equal(first.issues.length, 3);
  assert.equal(first.correctedEnglish, null);
  assert.equal(first.modelAnswer, null);
  assert.equal(first.factsPreserved, true);
  assert.equal(first.fallbackReason, "model_unreachable");

  const post = await createCoachFeedback({
    ...baseRequest,
    stage: "post_rewrite",
    englishDraft: "I went to home. My condition was bad.",
    rewriteDraft: "I went to home because my condition was bad.",
  }, { fetchImpl: unavailable, timeoutMs: 20 });

  assert.equal(post.source, "rules-only");
  assert.equal(post.correctedEnglish, "I went home because I wasn't feeling well.");
  assert.equal(post.naturalEnglish, null);
  assert.equal(post.modelAnswer, null);
  assert.equal(post.stretchAnswer, null);
  assert.doesNotMatch(post.correctedEnglish, /Seoul|yesterday|2025/i);
  assert.match(post.score.band, /^(?:IM2|IH|AL)$/);
  assert.equal(typeof post.score.totalScore, "number");
  assert.ok(post.score.gapToTarget.length <= 2);
});

test("a model timeout uses the shared budget, skips the second model, and exposes only a safe code", async () => {
  let calls = 0;
  const result = await createCoachFeedback(baseRequest, {
    timeoutMs: 15,
    fetchImpl: async (_url, init) => {
      calls += 1;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("private answer must not escape", "AbortError"));
        }, { once: true });
      });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.source, "rules-only");
  assert.equal(result.fallbackReason, "model_timeout");
  assert.match(result.fallbackReason, /^[a-z_]+$/);
  assert.doesNotMatch(JSON.stringify(result.fallbackReason), /private answer/i);
});

test("post-rewrite analysis and final generation receive separate time budgets", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  let calls = 0;
  let finalStartedAt = 0;
  let finalAbortedAt = 0;
  const result = await createCoachFeedback(request, {
    timeoutMs: 25,
    fetchImpl: async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      if (!isFinalAnswerPass(body)) {
        await new Promise((resolve) => setTimeout(resolve, 18));
        return ollamaEnvelope(validPostAnalysis());
      }
      finalStartedAt = Date.now();
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          finalAbortedAt = Date.now();
          reject(new DOMException("private rewrite", "AbortError"));
        }, { once: true });
      });
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.source, "rules-only");
  assert.equal(result.fallbackReason, "model_timeout");
  assert.ok(finalAbortedAt - finalStartedAt >= 18);
  assert.doesNotMatch(JSON.stringify(result), /private rewrite/i);
});

test("an external abort stops the current model request and never tries the fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const pending = createCoachFeedback(baseRequest, {
    signal: controller.signal,
    fetchImpl: async (_url, init) => {
      calls += 1;
      markStarted();
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      });
    },
  });

  await started;
  controller.abort();
  await assert.rejects(pending, (error) => error?.code === "REQUEST_ABORTED");
  assert.equal(calls, 1);
});

test("isolates a model answer that adds unsupported numeric facts", async () => {
  const postRequest = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const unsafe = validFinalAnswers(postRequest.rewriteDraft, {
    naturalEnglish: `${postRequest.rewriteDraft} We talked for 3 hours.`,
  });
  const models = [];

  const result = await createCoachFeedback(postRequest, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      const model = body.model;
      models.push(model);
      return ollamaEnvelope(isFinalAnswerPass(body) ? unsafe : validPostAnalysis());
    },
  });

  assert.deepEqual(models, [PRIMARY_MODEL, PRIMARY_MODEL]);
  assert.equal(result.modelUsed, PRIMARY_MODEL);
  assert.equal(result.naturalEnglish, null);
  assert.equal(typeof result.correctedEnglish, "string");
});

test("isolates newly invented proper place names without rejecting ordinary fields", async () => {
  const postRequest = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const unsafe = validFinalAnswers(postRequest.rewriteDraft, {
    naturalEnglish: `${postRequest.rewriteDraft} Seoul was our next stop.`,
  });
  const models = [];

  const result = await createCoachFeedback(postRequest, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      const model = body.model;
      models.push(model);
      return ollamaEnvelope(isFinalAnswerPass(body) ? unsafe : validPostAnalysis());
    },
  });

  assert.deepEqual(models, [PRIMARY_MODEL, PRIMARY_MODEL]);
  assert.equal(result.modelUsed, PRIMARY_MODEL);
  assert.equal(result.naturalEnglish, null);
  assert.match(result.modelAnswer, /Here is the main point/);
});

test("post-rewrite rejects changed frequency and inferred contact actions", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      answer: "밤에는 조용히 하고 이웃에게 인사하겠다.",
      reason: "작은 소리도 스트레스를 줄 수 있기 때문이다.",
      example: "한 번 밤늦게 음악을 틀었고 아래층에서 연락을 받아 볼륨을 낮췄다.",
      closing: "이 규칙을 지키면 더 편안하다.",
    },
    englishDraft: "I played music late before and my neighbor contacted me.",
    rewriteDraft: "I once played music late at night. My downstairs neighbor contacted me, so I turned the volume down.",
  };
  const unsafe = validFinalAnswers(request.rewriteDraft, {
    naturalEnglish: "I used to play music late at night, and my downstairs neighbor told me to stop because they could not sleep.",
  });
  const calls = [];

  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      return ollamaEnvelope(isFinalAnswerPass(body) ? unsafe : validPostAnalysis());
    },
  });

  assert.deepEqual(calls.map((body) => body.model), [PRIMARY_MODEL, PRIMARY_MODEL]);
  const primaryFinalInput = JSON.parse(calls[1].messages[1].content);
  assert.match(primaryFinalInput.source.hardLocks.join("\n"), /one-time event/i);
  assert.match(primaryFinalInput.source.hardLocks.join("\n"), /only says that someone contacted/i);
  assert.equal(result.modelUsed, PRIMARY_MODEL);
  assert.equal(result.naturalEnglish, null);
  assert.doesNotMatch(Object.values(result).join("\n"), /used to|told me to|sleep/i);
  assert.match(result.correctedEnglish, /once/i);
  assert.match(result.correctedEnglish, /contacted me/i);
});

test("post-rewrite retries duplicate final answers instead of disguising them with prefixes", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const duplicate = {
    correctedEnglish: request.rewriteDraft,
    naturalEnglish: request.rewriteDraft.toLowerCase(),
    modelAnswer: `${request.rewriteDraft}!`,
    stretchAnswer: `  ${request.rewriteDraft}  `,
  };
  const calls = [];
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (!isFinalAnswerPass(body)) return ollamaEnvelope(validPostAnalysis());
      return ollamaEnvelope(calls.filter(isFinalAnswerPass).length === 1
        ? duplicate
        : validFinalAnswers(request.rewriteDraft));
    },
  });

  assert.equal(calls.length, 3);
  const retryInput = JSON.parse(calls[2].messages[1].content);
  assert.ok(retryInput.retryConstraints.some((item) => /duplicate/i.test(item)));
  assert.equal(result.modelUsed, PRIMARY_MODEL);
  assert.equal(new Set([
    result.correctedEnglish,
    result.naturalEnglish,
    result.modelAnswer,
    result.stretchAnswer,
  ].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""))).size, 4);
  assert.doesNotMatch(result.naturalEnglish, /^Put simply,/i);
  assert.doesNotMatch(result.modelAnswer, /^Here's how I'd explain it\./i);
});

test("post-rewrite hides duplicate fields when one retry still violates the contract", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const duplicate = {
    correctedEnglish: request.rewriteDraft,
    naturalEnglish: request.rewriteDraft,
    modelAnswer: request.rewriteDraft,
    stretchAnswer: request.rewriteDraft,
  };
  let finalCalls = 0;
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (!isFinalAnswerPass(body)) return ollamaEnvelope(validPostAnalysis());
      finalCalls += 1;
      return ollamaEnvelope(duplicate);
    },
  });

  assert.equal(finalCalls, 2);
  const answers = [
    result.correctedEnglish,
    result.naturalEnglish,
    result.modelAnswer,
    result.stretchAnswer,
  ].filter(Boolean);
  assert.equal(answers.length, 1);
  assert.equal(answers[0], request.rewriteDraft);
});

test("post-rewrite retries unchanged corrections and weak AL stretch answers", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "I had plans with my friend, and we talked at a cafe.",
  };
  const weak = validFinalAnswers(request.rewriteDraft, {
    correctedEnglish: request.rewriteDraft,
    stretchAnswer: `Looking at it more broadly, ${request.rewriteDraft}`,
  });
  const strong = validFinalAnswers("I had plans with my friend, and we talked at a cafe.", {
    correctedEnglish: "I had plans with my friend, and we caught up at a cafe.",
  });
  const calls = [];
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (!isFinalAnswerPass(body)) {
        return ollamaEnvelope(validPostAnalysis({
          issues: [{
            priority: 1,
            original: "talked at a cafe",
            corrected: "caught up at a cafe",
            category: "naturalness",
            explanationKo: "회화에서는 catch up이 자연스럽습니다.",
          }],
        }));
      }
      return ollamaEnvelope(calls.filter(isFinalAnswerPass).length === 1 ? weak : strong);
    },
  });

  assert.equal(calls.length, 3);
  const retryInput = JSON.parse(calls[2].messages[1].content);
  assert.ok(retryInput.retryConstraints.some((item) => /correctedEnglish/i.test(item)));
  assert.ok(retryInput.retryConstraints.some((item) => /stretchAnswer/i.test(item)));
  assert.match(result.correctedEnglish, /caught up at a cafe/i);
  assert.notEqual(result.stretchAnswer, weak.stretchAnswer);
});

test("final answer cards cannot repeat phrases rejected by the same review", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      answer: "집 근처 헬스장에서 운동한다.",
      reason: "스트레스를 풀고 건강을 유지하기 좋다.",
      example: "지난 금요일에 친구와 한 시간 운동했다.",
      closing: "그곳은 나에게 가장 편한 충전 공간이다.",
    },
    englishDraft: "I exercise at a gym near my home.",
    rewriteDraft: "I exercise at a gym near my home. Last Friday, I had a promise with my friend and we played exercise for one hour.",
  };
  const analysis = validPostAnalysis({
    issues: [
      {
        priority: 1,
        original: "I had a promise with my friend",
        corrected: "I had plans with my friend",
        category: "naturalness",
        explanationKo: "약속이 있었다는 뜻에는 had plans가 자연스럽습니다.",
      },
      {
        priority: 2,
        original: "we played exercise for one hour",
        corrected: "we exercised for one hour",
        category: "grammar",
        explanationKo: "exercise를 동사로 사용해야 합니다.",
      },
    ],
  });
  const rejected = validFinalAnswers(request.rewriteDraft);
  const repairedBase = "I exercise at a gym near my home. Last Friday, I had plans with my friend and we exercised for one hour.";
  const repaired = validFinalAnswers(repairedBase);
  const calls = [];

  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (!isFinalAnswerPass(body)) return ollamaEnvelope(analysis);
      return ollamaEnvelope(calls.filter(isFinalAnswerPass).length === 1
        ? rejected
        : repaired);
    },
  });

  assert.equal(calls.length, 3);
  const firstFinalInput = JSON.parse(calls[1].messages[1].content);
  assert.deepEqual(firstFinalInput.source.requiredCorrections, [
    {
      original: "I had a promise with my friend",
      corrected: "I had plans with my friend",
    },
    {
      original: "we played exercise for one hour",
      corrected: "we exercised for one hour",
    },
  ]);
  const retryInput = JSON.parse(calls[2].messages[1].content);
  assert.ok(retryInput.retryConstraints.some((item) => /rejected phrase/i.test(item)));
  for (const answer of [
    result.correctedEnglish,
    result.naturalEnglish,
    result.modelAnswer,
    result.stretchAnswer,
  ].filter(Boolean)) {
    assert.doesNotMatch(answer, /had a promise|played exercise/i);
  }
});

test("target level changes final-generation guidance and resulting answer", async () => {
  async function run(targetLevel) {
    const request = {
      ...baseRequest,
      targetLevel,
      stage: "post_rewrite",
      rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
    };
    let guidance = "";
    const result = await createCoachFeedback(request, {
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        if (!isFinalAnswerPass(body)) return ollamaEnvelope(validPostAnalysis());
        const payload = JSON.parse(body.messages[1].content);
        guidance = payload.targetGuidance;
        return ollamaEnvelope(validFinalAnswers(request.rewriteDraft, {
          modelAnswer: targetLevel === "AL"
            ? `At the AL target, ${request.rewriteDraft}`
            : `At the IH target, ${request.rewriteDraft}`,
        }));
      },
    });
    return { guidance, answer: result.modelAnswer };
  }

  const ih = await run("IH");
  const al = await run("AL");
  assert.match(ih.guidance, /IH/);
  assert.match(al.guidance, /AL/);
  assert.notEqual(ih.answer, al.answer);
});

test("fact guard allows a supported place already named in the Korean plan", async () => {
  const postRequest = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      ...baseRequest.koreanPlan,
      example: "서울의 카페에서 이야기했다.",
    },
    englishDraft: "I met my friend.",
    rewriteDraft: "I met my friend at a cafe.",
  };
  const answer = "I met my friend at a cafe in Seoul.";
  const result = await createCoachFeedback(postRequest, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(answer)
        : validPostAnalysis());
    },
  });

  assert.equal(result.source, "local-model");
  assert.equal(result.modelUsed, PRIMARY_MODEL);
  assert.match(result.naturalEnglish, /Seoul/);
});

test("post-rewrite removes unsupported intensity without discarding useful local feedback", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      answer: "몸이 좋지 않아 약속을 취소했다.",
      reason: "열이 나고 피곤했다.",
      example: "약을 먹고 쉬었다.",
      closing: "다음 날 나아졌다.",
    },
    englishDraft: "I was sick and canceled my plans.",
    rewriteDraft: "I had a fever, so I canceled my plans and rested at home.",
  };
  const generated = "I had a high fever, so I canceled my plans and rested at home.";
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(generated)
        : validPostAnalysis({
            phraseUpgrades: [{ from: "a fever", to: "a high fever", whyKo: "강조" }],
          }));
    },
  });

  assert.equal(result.source, "local-model");
  assert.doesNotMatch(result.naturalEnglish, /high fever/i);
  assert.match(result.naturalEnglish, /a fever/i);
  assert.equal(result.phraseUpgrades[0].to, "a fever");
});

test("fact guard normalizes equivalent numbers and does not mistake 'the rest of' for resting", async () => {
  const cases = [
    {
      rewriteDraft: "I waited for two hours before my friend arrived.",
      naturalEnglish: "I waited for 2 hours before my friend arrived.",
    },
    {
      rewriteDraft: "I spent the rest of the day at home.",
      naturalEnglish: "For the rest of the day, I stayed at home.",
    },
  ];

  for (const sample of cases) {
    const request = {
      ...baseRequest,
      stage: "post_rewrite",
      koreanPlan: {
        answer: sample.rewriteDraft,
        reason: "그것이 핵심 이유였다.",
        example: "그날의 경험이다.",
        closing: "그래서 기억에 남는다.",
      },
      englishDraft: "This was my first draft.",
      rewriteDraft: sample.rewriteDraft,
    };
    const result = await createCoachFeedback(request, {
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        return ollamaEnvelope(isFinalAnswerPass(body)
          ? validFinalAnswers(sample.rewriteDraft, {
              naturalEnglish: sample.naturalEnglish,
            })
          : validPostAnalysis());
      },
    });

    assert.equal(result.source, "local-model");
    assert.equal(result.naturalEnglish, sample.naturalEnglish);
  }
});

test("fact guard ignores model self-report and whitespace-normalizes issue spans", async () => {
  const result = await createCoachFeedback(baseRequest, {
    fetchImpl: async () => ollamaEnvelope(validModelFeedback({
      factsPreserved: false,
      factAdditions: ["모델의 자기신고는 신뢰하지 않는다."],
      issues: [{
        priority: 1,
        original: "We  talked at a cafe",
        corrected: "We caught up at a cafe",
        category: "naturalness",
        explanationKo: "연속 공백이 있어도 실제 원문 위치를 찾아야 합니다.",
      }],
    })),
  });

  assert.equal(result.source, "local-model");
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].original, "We talked at a cafe");
  assert.equal(result.issues[0].corrected, "We caught up at a cafe");
});

test("fact guard isolates invented brands and calendar facts to the contaminated field", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    rewriteDraft: "For the first time in a long time, I met my friend at a cafe.",
  };
  const cases = [
    {
      unsafeField: "naturalEnglish",
      unsafeAnswer: `${request.rewriteDraft} Then we went to Starbucks.`,
      forbidden: /Starbucks/i,
    },
    {
      unsafeField: "modelAnswer",
      unsafeAnswer: `${request.rewriteDraft} We met on Sunday.`,
      forbidden: /Sunday/i,
    },
  ];

  for (const sample of cases) {
    const result = await createCoachFeedback(request, {
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        return ollamaEnvelope(isFinalAnswerPass(body)
          ? validFinalAnswers(request.rewriteDraft, {
              [sample.unsafeField]: sample.unsafeAnswer,
            })
          : validPostAnalysis());
      },
    });

    assert.equal(result.source, "local-model");
    assert.equal(result[sample.unsafeField], null);
    assert.ok(
      ["correctedEnglish", "naturalEnglish", "modelAnswer", "stretchAnswer"]
        .filter((field) => field !== sample.unsafeField)
        .some((field) => typeof result[field] === "string"),
    );
    assert.doesNotMatch(
      Object.values(result).filter((value) => typeof value === "string").join("\n"),
      sample.forbidden,
    );
  }
});

test("fact guard rejects unsupported duration and intensity without discarding clean fields", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      answer: "그날 비가 많이 왔다.",
      reason: "그래서 실내에 있었다.",
      example: "카페에서 친구와 이야기했다.",
      closing: "그래도 좋은 시간이었다.",
    },
    englishDraft: "It rained a lot that day.",
    rewriteDraft: "It rained a lot that day, so I stayed inside.",
  };
  const unsafe = "It was raining heavily all day, so I stayed inside.";
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft, { stretchAnswer: unsafe })
        : validPostAnalysis());
    },
  });

  assert.equal(result.source, "local-model");
  assert.equal(result.stretchAnswer, null);
  assert.equal(typeof result.correctedEnglish, "string");
  assert.doesNotMatch(
    Object.values(result).filter((value) => typeof value === "string").join("\n"),
    /heavily all day/i,
  );
});

test("fact guard isolates an invented trip home even when home appears as a place", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    koreanPlan: {
      answer: "나는 집 근처 헬스장에서 운동한다.",
      reason: "운동하면 스트레스를 풀 수 있다.",
      example: "지난 금요일에 친구와 한 시간 운동했다.",
      closing: "그 헬스장은 나에게 중요한 장소다.",
    },
    englishDraft: "I exercise at a gym near my home.",
    rewriteDraft: "I exercise at a gym near my home. Last Friday, I worked out with my friend for one hour.",
  };
  const unsafeNatural = `${request.rewriteDraft} We talked before heading home.`;
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft, { naturalEnglish: unsafeNatural })
        : validPostAnalysis());
    },
  });

  assert.equal(result.source, "local-model");
  assert.equal(result.naturalEnglish, null);
  assert.ok(result.correctedEnglish);
  assert.ok(result.modelAnswer);
  assert.doesNotMatch(
    Object.values(result).filter((value) => typeof value === "string").join("\n"),
    /heading home/i,
  );
});

test("post-rewrite preserves corrections already taught by the coach", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    englishDraft: "I had a promise with my friend. We talked at a cafe.",
    rewriteDraft: "I had plans with my friend. We talked at a cafe.",
    appliedCorrections: [{
      from: "I had a promise with my friend",
      to: "I had plans with my friend",
    }],
  };
  const calls = [];
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft)
        : validPostAnalysis({
            issues: [{
              priority: 1,
              original: "I had plans with my friend",
              corrected: "I went to a cafe with my friend",
              category: "naturalness",
              explanationKo: "이미 가르친 표현을 되돌리는 잘못된 제안입니다.",
            }],
          }));
    },
  });

  const analysisInput = JSON.parse(calls[0].messages[1].content);
  assert.deepEqual(analysisInput.appliedCorrections, request.appliedCorrections);
  assert.ok(analysisInput.preferredForms.some((form) => /had plans with/i.test(form)));
  assert.equal(result.source, "local-model");
  assert.equal(result.issues.length, 0);
  assert.match(result.correctedEnglish, /had plans with my friend/i);
});

test("post-rewrite also protects preferred forms when no first-stage corrections exist", async () => {
  const request = {
    ...baseRequest,
    stage: "post_rewrite",
    englishDraft: "I met my friend.",
    rewriteDraft: "I had plans with my friend, so we met at a cafe.",
    appliedCorrections: [],
  };
  const result = await createCoachFeedback(request, {
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return ollamaEnvelope(isFinalAnswerPass(body)
        ? validFinalAnswers(request.rewriteDraft)
        : validPostAnalysis({
            issues: [{
              priority: 1,
              original: "had plans with my friend",
              corrected: "went to a cafe with my friend",
              category: "naturalness",
              explanationKo: "앱의 선호 표현을 되돌리면 안 됩니다.",
            }],
          }));
    },
  });

  assert.equal(result.source, "local-model");
  assert.deepEqual(result.issues, []);
});

test("deterministic Korean-English interference rules cover the core regression phrases", () => {
  assert.equal(applyLocalRules("I went to home."), "I went home.");
  assert.equal(applyLocalRules("My condition was bad."), "I wasn't feeling well.");
  assert.equal(applyLocalRules("I ate medicine and took a rest."), "I took some medicine and got some rest.");
  assert.equal(applyLocalRules("I stayed at a pension."), "I stayed at a vacation rental.");
  assert.equal(applyLocalRules("I am difficult to wake up."), "I have a hard time waking up.");
  assert.equal(applyLocalRules("I recommend you to visit."), "I'd recommend visiting.");
  for (const [verb, gerund] of [
    ["forget", "forgetting"],
    ["plan", "planning"],
    ["begin", "beginning"],
    ["stop", "stopping"],
    ["put", "putting"],
    ["shop", "shopping"],
  ]) {
    assert.equal(
      applyLocalRules(`I am difficult to ${verb}.`),
      `I have a hard time ${gerund}.`,
    );
  }
});

test("pension and after-a-long-time rules require the same context as the app rules", () => {
  assert.equal(
    applyLocalRules("After a long time, the meeting ended."),
    "After a long time, the meeting ended.",
  );
  assert.equal(
    applyLocalRules("After a long time, I met my friend."),
    "for the first time in a long time, I met my friend.",
  );
  assert.equal(
    applyLocalRules("My company pension provides monthly income."),
    "My company pension provides monthly income.",
  );
  assert.equal(
    applyLocalRules("It was a pension.", {
      answer: "여행 중 펜션에서 묵었다.",
      reason: "",
      example: "",
      closing: "",
    }),
    "It was a vacation rental.",
  );
});

test("request validation requires Korean planning and protects legacy rewrite submissions", () => {
  assert.throws(
    () => validateCoachRequest({ ...baseRequest, koreanPlan: {} }),
    /한국어 답변 설계/,
  );
  assert.throws(
    () => validateCoachRequest({ ...baseRequest, stage: "post_rewrite" }),
    /rewriteDraft/,
  );
  assert.throws(
    () => validateCoachRequest({
      ...baseRequest,
      stage: "post_rewrite",
      englishDraft: "I met my friend at a cafe.",
      rewriteDraft: "  i met my friend at a cafe!!!  ",
    }),
    (error) => error?.code === "REWRITE_UNCHANGED",
  );
  const firstDraftReview = validateCoachRequest({
    ...baseRequest,
    stage: "post_rewrite",
    englishDraft: "I met my friend at a cafe.",
    rewriteDraft: "I met my friend at a cafe.",
    firstDraftReview: true,
  });
  assert.equal(firstDraftReview.firstDraftReview, true);
  assert.equal(firstDraftReview.rewriteDraft, firstDraftReview.englishDraft);
});

test("request validation ignores corrections not actually applied to the current draft", () => {
  const normalized = validateCoachRequest({
    ...baseRequest,
    stage: "post_rewrite",
    firstDraftReview: true,
    rewriteDraft: baseRequest.englishDraft,
    appliedCorrections: [
      {
        from: "I had a promise with my friend",
        to: "I had plans with my friend",
      },
    ],
  });
  assert.deepEqual(normalized.appliedCorrections, []);
});

test("request validation caps aggregate prompt context before model invocation", () => {
  assert.throws(
    () => validateCoachRequest({
      stage: "feedback",
      targetLevel: "AL",
      question: "Q".repeat(1_900),
      koreanPlan: {
        answer: "a".repeat(900),
        reason: "b".repeat(900),
        example: "c".repeat(900),
        closing: "d".repeat(900),
      },
      englishDraft: "e".repeat(4_900),
    }),
    (error) => error?.code === "REQUEST_TOO_LARGE" && error?.statusCode === 413,
  );
});

test("HTTP server binds to 127.0.0.1, stays useful without a model, and never logs answer text", async (t) => {
  const logLines = [];
  const fetchImpl = async (url) => {
    if (url === `${OLLAMA_BASE_URL}/api/tags`) {
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    }
    throw new Error("model offline");
  };
  const runtime = await startCoachServer({
    port: 0,
    spawnOllama: false,
    spawnFrontend: false,
    fetchImpl,
    modelTimeoutMs: 20,
    healthTimeoutMs: 20,
    logger: { warn: (line) => logLines.push(line) },
  });
  t.after(() => runtime.close());

  const address = runtime.server.address();
  assert.equal(address.address, LOCAL_HOST);

  const healthResponse = await fetch(`${runtime.url}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  assert.equal(health.version, SERVER_APP_VERSION);
  assert.equal(health.privacy, "local-only");
  assert.equal(health.mode, "rules-only");
  assert.equal(health.ollama.endpoint, OLLAMA_BASE_URL);

  const coachResponse = await fetch(`${runtime.url}/api/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseRequest),
  });
  const coach = await coachResponse.json();
  assert.equal(coachResponse.status, 200);
  assert.equal(coach.ok, true);
  assert.equal(coach.source, "rules-only");

  const denied = await fetch(`${runtime.url}/api/health`, {
    headers: { origin: "https://example.com" },
  });
  assert.equal(denied.status, 403);

  const secret = "SUPER_SECRET_ANSWER";
  const invalid = await fetch(`${runtime.url}/api/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(secret),
  });
  assert.equal(invalid.status, 400);
  assert.equal(logLines.length, 1);
  assert.doesNotMatch(logLines.join("\n"), new RegExp(secret));
});

test("model warmup uses only a fixed synthetic prompt and keeps the model resident", async () => {
  const calls = [];
  const ready = await warmLocalModel({
    waitTimeoutMs: 20,
    requestTimeoutMs: 100,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === `${OLLAMA_BASE_URL}/api/tags`) {
        return new Response(JSON.stringify({
          models: [{ name: PRIMARY_MODEL }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        message: { content: "ready" },
        done: true,
      }), { status: 200 });
    },
  });

  assert.equal(ready, true);
  assert.equal(calls.length, 2);
  const warmupBody = JSON.parse(calls[1].init.body);
  assert.equal(calls[1].url, `${OLLAMA_BASE_URL}/api/chat`);
  assert.equal(warmupBody.model, PRIMARY_MODEL);
  assert.equal(warmupBody.keep_alive, "30m");
  assert.equal(warmupBody.think, false);
  assert.equal(warmupBody.messages[0].content, "Reply with only the word ready.");
  assert.doesNotMatch(JSON.stringify(warmupBody), /friend|cafe|koreanPlan/i);
});

test("warming health is explicit and coach requests do not queue behind model loading", async (t) => {
  let modelChatCalls = 0;
  const warmupState = { status: "warming" };
  const server = createCoachServer({
    frontendUrl: "http://127.0.0.1:4272",
    warmupState,
    healthTimeoutMs: 20,
    fetchImpl: async (url) => {
      if (url === `${OLLAMA_BASE_URL}/api/tags`) {
        return new Response(JSON.stringify({
          models: [{ name: PRIMARY_MODEL }],
        }), { status: 200 });
      }
      modelChatCalls += 1;
      throw new Error("model chat must not run while warming");
    },
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOCAL_HOST, resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const url = `http://${LOCAL_HOST}:${address.port}`;

  const health = await (await fetch(`${url}/api/health`)).json();
  assert.equal(health.mode, "warming");
  assert.equal(health.coachReady, false);

  const feedback = await (await fetch(`${url}/api/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseRequest),
  })).json();
  assert.equal(feedback.source, "rules-only");
  assert.equal(modelChatCalls, 0);
});

test("HTTP client disconnect aborts the in-flight local model request", async () => {
  let markModelStarted;
  let markModelAborted;
  const modelStarted = new Promise((resolve) => {
    markModelStarted = resolve;
  });
  const modelAborted = new Promise((resolve) => {
    markModelAborted = resolve;
  });
  const fetchImpl = async (url, init = {}) => {
    if (url === `${OLLAMA_BASE_URL}/api/tags`) {
      return new Response(JSON.stringify({ models: [{ name: PRIMARY_MODEL }] }), { status: 200 });
    }
    markModelStarted();
    return await new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        markModelAborted();
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    });
  };
  const runtime = await startCoachServer({
    port: 0,
    spawnFrontend: false,
    spawnOllama: false,
    fetchImpl,
  });

  try {
    const clientRequest = http.request(`${runtime.url}/api/coach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    clientRequest.on("error", () => {});
    clientRequest.end(JSON.stringify(baseRequest));
    await modelStarted;
    clientRequest.destroy();
    await Promise.race([
      modelAborted,
      new Promise((_resolve, reject) => setTimeout(
        () => reject(new Error("model request was not aborted")),
        1_000,
      )),
    ]);
  } finally {
    await runtime.close();
  }
});
