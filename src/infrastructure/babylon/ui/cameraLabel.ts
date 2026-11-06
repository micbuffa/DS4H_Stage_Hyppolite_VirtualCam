const glyphs = [
  '', '00100 01100 00100 00100 00100 00100 01110', '01110 10001 00001 00010 00100 01000 11111',
  '11110 00001 00001 01110 00001 00001 11110', '00010 00110 01010 10010 11111 00010 00010',
  '11111 10000 10000 11110 00001 00001 11110', '01110 10000 10000 11110 10001 10001 01110',
  '11111 00001 00010 00100 01000 01000 01000', '01110 10001 10001 01110 10001 10001 01110',
  '01110 10001 10001 01111 00001 00001 01110',
];
export function cameraLabel(id: number, selected: boolean): Uint8Array {
  const bytes = new Uint8Array(128 * 64 * 4);
  const color = selected ? [242, 182, 76] : [112, 219, 224];
  const bitmap = ['01111 10000 10000 10000 10000 10000 01111', glyphs[id]].map((glyph) => glyph.split(' '));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const offset = ((63 - y) * 128 + x) * 4;
    const border = x < 3 || x > 124 || y < 3 || y > 60;
    const letter = x < 64 ? 0 : 1;
    const column = Math.floor((x - (letter ? 72 : 24)) / 6);
    const row = Math.floor((y - 11) / 6);
    const filled = column >= 0 && column < 5 && row >= 0 && row < 7 && bitmap[letter][row]?.[column] === '1';
    bytes.set(border || filled ? color : [12, 23, 34], offset);
    bytes[offset + 3] = 255;
  }
  return bytes;
}
