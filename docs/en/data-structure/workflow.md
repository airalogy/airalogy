# Workflow Data Structure

## Data Structure of a Path Completed After Research Based on a Workflow

In an Airalogy Protocol, because a Workflow is defined in the `workflow` template, its related data should be stored in the `workflow` field:

```json
{
    "airalogy_record_id": "...",
    "record_id": "...",
    "version": 1,
    "metadata": {
        // ...
    },
    "data": {
        "workflow": {
            "<workflow_id>": { // <workflow_id> is the ID of the Workflow
                // <workflow_data> is the data produced by applying the Workflow
            }
        }
    }
}
```

The data structure of `<workflow_data>` is as follows. Note that this structure is fully compatible with the AIRA Method.

```json
{
    "protocols_info": [ // Stores information for all Protocols involved in the Workflow
        { // Stored as an object so the AI system can auto fetch Protocol info by `protocol_id` and embed it for analysis
            "protocol_index": 0, // Identifies the position of this Protocol in the Workflow
            "protocol_id": "...",
            "protocol_version": "...", // Auto fetch Protocol version info to ensure stability
            "airalogy_protocol_id": "...", // If using the Workflow on the Airalogy platform, this records the unique Airalogy Protocol ID; if local, this field can be null
            "protocol_data": { // Stores data of this Protocol. Same structure as Protocol data
                "markdown": "...",
                "model": "...", // null if none
                "assigner": "...", // null if none
                "field_json_schema": {
                    // ...
                },
            }
        },
        {
            "protocol_index": 2,
            "protocol_id": "...",
            "protocol_version": "...",
            "airalogy_protocol_id": "...", // If using the Workflow on the Airalogy platform, this records the unique Airalogy Protocol ID; if local, this field can be null
            "protocol_data": { // Stores data of this Protocol. Same structure as Protocol data
                "markdown": "...",
                "model": "...", // null if none
                "assigner": "...", // null if none
                "field_json_schema": {
                    // ...
                },
            }
        },
        // And so on, you can list all Protocols involved in the Workflow and the Airalogy Protocol used for each application
    ],
    "path_data": { // Each Workflow application produces a Path. The Path data is the Workflow application data.
        "path_status": "completed",
        // Since a Workflow can be paused or resumed, we need a field to record the current Path status so the system knows the last state.
        // This field also controls AI behavior by telling the AI which process to run. The statuses are:
        //
        // - `completed`: the user completed the Workflow
        // - `waiting_for_research_goal`: waiting for the user to fill the research purpose (Research Purpose, RG)
        // - `waiting_for_research_strategy`: waiting for the user to fill the research strategy (Research Strategy, RS). In this state, AI can auto generate the strategy.
        // - `end_after_generating_research_strategy`: occurs only after AI auto generates a research strategy. Ending indicates the research purpose is not researchable based on the generated strategy.
        // - `waiting_for_next_protocol`: waiting for the user to select the next Protocol
        // - `end_after_selecting_next_protocol`: occurs only after AI auto selects the next Protocol. Ending indicates the next unit is an End node.
        // - `waiting_for_initial_values_for_fields_in_next_protocol`: waiting for AI to generate initial values for the next Protocol, usually initial experimental conditions
        // - `waiting_for_record`: after the next Protocol is determined, waiting for the user to perform research and obtain its Record
        // - `waiting_for_phased_research_conclusion`: waiting for the user summary or AI generation of the research conclusions up to the current Protocol for further analysis or strategy adjustment
        // - `waiting_for_final_research_conclusion`: waiting for the user summary or AI generation of the final research conclusion for the whole Path

        "steps": [
            // Stores all Protocol application data for this Path. We design it as a list and separate step types because:
            // 1. it supports an unlimited-length Path; 2. it is easier for AI design. The AI's goal becomes to always generate the next list element.
            // Also, if we need to extend the AIAR process and insert other intermediates, it is easy to extend.

            // Each step is an object with these fields:
            // - `step`: identifies the step type. Types are verb phrases for clarity.
            // - `path_index`: identifies the position of the step in the Path
            // - `mode`: `ai` / `user`
            // - `data`: data for the current node. To keep data consistent, this value is always an object.

            {
                "step": "add_research_goal",
                "path_index": 0, // 0 means this step is in the preparation phase of the Path
                "mode": "user", // Can be `ai` or `user`. If AI generates it, this is `ai`; if the user fills it, this is `user`.
                "data": {
                    "thought": "...", // Reserved for the AI to think before making a decision. If the user fills it directly, this is null.
                    "goal": "..." // User-entered or AI-generated research goal
                }
            },
            {
                "step": "add_research_strategy",
                "path_index": 0,
                "mode": "ai", // ai / user. If AI judged researchable and generated RS but the user modified it, this is `user`; if AI generated RS and the user did not modify it, this is `ai`.
                "data": {
                    "thought": "...", // Reserved for the AI to think before making a decision. If the user fills it directly, this is null.
                    "researchable": true, // Before generating RS, check whether the RG is researchable in this Workflow. If not, do not generate RS. In the UI there are 3 choices: not confirmed, researchable, not researchable, corresponding to null, true, false. If the user neither clicked AI recommendation nor selected manually, the default is null.
                    "strategy": "..." // User-entered or AI-generated RS
                }
            }
            {
                "step": "add_next_protocol", // Named `add_next_protocol` because whether AI recommends or the user selects, the meaning of "add" applies.
                "path_index": 1, // Identifies the position of this step in the Path. 1 means the stage related to the first Protocol in the Path.
                "mode": "ai", // Indicates whether the current Protocol is recommended by AI or chosen by the user. `ai` and `user` are fixed values. If AI recommends, this is `ai`; if the user modifies the AI recommendation, this is `user`. Each step with mode `user` can be treated as an RLHF supervision signal.
                "data": {
                    "thought": "...", // Reserved for the AI to think before making a decision. If the user selects directly, this is null.
                    "end_path": false,
                    "protocol_index": 0 // Identifies the index of the next Protocol
                }
            },
            {
                "step": "add_initial_values_for_fields_in_next_protocol",
                "path_index": 1,
                "mode": "ai", // If AI generates it and the user does not modify it, this is `ai`; if the user modifies it, this is `user`.
                "data": {
                    "thought": "...",
                    "values": {
                        "field_a": "...",
                        "field_b": "...",
                        // ...
                    }
                }
            },
            {
                "step": "record_protocol",
                "path_index": 1,
                "mode": "user", // Currently only `user`, because the user must perform the research to obtain the Record. In the future we may extend to an `auto` mode that obtains Records automatically.
                "data": {
                    "protocol_index": 0, // Identifies the position of this Protocol in the Workflow
                    "record_id": "01234567-0123-0123-0123-0123456789ab", // Record ID produced by the user for this Protocol. This Record ID is globally unique and identifies a Record.
                    "record_version": 2, // Record version produced by the user for this Protocol. The first submission is 1; it increments on each update.
                    "airalogy_record_id": "airalogy.id.record...", // Identifies the current Record ID. Airalogy Record ID is globally unique and identifies a Record.

                    // Note that in Workflow data, we do not store Record data again; we only reference the Record ID. This is because Record data is stored in its Protocol, so referencing the ID is enough. This reduces redundancy and improves consistency.
                    // If the Record ID data in the corresponding Protocol is deleted, this reference becomes invalid and shows as empty. Our design is that when a Record is deleted, its Record ID is also deleted to ensure consistency. Therefore, when a user is about to delete a Record, the system prompts the user to confirm whether to delete the Record ID as well.

                    // On the Airalogy platform, when using the AIRA Method, data is loaded by ID.
                }
            },
            {
                "step": "add_phased_research_conclusion", // Named `add_phased_research_conclusion` rather than `generate_phased_research_conclusion` because in a real Path, a phased research conclusion can be written by the user or generated by AI. This step appears regardless.
                "path_index": 1,
                "mode": "ai", // If AI generates it and the user does not modify it, this is `ai`; if the user modifies it, this is `user`; if the user fills it directly, this is `user`.
                "data": {
                    // Summarizes research conclusions up to the current node
                    "conclusion": "..."
                }
            },
            // add_next_protocol
            // add_initial_values_for_fields_in_next_protocol
            // * record_protocol
            // add_phased_research_conclusion
            // add_next_protocol
            // add_initial_values_for_fields_in_next_protocol
            // * record_protocol
            // add_phased_research_conclusion
            // ... Repeat the steps above until the user completes the Path. Note that `*` indicates the step is always required (because a Workflow is a continuous application of Protocols, which produces Records), while other steps depend on user actions.
            {
                "step": "add_next_protocol",
                "path_index": 100, // Identifies the position of this step in the Path. 100 means it is in the 100th Protocol-related stage.
                "mode": "ai",
                "data": {
                    "thought": "...",
                    "end_path": true, // When `end_path` is true, the Path ends
                    "protocol_index": null
                }
            },
            {
                "step": "add_final_research_conclusion", // Named `add_final_research_conclusion` rather than `generate_final_research_conclusion` because in a real Path, the final research conclusion can be written by the user or generated by AI. This step appears regardless. Note that when this step appears, `path_status` must be `completed`.
                "path_index": 100, // Always the same as the `path_index` of the END-state `add_next_protocol`
                "mode": "ai", // If AI generates it and the user does not modify it, this is `ai`; if the user modifies it, this is `user`; if the user fills it directly, this is `user`.
                "data": {
                    // Summarizes the final research conclusion of the entire Path
                    "conclusion": "..."
                }
            }
        ]
    }
}
```
