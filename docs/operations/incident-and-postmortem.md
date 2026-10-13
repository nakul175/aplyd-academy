# Incidents and postmortems

**An incident** is anything that stops learners practising, exposes or risks exposing personal data, or makes the AI give harmful or wrong guidance.

1. **Contain.** AI problem: switch AI off (runbook). Data exposure: take the site down (`sudo systemctl stop academy`) if exposure continues. Release problem: `release.sh` rolls back automatically; otherwise deploy the previous release.
2. **Record.** AI incidents in Operations (time, effect, action). Others in Linear with the label `incident`.
3. **Tell.** Nakul Jain at once. Personal data breach: the owner decides on notifying the Data Protection Board and affected people under the DPDP Rules (time limits apply; legal review pending).
4. **Postmortem** within 5 working days, blameless, using the template below; actions become Linear issues.

## Postmortem template

- Summary (two sentences)
- Impact: who, how many, how long, what data
- Timeline (IST)
- Root cause and contributing factors
- What went well, what did not
- Actions (owner, Linear issue, due date)
