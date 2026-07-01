---
"@airalogy/aimd-core": minor
"@airalogy/aimd-recorder": minor
"airalogy": patch
---

Add the built-in `BloodType` protocol field type for common ABO and Rh blood group values.

Generate AIMD built-in type metadata from the Python `airalogy.types` registry, and let `@airalogy/aimd-core` and `@airalogy/aimd-recorder` use official enum metadata so named built-in types such as `BloodType` render as recorder select fields without duplicating enum definitions in npm packages.
