/**
 * Minimal YAML Parser — AI Narrator Game
 * 
 * Extracted from settings-loader.ts for maintainability (QUAL-1 fix).
 * Supports: scalars (strings, numbers, booleans, null), nested objects,
 * arrays (dash lists), and comments (#).
 * 
 * Does NOT support: multi-line strings, anchors/aliases, tags, flow-style maps.
 * This is sufficient for game setting configuration files.
 * 
 * @module systems/settings/yaml-parser
 */

/**
 * Parse YAML string into a plain JS value (object / array / scalar / null).
 * 
 * @param input - Raw YAML content string
 * @returns Parsed value (Record<string, unknown>, unknown[], string, number, boolean, or null)
 * @throws {Error} if YAML is malformed
 */
export function parseYAML(input: string): unknown {
  const lines = input.split('\n');
  const rootLines = stripComments(lines);
  const result = parseBlock(rootLines, 0);
  return result.value;
}

// ============================================================
// Internal types
// ============================================================

interface ParseBlockResult {
  value: unknown;
  consumed: number;
}

// ============================================================
// Core parsing functions
// ============================================================

function parseBlock(lines: string[], startIndex: number): ParseBlockResult {
  // Skip empty lines and comments
  let idx = startIndex;
  while (idx < lines.length) {
    const line = lines[idx]!;
    if (line.trim() !== '' && !line.trimStart().startsWith('#')) break;
    idx++;
  }

  if (idx >= lines.length) {
    return { value: null, consumed: idx - startIndex };
  }

  const firstLine = lines[idx]!;
  const firstIndent = getIndent(firstLine);

  // Check if it's a dash-list item
  if (isListItem(firstLine)) {
    const result = parseList(lines, idx, firstIndent);
    return { value: result.value, consumed: (idx - startIndex) + result.consumed };
  }

  // Check if it's a key: value pair
  const kvMatch = firstLine.match(/^(\s*)([^:]+?):\s*(.*)$/);
  if (kvMatch) {
    const result = parseMapping(lines, idx, firstIndent);
    return { value: result.value, consumed: (idx - startIndex) + result.consumed };
  }

  // Scalar value at root (just a string)
  return { value: firstLine.trim(), consumed: (idx - startIndex) + 1 };
}

function parseMapping(
  lines: string[],
  startIndex: number,
  parentIndent: number
): ParseBlockResult {
  const result: Record<string, unknown> = {};
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i]!;
    const indent = getIndent(line);

    // Break only when indent is less than parent (exited this mapping scope)
    if (indent < parentIndent) {
      break;
    }

    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    if (indent !== parentIndent) {
      i++;
      continue;
    }

    if (isListItem(line)) {
      break;
    }

    const kvMatch = line.match(/^(\s*)([^:]+?):\s*(.*)$/);
    if (!kvMatch) {
      break;
    }

    const key = kvMatch[2]!.trim();
    const valueStr = kvMatch[3]!.trim();

    if (valueStr === '' || valueStr === '|' || valueStr === '>') {
      // Value is on next line(s) or block scalar
      if (i + 1 < lines.length && getIndent(lines[i + 1]!) > indent) {
        if (i + 1 < lines.length && isListItem(lines[i + 1]!)) {
          const subResult = parseList(lines, i + 1, getIndent(lines[i + 1]!));
          result[key] = subResult.value;
          i = startIndex + 1 + subResult.consumed + (i - startIndex);
          i = i + 1 + subResult.consumed - 1;
        } else {
          const subResult = parseBlock(lines, i + 1);
          result[key] = subResult.value;
          i = i + subResult.consumed;
        }
      } else {
        result[key] = '';
      }
    } else if (valueStr === '[]') {
      result[key] = [];
    } else if (valueStr === '{}') {
      result[key] = {};
    } else if (valueStr === 'null' || valueStr === '~') {
      result[key] = null;
    } else if (valueStr === 'true') {
      result[key] = true;
    } else if (valueStr === 'false') {
      result[key] = false;
    } else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
      result[key] = valueStr.includes('.') ? parseFloat(valueStr) : parseInt(valueStr, 10);
    } else {
      let unquoted = valueStr;
      if (
        (unquoted.startsWith('"') && unquoted.endsWith('"')) ||
        (unquoted.startsWith("'") && unquoted.endsWith("'"))
      ) {
        unquoted = unquoted.slice(1, -1);
      }
      result[key] = unquoted;
    }

    i++;
  }

  return { value: result, consumed: i - startIndex };
}

function parseList(
  lines: string[],
  startIndex: number,
  parentIndent: number
): ParseBlockResult {
  const result: unknown[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i]!;
    const indent = getIndent(line);

    if (line.trim() === '' || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    if (indent < parentIndent) {
      break;
    }

    if (!isListItem(line) || indent !== parentIndent) {
      break;
    }

    const valuePart = line.replace(/^\s*-\s*/, '').trim();

    if (valuePart === '' || valuePart.startsWith('#')) {
      if (i + 1 < lines.length && getIndent(lines[i + 1]!) > parentIndent) {
        const subResult = parseBlock(lines, i + 1);
        result.push(subResult.value);
        i = i + 1 + subResult.consumed;
      } else {
        result.push(null);
        i++;
      }
    } else if (!valuePart.includes(':') || isQuotedScalar(valuePart)) {
      result.push(parseScalar(valuePart));
      i++;
    } else {
      const colonIdx = findFirstUnquotedColon(valuePart);
      if (colonIdx < 0) { i++; continue; }

      const key = valuePart.substring(0, colonIdx).trim();
      const afterColon = valuePart.substring(colonIdx + 1).trim();

      const obj: Record<string, unknown> = {};

      if (afterColon !== '') {
        obj[key] = parseScalar(afterColon);
      } else {
        obj[key] = null;
      }

      if (i + 1 < lines.length && getIndent(lines[i + 1]!) > parentIndent) {
        const nestedIndent = getIndent(lines[i + 1]!);
        const subResult = parseMapping(lines, i + 1, nestedIndent);
        if (subResult.value && typeof subResult.value === 'object' && !Array.isArray(subResult.value)) {
          Object.assign(obj, subResult.value as Record<string, unknown>);
        }
        i = i + 1 + subResult.consumed;
      } else {
        i++;
      }

      result.push(obj);
    }
  }

  return { value: result, consumed: i - startIndex };
}

// ============================================================
// Utility helpers
// ============================================================

function isListItem(line: string): boolean {
  return /^\s*-\s/.test(line.trimStart());
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1]!.length : 0;
}

function isQuotedScalar(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function findFirstUnquotedColon(value: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) return i;
  }
  return -1;
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
  }
  let unquoted = trimmed;
  if (
    (unquoted.startsWith('"') && unquoted.endsWith('"')) ||
    (unquoted.startsWith("'") && unquoted.endsWith("'"))
  ) {
    unquoted = unquoted.slice(1, -1);
  }
  return unquoted;
}

function stripComments(lines: string[]): string[] {
  return lines
    .filter((line) => !line.trimStart().startsWith('#'))
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === '#' && !inSingle && !inDouble) {
          return line.substring(0, i);
        }
      }
      return line;
    });
}
