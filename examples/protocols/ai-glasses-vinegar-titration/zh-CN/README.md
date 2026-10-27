# Vinegar Titration: Glasses Guidance Test Guide

[Open the protocol](./protocol.aimd). Chinese-language, 18 steps, approximately 75–100 minutes. It measures transparent vinegar's total titratable acidity using pre-standardized dilute NaOH. Rehearse with water first; wet-lab use needs laboratory approval. Method references and adaptation limits are included in the protocol.

## Interaction Scenarios

| Scenario | Rehearsal | Expected behavior |
| --- | --- | --- |
| Sequence and missed checks | Request the next action before confirming funnel removal, using empty equipment | Identify the pending check without inventing confirmation |
| Numbers and units | A printed 1.25 mL scale card is transcribed as 12.5 mL | Read back value and unit, accept correction, and retain the event |
| Visual uncertainty | Obscure the tip or scale card | Request a clearer observation rather than infer success |
| Endpoint timing | Simulate fading pink with prepared color cards | Ask for human assessment and restart the 30-second check |
| Pause and resume | Pause a water-only trial | Close the valve first; verify flask, table row, and reading before resuming |
| Invalid trial | Enter a simulated overshoot or bubble event | Preserve the original row and reason, then start a new trial |
| Failed QC | Enter simulated nonconcordant trials | Do not substitute a plausible mean for QC or selectively remove values |

Inject faults only with water, empty equipment, or synthetic records. Never deliberately defeat protection, mislabel real reagents, or cause leaks. Keep rehearsal records separate from measurements.

## Data And Integration

- Stable step IDs locate instructions; `trial_id` distinguishes repeated trials, not checkbox toggles.
- The UI duration sum covers only declared timed actions, not untimed work or repeat loops. Plan using the protocol's overall 75–100-minute estimate.
- `titrations` stores raw readings, volume, endpoint, and inclusion decisions. `guidance_events` stores elapsed run time, step ID, issue, and recovery position.
- The host manages consent-based image/video capture. Evidence IDs can be entered in event descriptions; this example neither records nor uploads media automatically.
- Recorder supplies manual entry, timers, checks, and draft saving. Voice, vision, automatic navigation, enforced gates, and cross-field scientific QC require host implementation. Type checks do not validate an SOP.
- There is no Assigner or automatic result calculation. The worked formula example is not a measurement; measured values, pass decisions, and checkpoints are not prefilled.
- Represent unfilled nullable fields as explicit `null`. Do not omit their keys when validating with the generated Python model; drafts may be incomplete, while the host normalizes and validates formal records.

Software tests verify loading, parsing, fields, and constraints, not titration accuracy, recognition performance, or wet-lab reproducibility. Separately assess completion rate, false/missed detections, corrections, recovery accuracy, and evidence in supervised trials.
