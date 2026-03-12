function simplify(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    if (value.every(item => typeof item !== 'object' || item === null)) {
      return value.join(', ');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

export function printOutput(data: unknown, json = false) {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('No results.');
      return;
    }
    if (data.every(item => typeof item === 'object' && item !== null)) {
      console.table(
        data.map(item =>
          Object.fromEntries(
            Object.entries(item).map(([key, value]) => [key, simplify(value)]),
          ),
        ),
      );
      return;
    }
  }

  if (typeof data === 'object' && data !== null) {
    console.dir(data, { depth: null, colors: true });
    return;
  }

  console.log(String(data));
}
