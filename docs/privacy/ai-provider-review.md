# AI provider review (AIA-ACADEMY-01 v1.0): Anthropic API for the practice-loop coach

Owner: Nakul Jain. Written by Claude on 13 October 2026 under authority the owner delegated in chat the same day. Status: **assessment, not legal advice** (Claude is not a lawyer; a lawyer has not reviewed it). It closes finding F-08 for the textile pilot on the conditions below and is the basis for the decisions `ai.enabled`, `ai.files_to_provider` and the AI paragraph of `notice-v1.0.md`. Update when the provider, model or terms change.

## What is sent, and what is not

| Data | Sent to the provider? | Where set |
| --- | --- | --- |
| Learner's question to the coach, the current task text, the coaching system prompt | Yes | `lib/loop/ai.ts` |
| Learner's uploaded work files | **No** (`ai.files_to_provider` = not allowed) | `lib/loop/practice.ts` |
| Learner's name, email, phone, organisation | No (the request carries no identity; the rate limit and audit are keyed on our side) | `lib/ai/provider.ts`, `lib/loop/ai.ts` |
| Voice recordings | No (voice is out of scope for R1; `speech.provider` undecided) | `lib/loop/voice.ts` |

Learners are told this in the notice: questions go to the provider, files do not, nothing trains models.

## Provider terms relied on

| Point | What the source says | Source (opened 13 Oct 2026) |
| --- | --- | --- |
| Training | "Anthropic may not train models on Customer Content from Services"; Customer Content covers inputs and outputs | [Anthropic Commercial Terms of Service, effective 17 June 2025](https://www.anthropic.com/legal/commercial-terms), section B |
| Data processing agreement | "Data submitted through the Services will be processed in accordance with the Anthropic Data Processing Addendum", incorporated into the terms by reference | Same, sections C and M.9 |
| Retention | API inputs and outputs are deleted "within 30 days of receipt or generation"; a zero-data-retention agreement can shorten this; content flagged by trust-and-safety systems may be kept up to 2 years | [Anthropic privacy centre, "How long do you store personal data?", updated 1 July 2026](https://privacy.claude.com/en/articles/7996866) |
| Processing location | Outside India (United States cloud regions) [Likely: Anthropic is a US company and the DPA's sub-processor list, not opened here, names its cloud providers; confirm from the DPA before a non-textile organisation signs] | DPA, to be read by the owner or lawyer |

## Indian law

- Section 16 of the Digital Personal Data Protection Act 2023: the Central Government "may, by notification, restrict the transfer of personal data by a Data Fiduciary for processing to such country or territory outside India as may be so notified" ([text](https://dpdpa.com/dpdpa2023/chapter-4/section16.html)). Transfers are allowed unless a country is restricted.
- Rule 15 of the DPDP Rules 2025 keeps that model: "A Data Fiduciary may transfer personal data outside India except where the Central Government restricts such transfer." As of the source's update of 31 July 2026, "no countries or sectors have yet been restricted", and the cross-border provisions commence eighteen months after the notification of 13 November 2025 ([King Stubb & Kasiva summary](https://ksandk.com/data-protection-and-data-privacy/indias-new-cross-border-data-transfer-framework/)).
- Conclusion [Likely]: sending adult learners' coaching questions to a US provider under a DPA, with notice, no training and 30-day deletion, is permitted today and remains permitted unless the United States is notified as restricted. Children's data is different (verifiable parental consent, section 9) and stays out: R1 is adults only, and the student pilot (R3) is gated separately.

## Conditions on which F-08 is closed for the textile pilot

1. Provider `anthropic`, model recorded explicitly in the server environment (`ACADEMY_AI_MODEL`); never defaulted in code.
2. Files never sent (`ai.files_to_provider.allowed = false`). Reopen only after a lawyer reads the DPA.
3. The coach serves real learners only after the evaluation set passes the thresholds in `ai.thresholds` (hint-first 1.00, refusal 1.00, uncertainty 0.90, overall 0.90) on the recorded model (ACA-US-7.2). A failed run can never be passed by lowering thresholds.
4. The owner's kill switch (`ai.enabled`) and the server switch (`ACADEMY_AI_PROVIDER=off`) both stop the coach at once.
5. Request a zero-data-retention agreement from Anthropic before any organisation that handles customer data (pharma, finance) joins; the textile pilot proceeds on the 30-day default.

## Residual risk accepted under delegation

- The lawyer has not read the DPA or this note. Risk: a term (sub-processor location, liability) that a lawyer would want changed. Impact for the textile pilot is low: adults, work questions, no files, 30-day deletion, notice given. Owner can reverse by recording `ai.enabled = {"enabled": false}`.
- Trust-and-safety retention of flagged content for up to 2 years is outside our control; the notice states it.
