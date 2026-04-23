# Data Structure of Research Data Recorded via an Airalogy Protocol

A research record obtained by recording with an Airalogy Protocol is called an Airalogy Record.

## General Structure

An Airalogy Record is a JSON object that contains the metadata and data of a research record. The general structure of an Airalogy Record is as follows:

```json
{
    "airalogy_record_id": "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.v.2", // If the record is created from a local Protocol, there is no global unique Airalogy Record ID, so this field can be null. When local data is synchronized to the Airalogy platform, if a UUID collision occurs, a new UUID will be generated to replace the original UUID (the `record_id` field below will also be updated). If the record is based on an Protocol within Airalogy platform, this field is the globally unique ID of the record on the Airalogy platform.
    "record_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // An UUID
    "record_version": 2, // Version number of this record. The first submission is 1; it increments on each update.
    "metadata": {
        // metadata of the Record
    },
    "data": {
        // data of the Record
    }
}
```

For the ID design of Airalogy Record / Airalogy Protocol, see [Airalogy ID](id.md).

## Metadata

Metadata includes:

```json
{
    "airalogy_protocol_id": "airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1", // If the record is created from a local Protocol, there is no global unique Airalogy Protocol ID, so this field can be null.
    "protocol_id": "protocol_demo",
    "protocol_version": "0.0.1",
    "record_num": 1,

    // The fields below identify the source of the Airalogy Protocol on the Airalogy Platform
    "lab_id": "lab_demo", // If the record is created from a local Protocol, there is no Lab concept, so this field can be null.
    "project_id": "project_demo", // If the record is created from a local Protocol, there is no Project concept, so this field can be null.

    // The following 4 fields identify version information of the Record
    "record_current_version_submission_time": "2024-01-02T00:00:00+08:00", // Submission time of the current record version
    "record_current_version_submission_user_id": "user_demo_2", // Submitter ID of the current record version
    "record_initial_version_submission_time": "2024-01-01T00:00:00+08:00", // Submission time of the initial record version
    "record_initial_version_submission_user_id": "user_demo_1", // Submitter ID of the initial record version

    // Hash value used to validate record data integrity. We use SHA-1 here, but any hash algorithm (e.g. SHA-256) can be used. In the current Airalogy system, SHA-1 is chosen because it is faster than SHA-256 and better suited for hashing large amounts of data.
    "sha1": "c486349125db2a468172a4449b9e309b0c756c59"
}
```

## Data

In the Airalogy framework, each Record based on an Airalogy Protocol is essentially recording the embedded values under each template in the protocol (i.e. the values of each Airalogy Field). Therefore, we can view a Record as data with a nested structure.

To enable general storage of Record data across different Airalogy Protocols, a Record is stored in JSON. The general structure is as follows (note: the data structure below does not include Record metadata, only data fields):

```jsonc
{
    "template_name_1": {
        // data for template_name_1
    },

    "template_name_2": {
        // data for template_name_2
    }

    // ...
}
```

At the top level of this JSON, each key is always a template name that corresponds to `<template_name>` in the AIMD template. Each value is usually a JSON object. Its data structure depends on the template definition.

Data structures of different templates:

### Variable (`var`)

```jsonc
{
    "var": { // template_name = "var"

        // Var values can be any JSON-supported data type.
        // This object is validated against VarModel. Only data that passes VarModel validation can be saved to the database.

        "var_id_1": "value_1", // string
        "var_id_2": 1, // integer
        "var_id_3": 1.1, // float
        "var_id_4": true, // boolean
        "var_id_5": null, // null

        // Here are some complex data types
        "var_id_7": {
            // object value
        },
        "var_id_6": [
            // array value
        ],

        "datetime": "2024-01-01T00:00:00+08:00",
        "img_airalogy_id": "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png",
        "record_airalogy_id": "airalogy.id.record.yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy.v.1"
        // ...
    }
}
```

### Quiz (`quiz`)

```jsonc
{
    "quiz": { // template_name = "quiz"

        // Quiz values are keyed by quiz id.
        // This object is validated by quiz-definition rules (choice/true_false/scale/blank/open).

        "quiz_choice_single_1": "A", // single choice: option key
        "quiz_choice_multiple_1": ["A", "C"], // multiple choice: list of option keys
        "quiz_true_false_1": false, // true/false: boolean
        "quiz_choice_with_followups_1": { // choice with option followup fields
            "selected": "yes", // single choice uses an option key; multiple choice uses a list of option keys
            "followups": {
                "yes": { // only selected options may have followup values
                    "years": 8,
                    "cigarettes_per_day": 10
                }
            }
        },
        "quiz_scale_1": { // scale: item_key -> selected option key
            "s1": "not_at_all",
            "s2": "more_than_half_the_days"
        },
        "quiz_blank_1": { // blank: blank_key -> user input
            "b1": "21%"
        },
        "quiz_open_1": "Because both temperature and pressure affect this phenomenon." // open: string
    }
}
```

Notes:

- `data.quiz` stores raw user answers only
- when auto-grading is enabled, keep `earned_score`, `status`, `feedback`, and similar output in a separate grade report instead of writing them back into `data.quiz`
- this grade report is usually an independent JSON structure, not necessarily a separate file; it may also appear as a `grade_report` field in the same API response or as a related grading document/table in storage

Example:

```jsonc
{
    "data": {
        "quiz": {
            "quiz_choice_single_1": "A"
        }
    },
    "grade_report": {
        "quiz": {
            "quiz_choice_single_1": {
                "earned_score": 5,
                "max_score": 5,
                "status": "correct"
            }
        },
        "summary": {
            "total_earned_score": 5,
            "total_max_score": 5,
            "review_required_count": 0
        }
    }
}
```

### Step (`step`)

```jsonc
{
    "step": { // template_name = "step"

        "step_id_1": {
            "annotation": "", // The initial annotation value is always an empty string. If the user leaves the annotation box blank, this value is still "".
            "checked": null // When `check` is not enabled in AIMD, this field is null.
        },

        "step_id_2": {
            "annotation": "annotation_2", // When there is a step annotation, this value is the user input.
            "checked": null 
        },

        "step_id_3": {
            "annotation": "",
            "checked": false // If `check` is enabled for the step in AIMD, this defaults to false.
        },

        "step_id_4": {
            "annotation": "",
            "checked": true // If `check` is enabled and the user ticks the checkbox, this value is true.
        },

        // ...

    }
}
```

### Checkpoint (`check`)

```jsonc
{
    "check": { // template_name = "check"

        "check_id_1": {
            "checked": false, // Default is false. The purpose of check is verification, so this is always a boolean and never null.
            "annotation": "" // Default is an empty string.
        },

        "check_id_2": {
            "checked": false,
            "annotation": "annotation_2" // When a check fails, the user can annotate the reason here.
        },
        "check_id_3": {
            "checked": true, // When the user ticks the checkbox, this value is true.
            "annotation": ""
        },
        "check_id_4": {
            "checked": true,
            "annotation": "annotation_4" // Even when the check passes, users can add annotations here.
        }

        // ...
    }
}
```

## Example

When a user tries to download a record, the Airalogy platform returns a JSON object with the following structure:

```json
{
    "airalogy_record_id": "airalogy.id.record.01234567-0123-0123-0123-0123456789ab.v.2",
    "record_id": "01234567-0123-0123-0123-0123456789ab",
    "record_version": 2,
    "metadata": {
        "airalogy_protocol_id": "airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1",
        "lab_id": "lab_demo",
        "project_id": "project_demo",
        "protocol_id": "protocol_demo",
        "protocol_version": "0.0.1",
        "record_num": 1,
        "record_current_version_submission_time": "2024-01-02T00:00:00+08:00",
        "record_current_version_submission_user_id": "user_demo_2",
        "record_initial_version_submission_time": "2024-01-01T00:00:00+08:00",
        "record_initial_version_submission_user_id": "user_demo_1",
        "sha1": "c486349125db2a468172a4449b9e309b0c756c59"
    },
    "data": {
        "var": {
            "solvent_name": "H2O",
            "solvent_volume": 1.0
        },
        "quiz": {
            "quiz_choice_single_1": "A",
            "quiz_blank_1": {
                "b1": "21%"
            }
        },
        "step": {
            "select_solvent": {
                "annotation": "",
                "checked": null
            }
        },
        "check": {
            "check_remaining_volume": {
                "annotation": "",
                "checked": true
            }
        }
    }
}
```

Note:

- For records containing multimodal data, the JSON usually stores IDs for each modality rather than the raw data (to avoid overly large files during transfer). When users download a record, they get a JSON with IDs only. To view the actual data, query the database using those IDs. To download records with concrete data, use the system export feature.
- The `sha1` value is obtained by computing the SHA-1 of the record `data` field using

  ```py
  from airalogy.record.hash import get_data_sha1
  ```
