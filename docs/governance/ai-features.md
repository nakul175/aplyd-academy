# AI feature documentation: model card, evaluation, limits (item 26)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when any AI call, key or generated content is added. Agent-drafted; not reviewed by a person.

## Status: no AI feature is implemented or enabled

- README: "no AI service is called" and "embedded AI remain unimplemented".
- Handoff: live AI work "is gated on the user's credential choice under the API-key workflow; no usable key or decision was supplied and no provider-backed feature was built." That gate is pending and must not be bypassed. Paid AI stays disabled.
- No AI provider key, SDK or URL exists in the dependency list or `app/`/`lib/` (searched for provider hostnames and SDK names on 2026-10-08: no matches).

## What is "AI" in the product today

Learners practise on **fictional source packets** and **check supplied AI drafts**: the AI-written drafts are static, authored teaching text in the curriculum (three pinned draft pathways, nine lessons, 27 checks). The "sample" reviewers and staff in the personal lab are teaching fixtures. The practical rule taught: AI help is a draft to be checked against sources; unsupported claims fail critical gates in the rubrics. Browser read-aloud and local voice use the learner's browser facilities (`app/academy-inclusive-learning.tsx`), not an Academy model.

## Model card (placeholder)

| Field | Value |
|---|---|
| Model / provider | none |
| Intended use | n/a |
| Training data | n/a |
| Evaluation | none; nothing to evaluate |
| Known limits | n/a |

## Requirements before any AI feature ships (proposed, from the design and handoff)

1. Owner decision on provider and credential handling; the key lives only in a secrets store, never in Git (secrets-register.md).
2. Synthetic or consented exercise content only; learner work must not go to a provider without explicit instruction (design threat TH-15 in security-and-privacy.md).
3. AI output labelled as AI, never used as an assessment decision; decisions stay with an assigned human assessor (access-control-model.md).
4. Evaluation plan with accuracy, harmful-content, language (Hindi, English) and bias checks on representative farmer, MSME and public-service tasks; recorded here before enabling.
5. Update privacy-ropa-dpia.md (new processor, cross-border transfer) and threat-model.md.
6. Cost and abuse limits; a kill switch.

All of the above: TBD (owner: Nakul Jain).
