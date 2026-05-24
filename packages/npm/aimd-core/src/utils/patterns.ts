/**
 * AIMD Regex Patterns
 *
 * Patterns for extracting AIMD fields from markdown templates.
 */

/**
 * Pattern for escaped protocol fields in markdown
 * Matches: {{var|name}}, {{step|name}}, {{var_table|name, subvars=[...]}}, etc.
 */
export const ESCAPED_PROTOCOL_FIELDS = /\{\{(var_table|var|step|check|r[rq]|ref_step|rv_ref)\\?\|([^}]+)\}\}/g

/** Pattern to extract subvars from var_table definition: subvars=[col1, col2, col3] */
export const DYNAMIC_TABLE_SUB_VAR = /([^",]+)=\[(?<vars>[^"]+)\]/g

/** Pattern to extract table link: table_link="source.prop -> target.prop" */
export const DYNAMIC_TABLE_LINK = /table_link\s*=\s*"(?<target>\S*)\s*->\s*(?<source>\S*)"/
