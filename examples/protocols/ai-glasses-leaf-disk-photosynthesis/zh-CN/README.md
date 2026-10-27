# Leaf Disk Assay: Glasses Guidance Test Guide

[Open the protocol](./protocol.aimd). Chinese-language, 19 steps; three rounds take approximately 120–150 minutes. Each round has L/W/D cups with 10 disks each. Rehearse with empty cups first; wet-lab use requires safety review and pilot testing of leaves and illumination. References and adapted parameters are documented in the protocol.

## Interaction Scenarios

| Scenario | Rehearsal | Expected behavior |
| --- | --- | --- |
| Cup identity | Swap empty L1/W1 cups | Verify labels rather than infer identity from position |
| Timed repetition | Simulate infiltration cycles | Announce hold/release and stop for review after five unsuccessful cycles |
| Parallel tasks | Use paper disks for L/W with a covered D cup | Prompt cup and time separately without opening D every minute |
| Overlap and glare | Obscure paper disks in a transparent cup | Request confirmation, accept a count correction, and retain its trace |
| Missed observation | Skip a simulated minute | Preserve missingness rather than insert zero or invent a smooth series |
| Pause and resume | Pause the interface while an independent clock runs | Preserve real elapsed time instead of restarting the biological clock |
| ET50 not reached | Supply a series that never reaches 5/10 | Record not reached, leave bounds empty, and do not substitute zero or 30 minutes |
| Disturbed control | Simulate opening D with an event entry | Retain the terminal observation as disturbed; do not calculate D's ET50 |

Inject faults only with empty cups, paper disks, or synthetic records. Do not create electrical/liquid hazards or force a syringe. Do not merge synthetic counts into experimental records.

## Data And Integration

- `cup_setup`, `observations`, `endpoints`, and `et50_results` join on unique `cup_id`; `round_no` identifies repeats. Disks within a cup are not independent replicates.
- Observation `elapsed_s` starts at the current round; guidance-event `elapsed_s` starts at the whole run. Host synchronization must preserve this distinction.
- The UI sums declared timers without multiplying the 30-minute window by repeated rounds. Use the overall 120–150-minute estimate for scheduling.
- L/W have repeated observations; D has an initial check and terminal observation only. ET50 intervals, missingness, not-applicable states, unreliable estimates, and zero are distinct.
- Humans or the host must check cup identity, round completeness, time order, and scientific QC across tables; individual field constraints are insufficient.
- Use explicit `null` for unfilled nullable fields and retain those keys for generated Python model validation. An incomplete draft is not a validated formal record.
- Vision counting, voice control, scheduled reminders, and evidence capture are future host capabilities. Manual Recorder entry works without Engine; no mock hardware endpoint or automatic analysis is included.

Software checks do not validate a wet-lab method. Supervised glasses acceptance testing should assess cup-identification errors, count error, missed-observation alerts, correction success, recovery clock error, and original evidence.
