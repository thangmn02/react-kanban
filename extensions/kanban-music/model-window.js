// The fully convolutional network accepts multiples of 64 time frames. Remove
// export-time intermediate shapes and resize only its input/output metadata.
// Weights/operators stay byte-for-byte unchanged; callers verify the hash first.
function varint(bytes, at) {
  let value = 0, shift = 0;
  while (at < bytes.length && shift < 35) {
    const byte = bytes[at++]; value += (byte & 127) * 2 ** shift;
    if (!(byte & 128)) return { value, at };
    shift += 7;
  }
  throw new Error('Invalid model protobuf');
}
function encode(value) {
  const bytes = [];
  do { const next = value % 128; value = Math.floor(value / 128); bytes.push(next | (value ? 128 : 0)); } while (value);
  return Uint8Array.from(bytes);
}
function fields(bytes) {
  const result = [];
  let at = 0;
  while (at < bytes.length) {
    const start = at, tag = varint(bytes, at); at = tag.at;
    const wire = tag.value & 7, number = Math.floor(tag.value / 8);
    let payload = at, end;
    if (wire === 2) { const length = varint(bytes, at); payload = length.at; end = payload + length.value; }
    else if (wire === 0) end = varint(bytes, at).at;
    else if (wire === 1) end = at + 8;
    else if (wire === 5) end = at + 4;
    else throw new Error('Unsupported model protobuf');
    if (end > bytes.length) throw new Error('Truncated model');
    result.push({ number, wire, start, payload, end }); at = end;
  }
  return result;
}
function join(parts) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}
function replace(bytes, field, payload) {
  return join([bytes.subarray(field.start, field.payload - encode(field.end - field.payload).length), encode(payload.length), payload]);
}
function resizeTensor(bytes, frames) {
  const path = [2, 1, 2]; // ValueInfo.type -> Type.tensor_type -> TensorType.shape
  const descend = (data, depth) => {
    const parts = [];
    let dimension = 0, changed = 0;
    for (const field of fields(data)) {
      if (depth < path.length && field.number === path[depth]) {
        const next = descend(data.subarray(field.payload, field.end), depth + 1);
        parts.push(replace(data, field, next)); changed++;
      } else if (depth === path.length && field.number === 1 && dimension++ === 2) {
        const dim = data.subarray(field.payload, field.end);
        const value = fields(dim).find((entry) => entry.number === 1 && entry.wire === 0);
        if (!value || varint(dim, value.payload).value !== 512) throw new Error('Unexpected model time shape');
        parts.push(replace(data, field, join([dim.subarray(0, value.payload), encode(frames), dim.subarray(value.end)]))); changed++;
      } else parts.push(data.subarray(field.start, field.end));
    }
    if (changed !== 1) throw new Error('Unexpected model tensor');
    return join(parts);
  };
  return descend(bytes, 0);
}
export function resizeModelWindow(bytes, frames = 128) {
  if (![64, 128, 256, 512].includes(frames)) throw new Error('Invalid model window');
  let graphs = 0;
  const parts = fields(bytes).map((field) => {
    if (field.number !== 7) return bytes.subarray(field.start, field.end);
    graphs++;
    const graph = bytes.subarray(field.payload, field.end);
    let tensors = 0;
    const entries = fields(graph).flatMap((entry) => {
      if (entry.number === 13) return []; // Graph.value_info (export-time examples)
      if (entry.number !== 11 && entry.number !== 12) return [graph.subarray(entry.start, entry.end)];
      tensors++;
      return [replace(graph, entry, resizeTensor(graph.subarray(entry.payload, entry.end), frames))];
    });
    if (tensors !== 2) throw new Error('Unexpected model graph');
    return replace(bytes, field, join(entries));
  });
  if (graphs !== 1) throw new Error('Unexpected model');
  return join(parts);
}
