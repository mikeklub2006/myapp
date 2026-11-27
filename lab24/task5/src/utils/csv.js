function csvValue(value) {
  if (value === undefined || value === null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvValue(row[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

// простой разбор csv с поддержкой кавычек
function parseLine(line) {
  const result = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = parseLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = {};
    header.forEach((h, i) => {
      if (values[i] !== undefined && values[i] !== '') row[h] = values[i];
    });
    return row;
  });
}

module.exports = { toCsv, parseCsv };
