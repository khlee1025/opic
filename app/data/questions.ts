/**
 * Original practice material for OPIc Daily Coach.
 *
 * The prompts below exercise the public, general speaking functions associated
 * with an OPIc-style interview. They do not reproduce leaked questions, prep
 * books, or any proprietary question bank.
 */

export const QUESTION_BANK_SOURCE_LABEL =
  "공개된 OPIc 시험의 의사소통 기능과 일반적인 설문 주제를 참고해 새로 작성한 독창 문항입니다. 실제 기출문항을 복제하거나 유출한 자료가 아닙니다.";

export const CURRICULUM_VERSION = "2026.07-natural-spoken-v3";
export const CURRICULUM_ANCHOR_DATE = "2026-01-01";

export const QUESTION_CATEGORY_IDS = [
  "home_neighborhood",
  "work_career",
  "study_learning",
  "friends_social",
  "restaurants_cafes",
  "shopping_services",
  "movies_streaming",
  "music_concerts",
  "parks_walking",
  "fitness_sports",
  "travel_vacations",
  "transport_commuting",
  "technology_apps",
  "health_wellness",
  "environment_weather",
] as const;

export type QuestionCategoryId = (typeof QUESTION_CATEGORY_IDS)[number];
export type CurriculumCycle = 1 | 2 | 3 | 4 | 5 | 6;
export type QuestionSlot = "familiar" | "challenge";
export type QuestionDifficulty = 1 | 2 | 3;
export type QuestionType =
  | "description"
  | "experience"
  | "comparison"
  | "change"
  | "roleplay"
  | "problem"
  | "opinion";

export type CommunicativeFunction =
  | "describe"
  | "sequence"
  | "narratePast"
  | "addDetail"
  | "compare"
  | "explainCause"
  | "solveProblem"
  | "askQuestions"
  | "offerAlternatives"
  | "stateOpinion"
  | "supportOpinion"
  | "hypothesize"
  | "generalize"
  | "predict";

export interface KoreanIdeaPrompts {
  answer: string;
  reason: string;
  example: string;
  closing: string;
}

export interface DailyQuestion {
  id: string;
  daySetId: string;
  category: QuestionCategoryId;
  categoryKo: string;
  topic: string;
  cycle: CurriculumCycle;
  slot: QuestionSlot;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  targetSeconds: 60 | 75 | 90;
  promptEn: string;
  /** Stable curriculum metadata used to audit genuine wording diversity. */
  framingId: string;
  planningPatternId: string;
  /** Kept separate so a future local TTS layer can normalize it if needed. */
  ttsText: string;
  functions: readonly CommunicativeFunction[];
  requiredMoves: readonly string[];
  koreanIdeaPrompts: KoreanIdeaPrompts;
  recurrenceKey: string;
  sourceLabel: typeof QUESTION_BANK_SOURCE_LABEL;
}

export interface DailyQuestionSet {
  id: string;
  sequence: number;
  category: QuestionCategoryId;
  categoryKo: string;
  cycle: CurriculumCycle;
  questions: readonly [DailyQuestion, DailyQuestion];
}

interface CategoryProfile {
  id: QuestionCategoryId;
  labelKo: string;
  topicEn: string;
  setting: string;
  routine: string;
  memory: string;
  problem: string;
  comparisonA: string;
  comparisonB: string;
  changeContrast: string;
  roleplayTarget: string;
  roleplayGoal: string;
  roleplayProblem: string;
  skillFocus: string;
  trendClaim: string;
  futureSubject: string;
}

interface PromptBlueprint {
  type: QuestionType;
  difficulty: QuestionDifficulty;
  targetSeconds: 60 | 75 | 90;
  promptEn: string;
  framingId: string;
  planningPatternId: string;
  planningVariant: VariantIndex;
  functions: readonly CommunicativeFunction[];
  requiredMoves: readonly string[];
}

type VariantIndex = 0 | 1 | 2 | 3 | 4;

interface PromptVariant {
  promptEn: string;
  requiredMoves: readonly string[];
}

interface BlueprintShared {
  type: QuestionType;
  difficulty: QuestionDifficulty;
  targetSeconds: 60 | 75 | 90;
  functions: readonly CommunicativeFunction[];
}

const CATEGORY_PROFILES: readonly CategoryProfile[] = [
  {
    id: "home_neighborhood",
    labelKo: "집과 동네",
    topicEn: "home and neighborhood life",
    setting: "the home and neighborhood where you live",
    routine: "what you usually do from the moment you get home until you relax",
    memory: "a day when something unexpected happened in your neighborhood",
    problem: "a noisy, broken, or inconvenient situation at home",
    comparisonA: "the place where you lived in the past",
    comparisonB: "the place where you live now",
    changeContrast: "home life and neighborhoods today differ from those of ten years ago",
    roleplayTarget: "a real-estate agent",
    roleplayGoal: "get details about a home you may move into",
    roleplayProblem: "the home you planned to view is suddenly unavailable",
    skillFocus: "making your living space more comfortable",
    trendClaim: "more Koreans are choosing smaller homes close to public transportation",
    futureSubject: "the homes and neighborhoods people choose",
  },
  {
    id: "work_career",
    labelKo: "직장과 커리어",
    topicEn: "work and career",
    setting: "your workplace or the kind of work environment you know best",
    routine: "how you handle a normal workday from your first task to the last",
    memory: "a workday when a task or project changed without warning",
    problem: "a misunderstanding, deadline, or scheduling problem at work",
    comparisonA: "the way you worked when you first started your career",
    comparisonB: "the way you work now",
    changeContrast: "workplace communication today differs from the way it was in the past",
    roleplayTarget: "a coworker or team leader",
    roleplayGoal: "arrange an important meeting and confirm what needs to be prepared",
    roleplayProblem: "you can no longer attend the meeting at the agreed time",
    skillFocus: "handling an unfamiliar task at work",
    trendClaim: "flexible schedules help people do better work",
    futureSubject: "workplaces and the skills employees need",
  },
  {
    id: "study_learning",
    labelKo: "공부와 학습",
    topicEn: "study and learning",
    setting: "the place and setup you use when you need to study or learn something",
    routine: "how you prepare for and complete a focused study session",
    memory: "a time when you finally understood something that had been difficult",
    problem: "a study plan that failed because of time, motivation, or distractions",
    comparisonA: "how you learned English at school",
    comparisonB: "how you learn English now",
    changeContrast: "the way adults learn new skills today differs from the past",
    roleplayTarget: "an instructor at a language program",
    roleplayGoal: "ask about a course you are considering",
    roleplayProblem: "the class you registered for has been moved to an impossible time",
    skillFocus: "staying consistent while learning a difficult skill",
    trendClaim: "short online lessons are replacing traditional classes for many adults",
    futureSubject: "the way people learn languages and job skills",
  },
  {
    id: "friends_social",
    labelKo: "친구와 사교 생활",
    topicEn: "friends and social life",
    setting: "the place where you most often spend time with friends",
    routine: "how you and your friends usually plan and spend time together",
    memory: "a get-together with friends that did not go as planned but became memorable",
    problem: "a conflict, late cancellation, or communication problem among friends",
    comparisonA: "the way you kept in touch with friends when you were younger",
    comparisonB: "the way you keep in touch now",
    changeContrast: "friendships and social gatherings today differ from those of the past",
    roleplayTarget: "a close friend",
    roleplayGoal: "plan a small weekend get-together",
    roleplayProblem: "the place you chose is closed and one friend will arrive late",
    skillFocus: "keeping a group plan organized",
    trendClaim: "people now prefer small gatherings to large social events",
    futureSubject: "how people make and maintain friendships",
  },
  {
    id: "restaurants_cafes",
    labelKo: "식당과 카페",
    topicEn: "restaurants and cafes",
    setting: "a restaurant or cafe you enjoy visiting",
    routine: "what you normally do from choosing a place to finishing your meal or drink",
    memory: "a meal or cafe visit that surprised you for a good or bad reason",
    problem: "an incorrect order, a long wait, or another service problem",
    comparisonA: "eating at a busy restaurant",
    comparisonB: "ordering food to eat at home",
    changeContrast: "restaurant and cafe culture today differs from ten years ago",
    roleplayTarget: "a restaurant employee",
    roleplayGoal: "make a reservation and ask about the menu",
    roleplayProblem: "your reservation cannot be found when your group arrives",
    skillFocus: "finding a good place for a group with different preferences",
    trendClaim: "customers care as much about atmosphere as they do about food",
    futureSubject: "restaurants, cafes, and the way people order food",
  },
  {
    id: "shopping_services",
    labelKo: "쇼핑과 생활 서비스",
    topicEn: "shopping and everyday services",
    setting: "a store or shopping service you use often",
    routine: "how you decide what to buy and complete a typical purchase",
    memory: "a time when you found an unexpectedly good deal or useful item",
    problem: "a damaged product, a late delivery, or a difficult return",
    comparisonA: "shopping in a physical store",
    comparisonB: "shopping through an app or website",
    changeContrast: "shopping habits today differ from the way people shopped in the past",
    roleplayTarget: "a store's customer-service representative",
    roleplayGoal: "ask detailed questions before buying an item",
    roleplayProblem: "the item arrives damaged and the replacement is out of stock",
    skillFocus: "making a careful purchase instead of buying impulsively",
    trendClaim: "secondhand shopping is becoming a normal first choice rather than a last resort",
    futureSubject: "how people shop and how stores serve them",
  },
  {
    id: "movies_streaming",
    labelKo: "영화와 스트리밍",
    topicEn: "movies and streaming",
    setting: "where and how you usually watch movies or series",
    routine: "how you choose something to watch and settle in for it",
    memory: "a movie or series that affected you more than you expected",
    problem: "a viewing plan ruined by tickets, technology, noise, or scheduling",
    comparisonA: "watching a movie at a theater",
    comparisonB: "watching it through a streaming service at home",
    changeContrast: "the way people discover and watch movies today differs from the past",
    roleplayTarget: "a movie-theater employee",
    roleplayGoal: "ask about showtimes, seats, and ticket options",
    roleplayProblem: "the screening is canceled after you have already bought tickets",
    skillFocus: "choosing a movie that several people will enjoy",
    trendClaim: "streaming has made people less patient with slow or unfamiliar stories",
    futureSubject: "movie theaters and home entertainment",
  },
  {
    id: "music_concerts",
    labelKo: "음악과 공연",
    topicEn: "music and live performances",
    setting: "your favorite way to listen to music and the setting where you enjoy it most",
    routine: "how music fits into an ordinary day for you",
    memory: "a song or live performance connected to a strong memory",
    problem: "a concert or listening experience affected by tickets, sound, or crowds",
    comparisonA: "how you found and listened to music in the past",
    comparisonB: "how you discover and listen to music now",
    changeContrast: "music discovery and concert culture today differ from the past",
    roleplayTarget: "a concert venue's ticket office",
    roleplayGoal: "ask about tickets, seating, and entry rules",
    roleplayProblem: "the performance date changes and you cannot attend on the new date",
    skillFocus: "finding new music outside your usual taste",
    trendClaim: "short video platforms now have too much influence over which songs become popular",
    futureSubject: "how artists release music and how audiences experience it",
  },
  {
    id: "parks_walking",
    labelKo: "공원과 산책",
    topicEn: "parks and walking",
    setting: "a park or walking route you know well",
    routine: "what you do before, during, and after a typical walk",
    memory: "a walk when the weather, scenery, or people made the day memorable",
    problem: "a walk disrupted by weather, construction, crowds, or getting lost",
    comparisonA: "taking a walk in a city neighborhood",
    comparisonB: "walking in a large park or natural area",
    changeContrast: "the way people use public parks today differs from the past",
    roleplayTarget: "an employee at a local park information desk",
    roleplayGoal: "ask about trails, facilities, and park rules",
    roleplayProblem: "the route you planned to take is closed for maintenance",
    skillFocus: "turning walking into a regular habit",
    trendClaim: "cities should give road space to pedestrians even if driving becomes less convenient",
    futureSubject: "urban parks, walking routes, and public space",
  },
  {
    id: "fitness_sports",
    labelKo: "운동과 스포츠",
    topicEn: "fitness and sports",
    setting: "the place where you most often exercise or play a sport",
    routine: "how you prepare for, complete, and recover from a normal workout",
    memory: "a game or workout when you performed better or worse than expected",
    problem: "an exercise plan affected by injury, equipment, weather, or scheduling",
    comparisonA: "exercising alone",
    comparisonB: "working out or playing a sport with other people",
    changeContrast: "fitness trends and the way people exercise today differ from the past",
    roleplayTarget: "an employee at a fitness center or sports facility",
    roleplayGoal: "ask about membership, equipment, and available classes",
    roleplayProblem: "the class or facility you paid for is repeatedly unavailable",
    skillFocus: "returning to exercise after a long break",
    trendClaim: "fitness apps and smart devices motivate people more than coaches do",
    futureSubject: "the way ordinary people exercise and follow sports",
  },
  {
    id: "travel_vacations",
    labelKo: "여행과 휴가",
    topicEn: "travel and vacations",
    setting: "a destination or type of trip you especially enjoy",
    routine: "how you normally plan a trip from the first idea to departure",
    memory: "a trip when an unplanned moment became the best part",
    problem: "a trip disrupted by a delay, booking mistake, weather, or lost item",
    comparisonA: "taking a carefully planned trip",
    comparisonB: "traveling with a flexible schedule",
    changeContrast: "the way people plan and share their trips today differs from the past",
    roleplayTarget: "a hotel front-desk employee",
    roleplayGoal: "ask about a room, facilities, and check-in arrangements",
    roleplayProblem: "the room you reserved is not available when you arrive",
    skillFocus: "handling an unexpected change while traveling",
    trendClaim: "popular destinations should limit visitor numbers to protect local communities",
    futureSubject: "how people choose destinations and experience travel",
  },
  {
    id: "transport_commuting",
    labelKo: "교통과 출퇴근",
    topicEn: "transportation and commuting",
    setting: "the route and transportation you use most often",
    routine: "what happens during a normal commute or regular trip across town",
    memory: "a trip across town when something unusual happened on the way",
    problem: "a delay, missed stop, traffic jam, or payment problem during a trip",
    comparisonA: "traveling by public transportation",
    comparisonB: "traveling by car or taxi",
    changeContrast: "commuting and local transportation today differ from the past",
    roleplayTarget: "a public-transportation help-desk employee",
    roleplayGoal: "ask how to reach an unfamiliar destination",
    roleplayProblem: "the recommended route is suspended after your trip has started",
    skillFocus: "finding an efficient route in an unfamiliar area",
    trendClaim: "cities should make public transportation cheaper even if taxes increase",
    futureSubject: "daily commuting and transportation in large cities",
  },
  {
    id: "technology_apps",
    labelKo: "기술과 앱",
    topicEn: "technology and apps",
    setting: "a device or app that plays an important role in your daily life",
    routine: "how you use technology from the start of your day to the end",
    memory: "a time when an app or device solved a problem in an unexpected way",
    problem: "a device failure, lost file, security concern, or confusing update",
    comparisonA: "the technology you used several years ago",
    comparisonB: "the devices and apps you rely on now",
    changeContrast: "the way people communicate and manage daily tasks today differs from the past",
    roleplayTarget: "a technical-support representative",
    roleplayGoal: "describe an issue and ask how to fix it",
    roleplayProblem: "the first suggested fix fails and you need another solution",
    skillFocus: "learning to use an unfamiliar app or device",
    trendClaim: "convenience has made people accept too much loss of personal privacy",
    futureSubject: "personal technology and the role of artificial intelligence in daily life",
  },
  {
    id: "health_wellness",
    labelKo: "건강과 생활 습관",
    topicEn: "health and wellness",
    setting: "the place or situation where you best maintain healthy habits",
    routine: "what you do on an ordinary day to take care of your energy and health",
    memory: "a time when changing one small habit made a noticeable difference",
    problem: "a healthy routine interrupted by stress, lack of sleep, or a busy schedule",
    comparisonA: "how you thought about health when you were younger",
    comparisonB: "how you take care of yourself now",
    changeContrast: "people's attitudes toward rest, exercise, and mental health today differ from the past",
    roleplayTarget: "a clinic receptionist",
    roleplayGoal: "make an appointment and ask what you should bring",
    roleplayProblem: "the available appointment time conflicts with an important commitment",
    skillFocus: "rebuilding a healthy routine after losing momentum",
    trendClaim: "employers should actively protect workers' time to rest and recover",
    futureSubject: "how people and workplaces manage health and well-being",
  },
  {
    id: "environment_weather",
    labelKo: "환경과 날씨",
    topicEn: "the environment and weather",
    setting: "the weather in your area and how it affects daily life",
    routine: "how you check the weather and adjust your plans before going out",
    memory: "a day when extreme or unusual weather completely changed your plans",
    problem: "a plan disrupted by heavy rain, snow, heat, or poor air quality",
    comparisonA: "the seasons and weather you remember from childhood",
    comparisonB: "the weather patterns you experience now",
    changeContrast: "people's response to extreme weather today differs from the past",
    roleplayTarget: "an organizer of an outdoor event",
    roleplayGoal: "ask about the weather plan, safety rules, and possible cancellation",
    roleplayProblem: "dangerous weather is forecast just before the event",
    skillFocus: "preparing for a sudden weather change",
    trendClaim: "individual lifestyle changes matter less than action by companies and governments",
    futureSubject: "daily life as extreme weather becomes more common",
  },
] as const;

export const QUESTION_CATEGORY_LABELS: Readonly<Record<QuestionCategoryId, string>> =
  Object.freeze(
    Object.fromEntries(
      CATEGORY_PROFILES.map((profile) => [profile.id, profile.labelKo]),
    ) as Record<QuestionCategoryId, string>,
  );

const CYCLES: readonly CurriculumCycle[] = [1, 2, 3, 4, 5, 6];

function buildBlueprint(
  profile: CategoryProfile,
  cycle: CurriculumCycle,
  slot: QuestionSlot,
): PromptBlueprint {
  const categoryIndex = CATEGORY_PROFILES.findIndex(
    (candidate) => candidate.id === profile.id,
  );
  const slotOffset = slot === "challenge" ? 1 : 0;
  const promptVariant = positiveModulo(
    categoryIndex + (cycle - 1) * 2 + slotOffset,
    5,
  ) as VariantIndex;
  const planningVariant = positiveModulo(
    categoryIndex * 2 + (cycle - 1) + slotOffset * 3,
    5,
  ) as VariantIndex;

  const selectBlueprint = (
    key: string,
    shared: BlueprintShared,
    variants: readonly [
      PromptVariant,
      PromptVariant,
      PromptVariant,
      PromptVariant,
      PromptVariant,
    ],
  ): PromptBlueprint => {
    const selected = variants[promptVariant];
    return {
      ...shared,
      promptEn: selected.promptEn,
      requiredMoves: selected.requiredMoves,
      framingId: `${key}-v${promptVariant + 1}`,
      planningPatternId: `${key}-plan-v${planningVariant + 1}`,
      planningVariant,
    };
  };

  if (cycle === 1 && slot === "familiar") {
    return selectBlueprint("c1-familiar-description", {
      type: "description",
      difficulty: 1,
      targetSeconds: 60,
      functions: ["describe", "addDetail"],
    }, [
      {
        promptEn: `Tell me about ${profile.setting}. What is it like? Give me two details, and explain what you like about it.`,
        requiredMoves: ["Give an overall description", "Add two clear details", "Explain what you like"],
      },
      {
        promptEn: `Describe ${profile.setting} to someone who has never seen it. What would they notice first? What is one detail they might miss?`,
        requiredMoves: ["Help the listener picture it", "Describe the first noticeable feature", "Add one easy-to-miss detail"],
      },
      {
        promptEn: `What stands out most about ${profile.setting}? Give specific details and explain how it affects your daily life.`,
        requiredMoves: ["Name the main feature", "Support it with specific details", "Connect it to your daily life"],
      },
      {
        promptEn: `Please describe ${profile.setting}. Start with the overall picture, then tell me about one small detail that is important to you.`,
        requiredMoves: ["Start with the big picture", "Focus on one small detail", "Explain why it matters to you"],
      },
      {
        promptEn: `Introduce me to ${profile.setting}. What is it like, what makes it different, and how do you feel about it?`,
        requiredMoves: ["Introduce it clearly", "Explain what makes it different", "Finish with your personal reaction"],
      },
    ]);
  }

  if (cycle === 1) {
    return selectBlueprint("c1-challenge-comparison", {
      type: "comparison",
      difficulty: 2,
      targetSeconds: 75,
      functions: ["compare", "stateOpinion", "supportOpinion"],
    }, [
      {
        promptEn: `Compare ${profile.comparisonA} with ${profile.comparisonB}. What are the biggest differences, and which do you prefer? Give specific reasons for your choice.`,
        requiredMoves: ["Name at least two differences", "Choose one option clearly", "Support the choice with a concrete reason"],
      },
      {
        promptEn: `Think about ${profile.comparisonA} and ${profile.comparisonB}. How are they different in convenience and atmosphere? Which one works better for you, and why?`,
        requiredMoves: ["Compare convenience", "Compare atmosphere", "Choose the one that works better for you"],
      },
      {
        promptEn: `How is the experience different between ${profile.comparisonA} and ${profile.comparisonB}? When would you choose each one?`,
        requiredMoves: ["Describe the main difference", "Say when you would choose the first option", "Say when you would choose the second option"],
      },
      {
        promptEn: `A friend asks which is better: ${profile.comparisonA} or ${profile.comparisonB}. What is one good thing about each? Which one would you recommend?`,
        requiredMoves: ["Give one strength of each option", "Choose one for your friend", "Explain your recommendation"],
      },
      {
        promptEn: `Compare ${profile.comparisonA} and ${profile.comparisonB}. Give one good point and one bad point about each. Then tell me which one you would choose and why.`,
        requiredMoves: ["Give a good and bad point for both", "Choose one option", "Support your choice with a reason"],
      },
    ]);
  }

  if (cycle === 2 && slot === "familiar") {
    return selectBlueprint("c2-familiar-memory", {
      type: "experience",
      difficulty: 2,
      targetSeconds: 75,
      functions: ["narratePast", "sequence", "addDetail"],
    }, [
      {
        promptEn: `Tell me about ${profile.memory}. When and where did it happen? What happened, and why do you still remember it?`,
        requiredMoves: ["Say when and where it happened", "Tell the events in order", "Explain why you remember it"],
      },
      {
        promptEn: `Think back to ${profile.memory}. What was happening at first? What changed, and what did you do next?`,
        requiredMoves: ["Describe what was happening first", "Explain what changed", "Say what you did next"],
      },
      {
        promptEn: `Describe ${profile.memory}. Include one detail you clearly remember, and explain why the experience was important to you.`,
        requiredMoves: ["Focus on one clear moment", "Add one memorable detail", "Explain why it was important"],
      },
      {
        promptEn: `Tell me the story of ${profile.memory}. Who was there, what surprised you, and how did you feel at the end?`,
        requiredMoves: ["Introduce the people", "Describe the surprising moment", "Explain how you felt at the end"],
      },
      {
        promptEn: `What was the most important moment in ${profile.memory}? Tell me what happened before and after it. Did it change anything you did later?`,
        requiredMoves: ["Choose the most important moment", "Explain what happened before and after", "Say whether it affected you later"],
      },
    ]);
  }

  if (cycle === 2) {
    return selectBlueprint("c2-challenge-problem", {
      type: "problem",
      difficulty: 3,
      targetSeconds: 90,
      functions: ["narratePast", "explainCause", "solveProblem", "hypothesize"],
    }, [
      {
        promptEn: `Think of ${profile.problem}. What caused it, what did you do, and what happened in the end? What would you do differently next time?`,
        requiredMoves: ["Explain the cause", "Describe what you did", "Give the result", "Say what you would change next time"],
      },
      {
        promptEn: `Tell me about ${profile.problem}. What choices did you have? What did you choose, and would you make the same choice today?`,
        requiredMoves: ["Explain the choices you had", "Say what you chose", "Give your reason", "Say what you think about it now"],
      },
      {
        promptEn: `Tell me the story of ${profile.problem}. When did you first notice it? What did you try first, and what would you try next time?`,
        requiredMoves: ["Say when you noticed the problem", "Explain your first solution", "Describe the result", "Give a better plan for next time"],
      },
      {
        promptEn: `Imagine a friend has the same problem: ${profile.problem}. Tell them what happened to you, what helped, and what they should avoid.`,
        requiredMoves: ["Share your own experience", "Explain what helped", "Give one warning", "Tell your friend what to do"],
      },
      {
        promptEn: `Think about ${profile.problem}. What could you control, and what could you not control? What did you do, and how would you prepare better next time?`,
        requiredMoves: ["Separate what you could and could not control", "Describe your response", "Explain the result", "Say how you would prepare next time"],
      },
    ]);
  }

  if (cycle === 3 && slot === "familiar") {
    return selectBlueprint("c3-familiar-routine", {
      type: "description",
      difficulty: 1,
      targetSeconds: 60,
      functions: ["describe", "sequence", "addDetail"],
    }, [
      {
        promptEn: `Walk me through ${profile.routine}. What do you do first, what happens next, and which part is most important to you?`,
        requiredMoves: ["Start at the beginning", "Explain the steps in order", "Choose the most important part"],
      },
      {
        promptEn: `Explain ${profile.routine} to a friend who wants to try it. What should they prepare, what are the main steps, and what do you do in your own way?`,
        requiredMoves: ["Say what to prepare", "Explain the main steps", "Add one habit that is your own"],
      },
      {
        promptEn: `Explain ${profile.routine} in three steps. What happens at each step, and what small thing makes the routine easier?`,
        requiredMoves: ["Use three clear steps", "Explain what happens in each step", "Add one helpful detail"],
      },
      {
        promptEn: `What habits help you with ${profile.routine}? What usually goes wrong when you skip an important step?`,
        requiredMoves: ["Describe the routine briefly", "Name the habits that help", "Explain what happens when you skip a step"],
      },
      {
        promptEn: `Describe ${profile.routine} from beginning to end. Spend more time on the most important part and explain why it matters.`,
        requiredMoves: ["Describe the full routine", "Focus on the key part", "Explain why that part matters"],
      },
    ]);
  }

  if (cycle === 3) {
    return selectBlueprint("c3-challenge-change", {
      type: "change",
      difficulty: 3,
      targetSeconds: 90,
      functions: ["compare", "explainCause", "generalize", "supportOpinion"],
    }, [
      {
        promptEn: `How have things changed? Explain how ${profile.changeContrast}. Why did this change happen, and how has it affected people?`,
        requiredMoves: ["Compare the past and present", "Give one reason for the change", "Explain one effect", "Add an example"],
      },
      {
        promptEn: `Imagine someone returns to Korea after ten years. How would you explain that ${profile.changeContrast}? What change would surprise them most, and why?`,
        requiredMoves: ["Describe the biggest change", "Compare it with the past", "Explain why it happened", "Say why it matters"],
      },
      {
        promptEn: `How has the way people think about ${profile.topicEn} changed in recent years? What caused the change, and was there any surprising result?`,
        requiredMoves: ["Describe the recent change", "Explain what caused it", "Give one result", "Say why the result was surprising"],
      },
      {
        promptEn: `Think about how ${profile.changeContrast}. Who likes this change, and who has had a hard time with it? What do you think about it?`,
        requiredMoves: ["Explain the change", "Describe who benefits", "Describe who finds it difficult", "Give your opinion"],
      },
      {
        promptEn: `Give one everyday example that shows how ${profile.changeContrast}. Why did this change happen, and how does it affect daily life?`,
        requiredMoves: ["Start with an everyday example", "Compare it with the past", "Explain the cause", "Connect it to daily life"],
      },
    ]);
  }

  if (cycle === 4 && slot === "familiar") {
    return selectBlueprint("c4-familiar-advice", {
      type: "experience",
      difficulty: 2,
      targetSeconds: 75,
      functions: ["sequence", "addDetail", "supportOpinion"],
    }, [
      {
        promptEn: `What advice would you give to someone who is new to ${profile.topicEn}? What should they do first, what should they pay attention to, and what mistake should they avoid?`,
        requiredMoves: ["Give clear advice", "Explain the first step", "Add one warning", "Connect it to your experience"],
      },
      {
        promptEn: `A beginner asks for advice about ${profile.topicEn}. What are your three most important tips? Which tip did you learn from your own experience?`,
        requiredMoves: ["Give three useful tips", "Choose the most important tip", "Explain why it matters", "Share the experience that taught you"],
      },
      {
        promptEn: `Someone is trying ${profile.topicEn} for the first time. How should they prepare? What common mistake might they make, and what should they do if it happens?`,
        requiredMoves: ["Explain how to prepare", "Describe a common mistake", "Give a way to fix it", "Explain how your advice helps"],
      },
      {
        promptEn: `What common mistake do people make with ${profile.topicEn}? What should they do instead? Tell me about a time when you learned this yourself.`,
        requiredMoves: ["Name a common mistake", "Give better advice", "Share your own experience", "Explain what you learned"],
      },
      {
        promptEn: `A beginner wants some help with ${profile.topicEn}. What should they try first, and what should they do next? How can they tell that things are going well?`,
        requiredMoves: ["Set a simple first goal", "Give the next step", "Mention something to watch for", "Explain how to check progress"],
      },
    ]);
  }

  if (cycle === 4) {
    return selectBlueprint("c4-challenge-roleplay", {
      type: "roleplay",
      difficulty: 3,
      targetSeconds: 90,
      functions: ["askQuestions", "solveProblem", "offerAlternatives", "sequence"],
    }, [
      {
        promptEn: `You are talking to ${profile.roleplayTarget}. You want to ${profile.roleplayGoal}. Ask three or four questions. Then explain this problem: ${profile.roleplayProblem}. Suggest two other options and confirm what will happen next.`,
        requiredMoves: ["Ask three or four useful questions", "Explain the problem clearly", "Suggest two other options", "Confirm the next step"],
      },
      {
        promptEn: `Call ${profile.roleplayTarget}. You need to ${profile.roleplayGoal}. Ask at least three questions. Then you learn that ${profile.roleplayProblem}. Suggest a new plan and confirm the details at the end.`,
        requiredMoves: ["Explain why you are calling", "Ask three clear questions", "React to the problem", "Suggest and confirm a new plan"],
      },
      {
        promptEn: `You need help from ${profile.roleplayTarget}. You want to ${profile.roleplayGoal}. Ask about availability, rules, and cost or timing. Then explain that ${profile.roleplayProblem}. Offer two choices and ask which one is possible.`,
        requiredMoves: ["Ask about the key details", "Keep your request polite", "Offer two clear choices", "Ask the person to choose one"],
      },
      {
        promptEn: `Role-play a conversation with ${profile.roleplayTarget}. Ask for the information you need to ${profile.roleplayGoal}. Then explain that ${profile.roleplayProblem}. Ask what can be changed and confirm what each person will do next.`,
        requiredMoves: ["Ask for the information you need", "Explain the problem", "Ask what can be changed", "Confirm what happens next"],
      },
      {
        promptEn: `You are already talking with ${profile.roleplayTarget}. You want to ${profile.roleplayGoal}. Ask follow-up questions to make everything clear. Then explain that ${profile.roleplayProblem}. Suggest two possible solutions and ask for a clear answer.`,
        requiredMoves: ["Ask clear follow-up questions", "Explain how the problem affects you", "Suggest two solutions", "Ask for a final answer"],
      },
    ]);
  }

  if (cycle === 5 && slot === "familiar") {
    return selectBlueprint("c5-familiar-improvement", {
      type: "experience",
      difficulty: 2,
      targetSeconds: 75,
      functions: ["narratePast", "explainCause", "sequence"],
    }, [
      {
        promptEn: `Tell me about a time when you got better at ${profile.skillFocus}. How did you start, what was difficult, and what helped you improve?`,
        requiredMoves: ["Describe how you started", "Name the main difficulty", "Explain what helped", "Show how you improved"],
      },
      {
        promptEn: `Think about when you first tried ${profile.skillFocus}. What did you try, and why did it not work well? What advice would you give yourself now?`,
        requiredMoves: ["Describe what you tried first", "Explain why it did not work", "Give yourself better advice", "Say how that advice would help"],
      },
      {
        promptEn: `Tell me about a time when ${profile.skillFocus} started to feel easier. What helped you, and how did you know you were improving?`,
        requiredMoves: ["Explain what was difficult before", "Describe what helped", "Show what changed", "Give one sign of improvement"],
      },
      {
        promptEn: `Tell me about a time when you had trouble ${profile.skillFocus}. What problem kept happening? What small change did you make, and how did it help?`,
        requiredMoves: ["Describe the problem that kept happening", "Explain one small change", "Say why the change helped", "Compare before and after"],
      },
      {
        promptEn: `Compare your first try at ${profile.skillFocus} with a recent one. What changed, what helped you improve, and what is still difficult?`,
        requiredMoves: ["Describe your first try", "Describe a recent try", "Explain what helped you improve", "Mention what is still difficult"],
      },
    ]);
  }

  if (cycle === 5) {
    return selectBlueprint("c5-challenge-opinion", {
      type: "opinion",
      difficulty: 3,
      targetSeconds: 90,
      functions: ["stateOpinion", "explainCause", "generalize", "predict"],
    }, [
      {
        promptEn: `Some people say that ${profile.trendClaim}. Do you agree or disagree? Why is this happening, who benefits, and do you think it will continue?`,
        requiredMoves: ["Give a clear opinion", "Explain why it is happening", "Say who benefits", "Predict whether it will continue"],
      },
      {
        promptEn: `Think about this idea: ${profile.trendClaim}. What part do you agree with, and what part do you disagree with? Give an example to explain your view.`,
        requiredMoves: ["Explain what you agree with", "Explain what you disagree with", "Support your view with an example", "Give a balanced conclusion"],
      },
      {
        promptEn: `A friend strongly believes that ${profile.trendClaim}. What would you say to your friend? Give your opinion, respond to a different view, and explain how this affects daily life.`,
        requiredMoves: ["State your opinion first", "Mention a different view", "Respond with a reason or example", "Connect it to daily life"],
      },
      {
        promptEn: `Consider this idea: ${profile.trendClaim}. If it becomes more common, what should people, companies, or the government do? What possible problem should they watch for?`,
        requiredMoves: ["Say whether you support the idea", "Suggest one action", "Explain who should act", "Mention one possible problem"],
      },
      {
        promptEn: `Some people believe that ${profile.trendClaim}. Do you think this view will become more or less popular in the next few years? What could support it, and what could slow it down?`,
        requiredMoves: ["Predict the future direction", "Explain what could support it", "Explain what could slow it down", "Give your final reason"],
      },
    ]);
  }

  if (slot === "familiar") {
    return selectBlueprint("c6-familiar-cultural-explanation", {
      type: "description",
      difficulty: 2,
      targetSeconds: 75,
      functions: ["describe", "generalize", "addDetail"],
    }, [
      {
        promptEn: `Imagine someone who is new to Korea asks about ${profile.topicEn}. What would you explain first? Give one example from your life and one useful tip.`,
        requiredMoves: ["Give a simple introduction", "Share one personal example", "Give one useful tip", "Finish with the main point"],
      },
      {
        promptEn: `A visitor asks what ${profile.topicEn} is like in Korea. What is common, what might surprise the visitor, and what advice would you give?`,
        requiredMoves: ["Describe what is common", "Mention one surprise", "Give practical advice", "Avoid saying everyone is the same"],
      },
      {
        promptEn: `What do newcomers sometimes misunderstand about ${profile.topicEn} in Korea? Explain what it is really like, give an example, and offer some advice.`,
        requiredMoves: ["Name one misunderstanding", "Explain the reality", "Give an example", "Offer advice"],
      },
      {
        promptEn: `Someone will spend a month in Korea and asks about ${profile.topicEn}. What should they know, what should they try, and what should they avoid?`,
        requiredMoves: ["Explain one thing to know", "Suggest one thing to try", "Give one thing to avoid", "Explain which advice matters most"],
      },
      {
        promptEn: `A foreign coworker asks what ${profile.topicEn} is like in daily life in Korea. Give a simple explanation, share one experience, and explain how it can be different for each person.`,
        requiredMoves: ["Give a simple explanation", "Share one experience", "Explain that experiences can differ", "Finish with a useful point"],
      },
    ]);
  }

  return selectBlueprint("c6-challenge-future", {
    type: "opinion",
    difficulty: 3,
    targetSeconds: 90,
    functions: ["predict", "hypothesize", "generalize", "supportOpinion"],
  }, [
    {
      promptEn: `How do you think ${profile.futureSubject} will change in the next five to ten years? What is one possible benefit, one concern, and one way people can prepare?`,
      requiredMoves: ["Make one clear prediction", "Give one benefit", "Give one concern", "Suggest how people can prepare"],
    },
    {
      promptEn: `Imagine a good future and a difficult future for ${profile.futureSubject}. What could cause each one? Which future do you think is more likely?`,
      requiredMoves: ["Describe a good future", "Describe a difficult future", "Give a cause for each", "Choose the more likely one"],
    },
    {
      promptEn: `What will have the biggest effect on ${profile.futureSubject} over the next ten years? What change do you expect, who may find it difficult, and what should organizations do?`,
      requiredMoves: ["Choose the biggest influence", "Predict one clear change", "Say who may find it difficult", "Suggest what organizations should do"],
    },
    {
      promptEn: `What changes in ${profile.futureSubject} may happen soon, and what changes may take longer? Explain why, and say what could help the slower changes happen.`,
      requiredMoves: ["Predict one quick change", "Predict one slower change", "Explain why it may take longer", "Say what could help"],
    },
    {
      promptEn: `Think of one change you can already see in ${profile.futureSubject}. If it continues, what will daily life be like in five to ten years? What problem might appear, and how should people prepare?`,
      requiredMoves: ["Start with a change you see now", "Predict how daily life may change", "Mention one possible problem", "Suggest how people can prepare"],
    },
  ]);
}

function buildIdeaPrompts(
  profile: CategoryProfile,
  blueprint: PromptBlueprint,
): KoreanIdeaPrompts {
  const topic = profile.labelKo;
  const select = (
    variants: readonly [
      KoreanIdeaPrompts,
      KoreanIdeaPrompts,
      KoreanIdeaPrompts,
      KoreanIdeaPrompts,
      KoreanIdeaPrompts,
    ],
  ) => variants[blueprint.planningVariant];

  switch (blueprint.type) {
    case "description":
      return select([
        {
          answer: `${topic}에 대해 가장 먼저 말할 전체 모습을 한 문장으로 적어보세요.`,
          reason: "그 특징이나 루틴이 나에게 중요한 이유는 무엇인가요?",
          example: "장소·사람·행동 중 장면이 보이게 만드는 구체적인 디테일 두 가지를 적어보세요.",
          closing: "듣는 사람이 기억했으면 하는 한 가지로 마무리해보세요.",
        },
        {
          answer: `${topic}을 전혀 모르는 사람에게 첫 문장으로 알려 줄 내용을 정하세요.`,
          reason: "왜 그 내용을 가장 먼저 설명해야 이해하기 쉬운가요?",
          example: "처음 보면 바로 알 수 있는 특징 하나와 놓치기 쉬운 특징 하나를 적어보세요.",
          closing: "두 특징이 내 생활과 어떻게 연결되는지 한 문장으로 정리하세요.",
        },
        {
          answer: `${topic}을 떠올렸을 때 가장 먼저 느껴지는 인상이나 특징을 적어보세요.`,
          reason: "그 인상이 생기는 원인을 환경·습관·사람 중 하나로 설명해보세요.",
          example: "그 특징이 실제로 드러난 구체적인 장면을 한 컷처럼 적어보세요.",
          closing: "그 장면이 내 행동이나 기분에 미치는 영향으로 끝내보세요.",
        },
        {
          answer: `${topic}의 전체 모습에서 가장 작은 핵심 디테일까지 설명할 순서를 정하세요.`,
          reason: "여러 특징 중 그 작은 디테일을 골라야 하는 이유는 무엇인가요?",
          example: "크기·소리·분위기·사용 방식 중 두 요소를 구체적으로 적어보세요.",
          closing: "그 디테일에 내가 개인적으로 부여하는 의미를 한 문장으로 적어보세요.",
        },
        {
          answer: `${topic}이 실제 생활에서 어떤 것인지 한 문장으로 안내해보세요.`,
          reason: "비슷한 대상과 구별되는 실용적인 특징은 무엇인가요?",
          example: "그 특징 때문에 내가 실제로 다르게 행동했던 사례를 적어보세요.",
          closing: "설명 전체를 나의 반응이나 평가와 연결해 마무리하세요.",
        },
      ]);
    case "experience":
      return select([
        {
          answer: `${topic}에서 답할 한 가지 경험이나 조언의 결론을 먼저 정하세요.`,
          reason: "왜 그 일이 어렵거나 특별했는지 배경을 적어보세요.",
          example: "시작→변화→결과 순서로 실제 행동과 느낌을 하나씩 적어보세요.",
          closing: "그 경험 뒤 달라진 점이나 배운 점은 무엇인가요?",
        },
        {
          answer: `${topic} 경험에서 이야기가 달라지는 결정적 순간을 한 문장으로 적어보세요.`,
          reason: "그 순간 전에는 어떤 상황이었고 무엇이 변화를 만들었나요?",
          example: "결정적 순간에 내가 한 말이나 행동을 구체적으로 적어보세요.",
          closing: "지금의 내가 그때의 나에게 해 줄 조언으로 마무리하세요.",
        },
        {
          answer: `${topic}과 관련해 전과 후가 분명히 달라진 경험을 하나 고르세요.`,
          reason: "처음에는 무엇이 가장 어렵거나 익숙하지 않았나요?",
          example: "도움이 된 연습·사람·발견과 변화가 드러난 증거를 적어보세요.",
          closing: "아직 남아 있는 과제나 다음 목표를 한 문장으로 적어보세요.",
        },
        {
          answer: `${topic}에서 내가 직접 겪었거나 초보자에게 알려 줄 상황을 정하세요.`,
          reason: "흔히 생기는 실수나 오해가 왜 발생하는지 적어보세요.",
          example: "실수를 피하거나 회복하기 위한 행동을 단계별로 적어보세요.",
          closing: "이 조언을 따르면 어떤 결과를 기대할 수 있는지 정리하세요.",
        },
        {
          answer: `${topic} 경험 중 감정이나 판단이 가장 크게 바뀐 순간을 고르세요.`,
          reason: "처음 생각과 실제 상황 사이에는 어떤 차이가 있었나요?",
          example: "그 차이를 깨닫게 한 사람·말·행동·결과를 구체적으로 적어보세요.",
          closing: "이후 내 습관이나 선택이 어떻게 달라졌는지로 끝내보세요.",
        },
      ]);
    case "comparison":
      return select([
        {
          answer: `${topic}의 두 대상 중 내가 더 선호하는 쪽을 먼저 정하세요.`,
          reason: "가장 큰 차이 두 가지와 그 차이가 중요한 이유는 무엇인가요?",
          example: "실제 경험으로 그 차이를 보여 줄 사례를 하나 적어보세요.",
          closing: "비교를 한 문장으로 요약하며 선택을 다시 확인하세요.",
        },
        {
          answer: `${topic}의 두 선택지를 비교할 기준 두 가지를 먼저 정하세요.`,
          reason: "각 기준에서 어느 쪽이 더 나은지와 그 이유를 나란히 적어보세요.",
          example: "같은 상황에서 두 선택이 다르게 느껴졌던 경험을 적어보세요.",
          closing: "내 필요에 더 잘 맞는 쪽과 그 조건을 분명히 적어보세요.",
        },
        {
          answer: `${topic}에서 상황에 따라 선택이 달라질 수 있다는 결론을 정하세요.`,
          reason: "첫 번째 선택이 유리한 조건과 두 번째 선택이 유리한 조건은 무엇인가요?",
          example: "각 조건을 보여 주는 짧은 실제 또는 가상 사례를 하나씩 적어보세요.",
          closing: "평소의 선택과 예외 상황의 선택을 구분해 마무리하세요.",
        },
        {
          answer: `${topic}을 처음 접하는 사람에게 무엇을 추천할지 먼저 정하세요.`,
          reason: "추천받는 사람의 목적을 기준으로 두 선택지의 강점을 비교해보세요.",
          example: "추천이 잘 맞을 사람과 맞지 않을 사람의 예를 적어보세요.",
          closing: "최종 추천과 가장 중요한 판단 기준을 한 문장으로 적어보세요.",
        },
        {
          answer: `${topic}의 두 선택지 모두 장단점이 있다는 균형 잡힌 입장을 정하세요.`,
          reason: "각 선택의 장점 하나와 단점 하나를 같은 기준으로 비교해보세요.",
          example: "단점 때문에 실제로 선택을 바꿨던 상황을 적어보세요.",
          closing: "어떤 상황에서 어느 쪽을 고를지 조건부 결론으로 마무리하세요.",
        },
      ]);
    case "change":
      return select([
        {
          answer: `${topic}가 과거에서 현재로 어떻게 달라졌는지 한 문장으로 정리하세요.`,
          reason: "그 변화를 만든 사회적·기술적·생활상의 원인은 무엇인가요?",
          example: "변화를 눈으로 확인할 수 있는 실제 사례나 관찰을 하나 적어보세요.",
          closing: "이 변화가 좋은지 나쁜지, 또는 누구에게 중요한지 정리하세요.",
        },
        {
          answer: `${topic}을 10년 만에 다시 본 사람이 가장 놀랄 변화부터 정하세요.`,
          reason: "그 변화가 빠르게 일어난 핵심 원인은 무엇이라고 생각하나요?",
          example: "예전에는 어땠고 지금은 어떤지를 같은 장면으로 대비해 적어보세요.",
          closing: "그 변화가 일상에서 중요한 이유를 한 문장으로 마무리하세요.",
        },
        {
          answer: `${topic}의 변화를 가속한 전환점 하나를 먼저 고르세요.`,
          reason: "전환점 전후에 사람들의 필요나 기술이 어떻게 달라졌나요?",
          example: "의도한 결과와 예상하지 못한 결과를 하나씩 적어보세요.",
          closing: "전체 변화를 긍정·부정·혼합 중 하나로 평가해보세요.",
        },
        {
          answer: `${topic}의 변화로 이익을 본 집단과 어려워진 집단을 정하세요.`,
          reason: "같은 변화가 두 집단에 다르게 작용하는 이유는 무엇인가요?",
          example: "각 집단의 입장이 드러나는 구체적인 상황을 하나씩 적어보세요.",
          closing: "두 입장을 고려한 나의 최종 평가나 보완책을 적어보세요.",
        },
        {
          answer: `${topic}이 달라졌음을 보여 주는 일상 속 증거부터 적어보세요.`,
          reason: "그 작은 증거 뒤에 있는 더 큰 사회적 원인은 무엇인가요?",
          example: "개인 사례가 일반적인 변화로 이어지는 연결 고리를 적어보세요.",
          closing: "앞으로 이 변화가 어디까지 갈지 짧게 전망해보세요.",
        },
      ]);
    case "roleplay":
      return select([
        {
          answer: `${topic} 롤플레이에서 상대에게 원하는 결과와 현재 상황을 먼저 정하세요.`,
          reason: "반드시 확인해야 할 정보 세 가지를 실제 질문 형태로 적어보세요.",
          example: "문제가 생겼을 때 제안할 수 있는 서로 다른 대안 두 가지는 무엇인가요?",
          closing: "상대와 최종적으로 확인할 일정·행동·연락 방법을 적어보세요.",
        },
        {
          answer: `${topic} 관련 전화의 목적을 첫 두 문장으로 어떻게 밝힐지 적어보세요.`,
          reason: "가능 여부·세부 조건·시간을 확인할 질문을 하나씩 만들어보세요.",
          example: "나쁜 소식을 들었을 때 자연스럽게 반응한 뒤 꺼낼 대안을 적어보세요.",
          closing: "합의 내용을 내가 다시 말해 확인하는 문장으로 끝내보세요.",
        },
        {
          answer: `${topic} 상황에서 지금 가장 급하게 해결해야 할 요청을 정하세요.`,
          reason: "가격·조건·일정 중 필요한 항목을 구체적인 의문문으로 바꿔보세요.",
          example: "서로 겹치지 않는 선택지 두 개와 각각의 장점을 적어보세요.",
          closing: "상대에게 둘 중 가능한 것을 분명히 골라 달라고 요청해보세요.",
        },
        {
          answer: `${topic} 롤플레이를 정보 확인→문제 설명→해결 협의 순서로 나누세요.`,
          reason: "결정 전에 꼭 알아야 할 사실과 문제 뒤에도 바꿀 수 있는 조건은 무엇인가요?",
          example: "상대와 내가 각각 다음에 해야 할 행동을 구체적으로 적어보세요.",
          closing: "담당자·기한·연락 방법까지 포함해 최종 확인 문장을 만드세요.",
        },
        {
          answer: `${topic} 상황에서 오해를 막기 위해 다시 확인할 내용을 정하세요.`,
          reason: "문제가 나에게 미치는 영향을 예의 바르지만 분명하게 어떻게 말할까요?",
          example: "내가 양보할 수 있는 조건을 활용해 타협안 두 가지를 적어보세요.",
          closing: "모호한 답을 피하도록 구체적인 승인을 요청하는 문장으로 끝내세요.",
        },
      ]);
    case "problem":
      return select([
        {
          answer: `${topic}에서 생긴 문제를 한 문장으로 명확하게 적으세요.`,
          reason: "표면적인 사건 뒤에 있던 직접적인 원인은 무엇이었나요?",
          example: "내가 실제로 취한 행동과 그 결과를 순서대로 적어보세요.",
          closing: "다시 겪는다면 무엇을 다르게 할지 가정해서 적어보세요.",
        },
        {
          answer: `${topic} 문제에서 내가 결정해야 했던 선택을 먼저 적어보세요.`,
          reason: "가능했던 두 가지 행동과 당시 하나를 고른 이유는 무엇인가요?",
          example: "선택한 행동이 실제로 만든 결과를 구체적으로 적어보세요.",
          closing: "지금 다시 선택한다면 같은 결정을 할지 이유와 함께 적어보세요.",
        },
        {
          answer: `${topic} 문제가 커지기 전에 나타난 첫 경고 신호를 정하세요.`,
          reason: "처음 계획이 실패한 지점과 그 원인은 무엇이었나요?",
          example: "실패 뒤 사용한 대처와 최종 결과를 단계별로 적어보세요.",
          closing: "다음에 사용할 현실적인 백업 계획을 한 문장으로 적어보세요.",
        },
        {
          answer: `${topic}에서 겪은 문제를 친구에게 조언할 사례로 정리하세요.`,
          reason: "친구가 같은 문제를 겪을 가능성이 높은 이유는 무엇인가요?",
          example: "해야 할 행동 하나와 피해야 할 행동 하나를 내 경험과 연결해 적어보세요.",
          closing: "그 조언을 따르면 달라질 결과를 가정해서 마무리하세요.",
        },
        {
          answer: `${topic} 문제에서 통제할 수 있었던 것과 없었던 것을 나눠 적어보세요.`,
          reason: "내 준비나 판단이 결과에 영향을 준 부분은 무엇인가요?",
          example: "외부 상황에 대응해 실제로 한 행동과 그 한계를 적어보세요.",
          closing: "준비가 달랐다면 결과가 어떻게 바뀌었을지 반대 사실로 끝내보세요.",
        },
      ]);
    case "opinion":
      return select([
        {
          answer: `${topic}에 대한 찬성·반대 또는 핵심 전망을 한 문장으로 정하세요.`,
          reason: "개인 경험을 넘어 사회적으로 설명할 수 있는 원인이나 근거는 무엇인가요?",
          example: "내 주장을 뒷받침하는 구체적인 사례와 영향을 받는 집단을 적어보세요.",
          closing: "앞으로의 변화나 필요한 대응을 한 문장으로 제안하세요.",
        },
        {
          answer: `${topic}의 주장 중 동의하는 부분과 조건을 붙여야 할 부분을 나누세요.`,
          reason: "각 부분을 판단할 때 사용할 사회적·실용적 기준은 무엇인가요?",
          example: "개인 취향이 아닌 관찰·사례·상식적 근거를 하나 적어보세요.",
          closing: "어떤 조건이 생기면 내 입장이 바뀔 수 있는지 적어보세요.",
        },
        {
          answer: `${topic}에 대한 내 주장을 개인 일화보다 먼저 한 문장으로 적으세요.`,
          reason: "반대편이 제시할 가장 강한 논거는 무엇이고 어떻게 답할 수 있나요?",
          example: "내 답변이 개인을 넘어 사회나 일상에 미치는 영향을 보여 줄 사례를 적어보세요.",
          closing: "반론까지 고려한 뒤에도 유지되는 최종 입장을 확인하세요.",
        },
        {
          answer: `${topic}에 대해 내가 지지하는 입장과 필요한 행동을 함께 정하세요.`,
          reason: "누가 그 행동을 해야 하고 왜 현실적인 해결책이라고 생각하나요?",
          example: "좋은 의도와 달리 생길 수 있는 부작용을 하나 예상해보세요.",
          closing: "부작용을 줄일 안전장치나 보완책으로 마무리하세요.",
        },
        {
          answer: `${topic}의 흐름이 앞으로 강해질지 약해질지 전망을 먼저 정하세요.`,
          reason: "현재 흐름을 밀어붙이는 원인과 반대로 막는 힘은 각각 무엇인가요?",
          example: "두 힘이 실제로 충돌하는 구체적인 상황을 적어보세요.",
          closing: "단정하지 말고 조건과 근거를 붙인 최종 예측으로 마무리하세요.",
        },
      ]);
  }
}

function buildQuestion(
  profile: CategoryProfile,
  cycle: CurriculumCycle,
  slot: QuestionSlot,
): DailyQuestion {
  const blueprint = buildBlueprint(profile, cycle, slot);
  const daySetId = `${profile.id}-cycle-${cycle}`;
  const promptEn = blueprint.promptEn;

  return {
    id: `${daySetId}-${slot}`,
    daySetId,
    category: profile.id,
    categoryKo: profile.labelKo,
    topic: profile.topicEn,
    cycle,
    slot,
    type: blueprint.type,
    difficulty: blueprint.difficulty,
    targetSeconds: blueprint.targetSeconds,
    promptEn,
    framingId: blueprint.framingId,
    planningPatternId: blueprint.planningPatternId,
    ttsText: promptEn,
    functions: blueprint.functions,
    requiredMoves: blueprint.requiredMoves,
    koreanIdeaPrompts: buildIdeaPrompts(profile, blueprint),
    recurrenceKey: `${profile.id}:${blueprint.type}`,
    sourceLabel: QUESTION_BANK_SOURCE_LABEL,
  };
}

export const QUESTION_BANK: readonly DailyQuestion[] = Object.freeze(
  CATEGORY_PROFILES.flatMap((profile) =>
    CYCLES.flatMap((cycle) => [
      buildQuestion(profile, cycle, "familiar"),
      buildQuestion(profile, cycle, "challenge"),
    ]),
  ),
);

const QUESTION_BY_ID = new Map(
  QUESTION_BANK.map((question) => [question.id, question] as const),
);

function getPair(category: QuestionCategoryId, cycle: CurriculumCycle) {
  const daySetId = `${category}-cycle-${cycle}`;
  const familiar = QUESTION_BY_ID.get(`${daySetId}-familiar`);
  const challenge = QUESTION_BY_ID.get(`${daySetId}-challenge`);

  if (!familiar || !challenge) {
    throw new Error(`Question pair is incomplete: ${daySetId}`);
  }

  return [familiar, challenge] as const;
}

/**
 * Six 15-day rounds. Every category appears once per round, while the offset
 * prevents the boundary between rounds from repeating the same category.
 */
const CYCLE_OFFSETS: Readonly<Record<CurriculumCycle, number>> = {
  1: 0,
  2: 4,
  3: 8,
  4: 12,
  5: 1,
  6: 5,
};

export const DAILY_QUESTION_SETS: readonly DailyQuestionSet[] = Object.freeze(
  CYCLES.flatMap((cycle) => {
    const offset = CYCLE_OFFSETS[cycle];
    return QUESTION_CATEGORY_IDS.map((_, index) => {
      const category =
        QUESTION_CATEGORY_IDS[(index + offset) % QUESTION_CATEGORY_IDS.length];
      const profile = CATEGORY_PROFILES.find((item) => item.id === category);

      if (!profile) {
        throw new Error(`Unknown category: ${category}`);
      }

      return {
        id: `${category}-cycle-${cycle}`,
        sequence: 0,
        category,
        categoryKo: profile.labelKo,
        cycle,
        questions: getPair(category, cycle),
      };
    });
  }).map((set, index) => ({ ...set, sequence: index + 1 })),
);

const MILLISECONDS_PER_DAY = 86_400_000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayNumberFromDateKey(dateKey: string): number {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}. Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const normalized = new Date(timestamp).toISOString().slice(0, 10);

  if (normalized !== dateKey) {
    throw new Error(`Invalid calendar date: ${dateKey}.`);
  }

  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Returns an ISO-like date key using Korea's calendar day, never UTC's day. */
export function getSeoulDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Study days are one-based and wrap only after all 90 original pairs. */
export function getDailySetByStudyDay(studyDay: number): DailyQuestionSet {
  if (!Number.isInteger(studyDay) || studyDay < 1) {
    throw new Error("studyDay must be a positive integer.");
  }

  return DAILY_QUESTION_SETS[(studyDay - 1) % DAILY_QUESTION_SETS.length];
}

export function getDailySetForDate(
  dateKey: string = getSeoulDateKey(),
  anchorDateKey: string = CURRICULUM_ANCHOR_DATE,
): DailyQuestionSet {
  const offset = dayNumberFromDateKey(dateKey) - dayNumberFromDateKey(anchorDateKey);
  return DAILY_QUESTION_SETS[
    positiveModulo(offset, DAILY_QUESTION_SETS.length)
  ];
}

function isCategoryId(value: string): value is QuestionCategoryId {
  return (QUESTION_CATEGORY_IDS as readonly string[]).includes(value);
}

/**
 * Returns the day's two-question lesson. If survey interests are supplied, the
 * selected topics rotate deterministically while the six functional cycles
 * advance after every full topic round.
 */
export function getQuestionPairForDate(
  dateKey: string = getSeoulDateKey(),
  selectedCategories?: readonly string[],
): readonly [DailyQuestion, DailyQuestion] {
  const selected = Array.from(
    new Set((selectedCategories ?? []).filter(isCategoryId)),
  ).sort(
    (a, b) =>
      QUESTION_CATEGORY_IDS.indexOf(a) - QUESTION_CATEGORY_IDS.indexOf(b),
  );

  if (selected.length === 0) {
    return getDailySetForDate(dateKey).questions;
  }

  const offset =
    dayNumberFromDateKey(dateKey) - dayNumberFromDateKey(CURRICULUM_ANCHOR_DATE);
  const normalizedOffset = positiveModulo(
    offset,
    selected.length * CYCLES.length,
  );
  const category = selected[normalizedOffset % selected.length];
  const cycle = CYCLES[
    Math.floor(normalizedOffset / selected.length) % CYCLES.length
  ];
  return getPair(category, cycle);
}

export function getQuestionById(id: string): DailyQuestion | undefined {
  return QUESTION_BY_ID.get(id);
}
