// Deterministic generator for the ADDITIONAL global editions 0.2-review-draft (en) and 0.2-review-draft-hi (hi).
// It only READS lib/curriculum-versions/0.1-review-draft.json and never writes to it.
// Output is committed; lib/academy-curriculum.ts pins the resulting SHA256 values.
// All content is synthetic: "Review draft: not approved sector training". Nothing here claims real approval.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HI } from './curriculum-0.2-hindi.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = (f) => resolve(root, 'lib/curriculum-versions', f);
const base = JSON.parse(readFileSync(v('0.1-review-draft.json'), 'utf8'));
const clone = (x) => structuredClone(x);

export const EN_VERSION = '0.2-review-draft';
export const HI_VERSION = '0.2-review-draft-hi';
const STATUS = base.status;
const HI_LABEL = 'Hindi draft — machine-assisted, needs native review';

/* ---------- shared Responsible AI foundation (identical in every pathway) ---------- */
const FOUNDATION_MODULE = 'responsible-ai-foundation';
const foundation = [
  {
    id: 'rai-01',
    title: 'Accuracy and limits: AI can sound sure and still be wrong',
    estimatedMinutes: 15,
    objective:
      'Recognise that AI output can be fluent but wrong, and check each important claim against a source before using it.',
    lessonText:
      'AI tools write fluent answers even when the answer is wrong. They can invent a number, a rule, a date or a source and still sound sure. A tool does not know your farm, your shop or your office. It works only from the words it is given. Treat every AI answer as a draft. Check each important statement against a source you trust, such as your own record, a written rule or a qualified person. If you cannot find support for a statement, mark it unverified and keep it out of anything you share. Check the arithmetic yourself. Ask what the tool could not have known. A short, honest answer that says what is unknown is more useful than a long answer that guesses.',
    steps: [
      'Read the supplied AI draft',
      'Underline each factual claim',
      'Find the supporting line in the source packet for each claim',
      'Mark each claim supported, unsupported or unknown',
      'Rewrite the draft keeping only supported claims',
    ],
    exercise: {
      title: 'Check a confident AI note against its source',
      sourcePacket: [
        { sourceId: 'F1', fact: 'Fictional price list: seed packet INR 120; fertiliser sack INR 900.' },
        {
          sourceId: 'F2',
          fact: 'No information about rainfall, soil or expected yield is supplied in this exercise.',
        },
      ],
      suppliedAiDraft:
        'Seed costs INR 120 and fertiliser costs INR 900, so the total is INR 1,020. Heavy rain is coming this month, so buy extra fertiliser now.',
      optionalAiPrompt:
        'Using only the supplied fictional price list, write a two-line cost note. Say what is not known. Do not predict weather or yield.',
      learnerTask:
        'Mark each statement in the draft as supported, unsupported or unknown, then write a corrected two-line note.',
      expectedEvidence: [
        'Cost statements marked supported by source F1',
        'Rain and purchase advice marked unsupported because F2 gives no rainfall information',
        'Corrected note that states INR 1,020 and names what is not known',
      ],
      assessorReference:
        'The two prices and the total INR 1,020 (120 + 900) are supported by F1. The heavy-rain claim and the advice to buy extra fertiliser are unsupported, because F2 states that no weather, soil or yield information is supplied. A good answer keeps the supported facts and says what is not known.',
    },
    quiz: [
      {
        id: 'rai-01-q1',
        question: 'An AI answer sounds very sure. What does that tell you about whether it is correct?',
        options: [
          'It is probably correct because it sounds so confident',
          'Nothing by itself: fluent wording is not evidence, so check it',
          'It is correct if it includes numbers',
          'It is correct if it is long',
        ],
        correctOptionIndex: 1,
        explanation:
          'Confident wording is not evidence. AI tools can state invented facts in the same tone as true ones, so important claims need a check against a source.',
      },
      {
        id: 'rai-01-q2',
        question:
          'The source packet says nothing about rain, but the AI draft predicts heavy rain. What should you do?',
        options: [
          'Mark it unsupported and leave it out of what you share',
          'Keep it because AI tools know the weather',
          'Make the prediction stronger',
          'Share it as an official forecast',
        ],
        correctOptionIndex: 0,
        explanation:
          'A claim with no support in the source is unsupported. Leave it out or mark it clearly as unverified.',
      },
      {
        id: 'rai-01-q3',
        question: 'Which is the best check for a total that an AI tool calculated?',
        options: [
          'Trust it if it is shown in bold',
          'Ask the tool whether it is sure',
          'Add the numbers from the source yourself',
          'Round it to the nearest ten',
        ],
        correctOptionIndex: 2,
        explanation:
          'Adding the source numbers yourself is an independent check. Asking the same tool if it is sure is not.',
      },
    ],
    reflectionPrompt:
      'Think of a time a confident answer turned out to be wrong. What check would have caught it?',
    returnToWorkAction:
      'Before you use an AI draft for a permitted task, mark each important statement as supported, unsupported or unknown, and remove anything you cannot support.',
    summary:
      'AI can sound sure and still be wrong. Treat every answer as a draft. Check each important claim against a source you trust, add up the numbers yourself, and leave out anything you cannot support.',
  },
  {
    id: 'rai-02',
    title: 'Privacy and human judgment: what stays out and who decides',
    estimatedMinutes: 15,
    objective:
      'Keep private details out of unapproved AI tools and name the accountable person who decides anything that affects others.',
    lessonText:
      "Some information should not be typed into an AI tool unless your organisation has approved that tool for that use. This includes names, phone numbers, bank or identity details, exact locations, health details and anything someone gave you in confidence. In this course you use only fictional records, so you never need real ones. A second rule is about decisions. AI can draft, sort and suggest. An accountable person decides anything that affects someone's money, health, safety, rights or services. Keep a short note of who checked the work and what they changed. If you are unsure whether a task is suitable, stop and ask a supervisor or a qualified person before you continue. You can always do the task by hand.",
    steps: [
      'Read the three fictional task cards',
      'Mark any detail that is private',
      'Decide which tasks AI may help draft',
      'Decide which tasks need a person to decide',
      'Write one sentence naming who checks the result',
    ],
    exercise: {
      title: 'Sort tasks by privacy and by who decides',
      sourcePacket: [
        {
          sourceId: 'P1',
          task: 'Draft a polite reminder to pay a fictional small bill',
          contains: 'No personal details',
        },
        {
          sourceId: 'P2',
          task: 'Decide whether a fictional neighbour qualifies for a support payment',
          contains: 'Name, identity number and income of one person',
        },
        { sourceId: 'P3', task: 'Sort fictional meeting notes into groups', contains: 'No personal details' },
      ],
      suppliedAiDraft:
        "All three tasks are fine to give to the AI tool. Paste the neighbour's name, identity number and income into it and let it decide who gets paid.",
      optionalAiPrompt:
        'Do not paste any real details. Ask the tool to explain in two lines why a fictional payment decision should stay with an accountable person.',
      learnerTask:
        'Identify the private details, explain why they stay out of the tool, and name who must make the payment decision.',
      expectedEvidence: [
        'P2 identified as holding private details that stay out of an unapproved tool',
        'P2 identified as a money decision that an accountable person must make',
        'P1 and P3 identified as tasks AI may help with, with a person checking the result',
      ],
      assessorReference:
        'P1 and P3 contain no private details and are low-stakes drafting or sorting tasks, so AI may help if a person checks the result. P2 holds personal and financial details and is a decision about a payment, so the details stay out of unapproved tools and an accountable person decides.',
    },
    quiz: [
      {
        id: 'rai-02-q1',
        question: 'Which detail should stay out of an unapproved AI tool?',
        options: [
          'A fictional price list from this course',
          "A customer's phone number and bank details",
          'A general question about how to format a table',
          'A made-up example sentence',
        ],
        correctOptionIndex: 1,
        explanation:
          'Phone numbers and bank details are private. They stay out of tools your organisation has not approved for that use.',
      },
      {
        id: 'rai-02-q2',
        question: 'Who should decide whether a person receives a payment or a service?',
        options: [
          'The AI tool, because it is faster',
          'Whoever typed the request',
          'An accountable person, who may use an AI draft as one input',
          'Nobody, the tool applies the rules automatically',
        ],
        correctOptionIndex: 2,
        explanation:
          "Decisions that affect someone's money, rights or services belong to an accountable person. An AI draft can be one input, never the decision-maker.",
      },
      {
        id: 'rai-02-q3',
        question: 'You are not sure a task is suitable for AI. What is the best next step?',
        options: [
          'Stop and ask a supervisor or a qualified person',
          'Go ahead and fix problems later',
          'Ask the AI tool to approve the task',
          'Paste real records to test it',
        ],
        correctOptionIndex: 0,
        explanation:
          'When suitability is unclear, stop and ask. The task can be done by hand while you wait.',
      },
    ],
    reflectionPrompt:
      'Which detail in your own work would you never put into an unapproved tool, and who would you ask if unsure?',
    returnToWorkAction:
      'List three kinds of private detail in your work that stay out of AI tools, and write down the name of the person you will ask when a task is unclear.',
    summary:
      'Keep private details out of AI tools your organisation has not approved. AI can help draft and sort, but a person who is accountable decides anything that affects money, health, safety, rights or services. If unsure, stop and ask.',
  },
];

/* ---------- suitable vs unsuitable AI use: classify-this-task scenarios ---------- */
const CLASSES = {
  S: 'Suitable: AI may help draft it and a person checks the result',
  N: 'Suitable: AI may finish it alone with no checking',
  H: 'Unsuitable: a qualified or accountable person must decide it',
  P: 'Unsuitable: it needs private details that must not go into an AI tool',
};
const SHORT = {
  S: 'suitable with a human check',
  H: 'unsuitable, a person must decide',
  P: 'unsuitable, private details',
};
const ROTATIONS = [
  ['S', 'N', 'H', 'P'],
  ['N', 'H', 'S', 'P'],
  ['H', 'P', 'N', 'S'],
  ['P', 'S', 'H', 'N'],
];

const SCENARIOS = {
  'farmer-work-records': {
    prefix: 'farm',
    setting: 'Farm',
    who: 'a crop, an animal or a farm worker',
    title: 'farm tasks',
    items: [
      [
        'Ask an AI tool to turn your fictional list of seed and fertiliser purchases into a tidy table.',
        'S',
        'This organises records you supplied and carries low risk. You still check the total against the receipts.',
      ],
      [
        'Ask an AI tool to decide how much pesticide to spray on a field and when to spray it.',
        'H',
        'The decision affects the crop, safety and health. A qualified agriculture expert decides; an AI draft is not enough.',
      ],
      [
        "Paste a farm worker's name, phone number and bank account number into an AI tool to produce a payment list.",
        'P',
        'These are private details. They stay out of tools that are not approved for them, and a list can use reference codes instead.',
      ],
      [
        'Ask an AI tool to draft a short list of questions to take to the agriculture extension officer about a fictional soil report.',
        'S',
        'Drafting questions is a good use of AI. The officer, not the tool, gives the advice, and you check the questions first.',
      ],
      [
        'Let an AI tool declare that a fictional batch of seed is certified disease-free and print the label from its answer.',
        'H',
        'Certification needs qualified testing and an accountable signature. An AI statement is not a test result.',
      ],
      [
        'Ask an AI tool to explain in simple words what a fictional government scheme leaflet says, then compare the answer with the leaflet.',
        'S',
        'Plain-language explanation is suitable when you compare it with the original leaflet before relying on it.',
      ],
    ],
  },
  'msme-customer-operations': {
    prefix: 'msme',
    setting: 'Small business',
    who: 'a customer or an employee',
    title: 'small-business tasks',
    items: [
      [
        'Ask an AI tool to draft a friendly reply to a fictional customer who asks when an order will arrive, using the order note you supply.',
        'S',
        'Drafting from facts you supply is low risk. You check the date and tone before sending.',
      ],
      [
        "Ask an AI tool to decide whether to refuse a fictional customer's refund and send the refusal by itself.",
        'H',
        "A refund decision affects a customer's money and rights. The business owner or manager decides and sends it.",
      ],
      [
        "Paste a customer's full name, home address and payment card number into an AI tool to write a delivery note.",
        'P',
        'Card and address details are private. A delivery note can use an order number instead.',
      ],
      [
        "Ask an AI tool to turn a fictional day's sales and stock notes into a checklist of jobs for tomorrow.",
        'S',
        'Turning notes into a checklist is suitable. A person checks that the jobs match the real stock and sales.',
      ],
      [
        'Ask an AI tool to decide which employee to dismiss, based on a fictional attendance sheet.',
        'H',
        "Dismissal affects a person's livelihood and rights. An accountable manager decides, following the proper process.",
      ],
      [
        'Ask an AI tool for three clearer wordings of a fictional shop notice, then choose one yourself.',
        'S',
        'Suggesting wording is low risk because you choose and read the final text.',
      ],
    ],
  },
  'public-servant-source-briefs': {
    prefix: 'gov',
    setting: 'Public service',
    who: 'a citizen or an applicant',
    title: 'public-service tasks',
    items: [
      [
        'Ask an AI tool to turn a fictional, permitted meeting note into a one-page draft brief, then check every line against the note.',
        'S',
        'Drafting from a permitted source is suitable. Checking each line against the note keeps invented content out.',
      ],
      [
        'Ask an AI tool to decide whether a fictional applicant is eligible for a benefit and issue the decision letter.',
        'H',
        "An eligibility decision affects a person's rights. An authorised officer decides and signs the letter.",
      ],
      [
        "Paste a citizen's name, identity number and health details from a case file into an AI tool to summarise the case.",
        'P',
        'Health and identity details are private and must stay out of tools that are not approved for case data.',
      ],
      [
        'Ask an AI tool to check a fictional table of figures for typing errors and list anything odd for you to verify.',
        'S',
        'Flagging oddities is suitable because you verify each flagged item against the source yourself.',
      ],
      [
        'Let an AI tool write the final wording of a fictional official order and publish it under your name without reading it.',
        'H',
        'Official orders carry legal authority. The authorised person must read, approve and own the final text.',
      ],
      [
        'Ask an AI tool to draft plain-language headings for a fictional public notice that you will review and approve.',
        'S',
        'Drafting headings is low risk when an accountable person reviews and approves the notice.',
      ],
    ],
  },
};

function scenarioLesson(programId, part) {
  const c = SCENARIOS[programId];
  const items = c.items.slice((part - 1) * 3, part * 3);
  const first = (part - 1) * 3;
  const id = `${c.prefix}-scn-${part}`;
  const quiz = items.map(([task, answer, why], i) => {
    const order = ROTATIONS[(first + i) % 4];
    return {
      id: `${id}-q${i + 1}`,
      question: `Classify this task: ${task}`,
      options: order.map((k) => CLASSES[k]),
      correctOptionIndex: order.indexOf(answer),
      explanation: why,
    };
  });
  return {
    id,
    title: `Suitable or unsuitable AI use: ${c.title} (part ${part} of 2)`,
    estimatedMinutes: 15,
    objective: `Sort everyday ${c.title} into suitable and unsuitable AI use and give a reason for each.`,
    lessonText: `Before you use AI for a task, ask three questions. First, does the task need private details such as names, phone numbers, bank, identity or health details? Second, does it decide something that affects ${c.who}, or anyone's money, health, safety, rights or services? Third, can a person check the result against a source? A task is suitable when it is low-risk, uses only information you may share, and a person checks the result. A task is unsuitable when it needs private details in an unapproved tool, or when the decision must belong to a qualified or accountable person. Sometimes a task is unsuitable as asked but a smaller part of it is suitable, such as drafting questions for an expert. Sort the tasks in the packet, then say who checks or decides each one.`,
    steps: [
      'Read each task card in the source packet',
      'Ask the three questions for each task',
      'Classify each task as suitable or unsuitable',
      'Name who checks or who decides each task',
      'Write one reason for each classification',
    ],
    exercise: {
      title: `Sort ${c.title} into suitable and unsuitable AI use`,
      sourcePacket: items.map(([task], i) => ({ sourceId: `S${first + i + 1}`, task, setting: c.setting })),
      suppliedAiDraft:
        'AI can do all of these tasks quickly, so give every task to the tool and use whatever it returns without checking.',
      optionalAiPrompt:
        'Do not paste real details. Ask the tool to explain in two lines why one fictional task might need a human decision.',
      learnerTask:
        'Classify each task as suitable or unsuitable for AI use. For each one, name who checks or who decides, and give one reason.',
      expectedEvidence: items.map(
        ([, a], i) => `S${first + i + 1} classified as ${SHORT[a]}, with a reason and a named person`,
      ),
      assessorReference: items.map(([, a, why], i) => `S${first + i + 1}: ${SHORT[a]}. ${why}`).join(' '),
    },
    quiz,
    reflectionPrompt:
      'Which task in your own work is suitable only if a person checks it, and who would check it?',
    returnToWorkAction:
      'Choose one real task you do often. Write down the three questions and your classification before you use any AI tool for it.',
    summary: `Ask three questions before using AI: does it need private details, does it decide something that affects a person, and can someone check the result. Low-risk tasks with a human check are suitable; private details and consequential decisions are not. This part covers ${items.length} ${c.title}.`,
    _scenarioMeta: items.map(([task, answer, why], i) => ({
      sourceId: `S${first + i + 1}`,
      answer,
      task,
      why,
    })),
  };
}

/* ---------- plain-language summaries for the original lessons ---------- */
const SUMMARY = {
  'farm-01':
    'Keep a simple record with one row for each real payment. Before removing a repeated line, check the receipt or reference to see whether it is a true copy. Add up the checked amounts yourself.',
  'farm-02':
    'An AI summary can mix true statements with invented ones. Check each claim against your record, write down what is missing, and ask an expert before any big farm decision.',
  'farm-03':
    'Use AI to organise your questions, not to answer them. Write what you know, what is missing and what you want to ask, and keep facts apart from guesses.',
  'msme-01':
    'Write customer replies only from facts you are allowed to share. Check every statement before sending, and leave out internal details the customer does not need.',
  'msme-02':
    'Turn your records into a short checklist with an owner for each job. Do not let AI say a job is done or promise something that nobody agreed to.',
  'msme-03':
    'Measure whether AI really helps by counting the checking time as well as the drafting time. Try it on one safe task first and compare the quality.',
  'gov-01':
    'Draft a brief only from sources you are permitted to use. Remove any rule, requirement or authority that is not in the source.',
  'gov-02':
    'Calculate the figures yourself and check them against the source. Do not accept an AI explanation of cause or performance unless the evidence supports it.',
  'gov-03':
    'An AI draft is not an official document. Hand it to the person with authority to review and approve it, and keep the draft and the official version clearly separate.',
};

const ordinalEn = (n) => `Step ${n}.`;
function transcript(l, tr) {
  const T = tr;
  return [
    `${T.lesson}: ${l.title}.`,
    `${T.objective}: ${l.objective}`,
    l.lessonText,
    `${T.steps}: ${l.steps.map((s, i) => `${T.step(i + 1)} ${s}${/[.।]$/.test(s) ? '' : '.'}`).join(' ')}`,
    `${T.reflect}: ${l.reflectionPrompt}`,
    `${T.work}: ${l.returnToWorkAction}`,
  ].join('\n\n');
}
const EN_TR = {
  lesson: 'Lesson',
  objective: 'Objective',
  steps: 'Steps',
  step: ordinalEn,
  reflect: 'Think about this',
  work: 'Put it to work carefully',
};
const AUDIO_EN = {
  status: 'not-recorded',
  label: 'Audio not recorded yet',
  note: "This is a placeholder only. No audio file exists for this lesson. Read the full transcript below, or use your device's read-aloud feature.",
};

function packetObjects(lesson) {
  // Same normalisation as lib/academy-authoring.ts template(): string rows become referenced objects; confirmed copies are marked.
  const seen = new Set();
  lesson.exercise.sourcePacket = lesson.exercise.sourcePacket.map((row, index) => {
    const item =
      typeof row === 'string' ? { sourceId: lesson.id + '-source-' + (index + 1), content: row } : row;
    const id = item.sourceId.trim();
    if (seen.has(id) && typeof item.sourceNote === 'string' && /confirmed copied line/i.test(item.sourceNote))
      item.duplicateOf = id;
    seen.add(id);
    return item;
  });
}

function addFormats(lesson, moduleId, summary) {
  const { _scenarioMeta, ...rest } = lesson;
  const out = {
    id: rest.id,
    module: moduleId,
    ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'id' && k !== 'summary')),
  };
  out.summary = summary ?? rest.summary;
  out.transcript = transcript(out, EN_TR);
  out.audio = clone(AUDIO_EN);
  return out;
}

export function buildEnglish() {
  const pathways = base.pathways.map((src) => {
    const p = clone(src);
    const original = p.lessons.map((l) => {
      const c = clone(l);
      packetObjects(c);
      return addFormats(c, 'pathway-core', SUMMARY[l.id]);
    });
    const scn = [1, 2].map((n) => addFormats(scenarioLesson(p.id, n), 'suitable-unsuitable-use'));
    const fnd = foundation.map((l) => addFormats(clone(l), FOUNDATION_MODULE));
    p.lessons = [...fnd, ...original, ...scn];
    p.estimatedMinutes =
      src.estimatedMinutes +
      fnd.reduce((s, l) => s + l.estimatedMinutes, 0) +
      scn.reduce((s, l) => s + l.estimatedMinutes, 0);
    p.foundation = {
      moduleId: FOUNDATION_MODULE,
      title: 'Responsible AI foundation',
      topics: ['Accuracy', 'Privacy', 'Limits', 'Human judgment'],
      lessonIds: fnd.map((l) => l.id),
      note: 'Shared module. Every pathway in this edition includes it unchanged.',
    };
    p.formatAlternatives = {
      transcript: 'Every lesson has a full text transcript.',
      summary: 'Every lesson has a plain-language summary.',
      listen: 'Audio not recorded yet: the listen option is a labelled placeholder with no media file.',
    };
    return p;
  });
  return {
    schemaVersion: base.schemaVersion,
    contentVersion: EN_VERSION,
    product: base.product,
    status: STATUS,
    language: 'en',
    audience: base.audience,
    editionNotes: [
      'Additional edition. Edition 0.1-review-draft is unchanged and learners enrolled on it stay on it.',
      'Adds the Responsible AI foundation module, suitable-versus-unsuitable AI use scenarios, transcripts, plain-language summaries and an audio placeholder.',
      'The Health pathway is not part of this edition: it needs clinical domain review (domain-review-needed) and no clinical content is authored here.',
      'Audio is a placeholder. No recording exists.',
    ],
    designNotes: base.designNotes,
    assessmentPolicy: base.assessmentPolicy,
    pathways,
  };
}

/* ---------- Hindi draft of ONE pathway (farm) ---------- */
export function buildHindi(en) {
  const src = en.pathways.find((p) => p.id === 'farmer-work-records');
  const p = clone(src);
  const h = HI.program;
  p.title = h.title;
  p.summary = h.summary;
  p.promise = h.promise;
  p.prerequisites = h.prerequisites;
  p.outcomes = h.outcomes;
  p.translationNotice = HI.notice;
  p.foundation.title = h.foundationTitle;
  p.foundation.topics = h.foundationTopics;
  p.foundation.note = h.foundationNote;
  p.formatAlternatives = {
    transcript: h.formats.transcript,
    summary: h.formats.summary,
    listen: h.formats.listen,
  };
  p.lessons = p.lessons.map((l) => {
    const t = HI.lessons[l.id];
    if (!t) throw new Error('Missing Hindi lesson ' + l.id);
    const o = clone(l);
    o.title = t.title;
    o.objective = t.objective;
    o.lessonText = t.lessonText;
    o.steps = t.steps;
    o.reflectionPrompt = t.reflectionPrompt;
    o.returnToWorkAction = t.returnToWorkAction;
    o.summary = t.summary;
    if (t.quiz.length !== o.quiz.length) throw new Error('Quiz size mismatch ' + l.id);
    o.quiz = o.quiz.map((q, i) => {
      const tq = t.quiz[i];
      if (l.module === 'suitable-unsuitable-use') {
        // Scenario items: same four classes in the same order as the English item, so the correct index cannot drift.
        const options = q.options.map((x) => {
          if (!HI.classLabels[x]) throw new Error('No Hindi label for ' + x);
          return HI.classLabels[x];
        });
        return {
          id: q.id,
          question: `${HI.classifyPrefix} ${tq.question}`,
          options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: tq.explanation,
        };
      }
      if (tq.options.length !== 4 || tq.correctOptionIndex !== q.correctOptionIndex)
        throw new Error('Hindi quiz must keep the same correct index ' + l.id + ' ' + i);
      return {
        id: q.id,
        question: tq.question,
        options: tq.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: tq.explanation,
      };
    });
    o.transcript = transcript(o, HI.transcriptWords);
    o.audio = { status: 'not-recorded', label: 'Audio not recorded yet', note: HI.audioNote };
    return o;
  });
  return {
    schemaVersion: base.schemaVersion,
    contentVersion: HI_VERSION,
    product: base.product,
    status: `${HI_LABEL} · ${STATUS}`,
    language: 'hi',
    audience: base.audience,
    editionNotes: [
      HI_LABEL + '. Edition 0.2-review-draft (English) is the source. Only the farm pathway exists in Hindi.',
      HI.notice,
      'A learner who already started this pathway in another edition stays on that edition. Hindi is never substituted silently.',
    ],
    designNotes: base.designNotes,
    assessmentPolicy: base.assessmentPolicy,
    pathways: [p],
  };
}

const sha = (b) => createHash('sha256').update(b).digest('hex');
const write = (name, data) => {
  const text = JSON.stringify(data, null, 2) + '\n';
  const bytes = Buffer.from(text, 'utf8');
  writeFileSync(v(name), bytes);
  const pathwayBytes = data.pathways.map((p) => [p.id, Buffer.byteLength(JSON.stringify(p))]);
  // The 64 KiB limit applies to private authoring copies. The English edition must stay copyable; the Hindi draft is not offered for copying.
  if (data.language === 'en')
    for (const [id, size] of pathwayBytes)
      if (size > 65_536) throw new Error(`${id} exceeds the 64 KiB pathway document limit: ${size}`);
  return { name, bytes: bytes.length, sha256: sha(bytes), pathwayBytes: Object.fromEntries(pathwayBytes) };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const en = buildEnglish();
  const out = [write(EN_VERSION + '.json', en), write(HI_VERSION + '.json', buildHindi(en))];
  console.log(JSON.stringify(out, null, 2));
}
