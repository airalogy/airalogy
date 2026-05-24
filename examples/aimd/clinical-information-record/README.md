# Clinical Information Record Case

Entry files: [protocol.en-US.aimd](./protocol.en-US.aimd) / [protocol.zh-CN.aimd](./protocol.zh-CN.aimd)

This bilingual case shows how to structure the core data for one clinical encounter, including patient identifiers, encounter context, chief complaint, history, vital signs, allergies, medications, diagnoses, findings, care plan, follow-up, and review checkpoints.

## Scope

- A reference case for outpatient, emergency, inpatient admission, or follow-up records.
- Intended for trying form-like content in `@airalogy/aimd-recorder`.
- Includes a browser-side `assigner runtime=client` that calculates BMI locally from height and weight.
- Can be adapted by specialty, institution, or local documentation policy.

## Notes

- This is a record structure, not diagnostic, treatment, or triage advice.
- Review it against local medical record, privacy, audit, and signature requirements before production use.
- Do not store real patient identifiers in example files; runtime records should hold real data.
