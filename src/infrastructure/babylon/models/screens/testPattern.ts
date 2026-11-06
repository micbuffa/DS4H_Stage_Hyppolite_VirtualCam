export const patternWidth = 512;
export const patternHeight = 288;

const glyphs: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  C: '01111 10000 10000 10000 10000 10000 01111',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  G: '01111 10000 10000 10111 10001 10001 01110',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11110 00001 00001 01110 00001 00001 11110',
  6: '01110 10000 10000 11110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00001 01110',
  ':': '00000 00100 00100 00000 00100 00100 00000',
};

/** RGBA bytes bottom-row first, matching the default Babylon plane UVs. */
export function createTestPattern(id: number, name: string, offline = false): Uint8Array {
  const data = new Uint8Array(patternWidth * patternHeight * 4);
  const rect = (left: number, top: number, width: number, height: number, color: readonly number[]) => {
    for (let y = top; y < Math.min(top + height, patternHeight); y++) {
      for (let x = left; x < Math.min(left + width, patternWidth); x++) {
        const index = ((patternHeight - 1 - y) * patternWidth + x) * 4;
        data[index] = color[0]; data[index + 1] = color[1]; data[index + 2] = color[2]; data[index + 3] = 255;
      }
    }
  };
  const white = [235, 242, 247];
  const text = (value: string, x: number, y: number, scale: number) => {
    [...value].forEach((letter, index) => {
      const rows = (glyphs[letter] ?? '').split(' ');
      rows.forEach((row, rowIndex) => [...row].forEach((bit, col) => {
        if (bit === '1') rect(x + index * 6 * scale + col * scale, y + rowIndex * scale, scale, scale, white);
      }));
    });
  };
  rect(0, 0, patternWidth, patternHeight, [12, 22, 34]);
  const colors = [[230, 235, 235], [232, 201, 82], [75, 197, 203], [84, 176, 115], [187, 105, 183], [214, 89, 82], [70, 113, 196], [40, 51, 66]];
  if (!offline) colors.forEach((color, i) => rect(i * 64, 35, 64, 46, color));
  rect(0, 0, 20, 20, [75, 197, 203]);
  rect(492, 268, 20, 20, [214, 89, 82]);
  text(offline ? 'SANS SIGNAL' : 'HAUT 16:9', 175, 10, 2);
  const title = `${id} ${name}`;
  text(title, Math.round((512 - title.length * 30) / 2), 110, 5);
  text(offline ? 'SANS SIGNAL' : 'MIRE STATIQUE', 139, 164, 3);
  for (let i = 0; i < 8; i++) rect(30 + i * 56, 215, 56, 17, [i * 35, i * 35, i * 35]);
  text('GAUCHE', 28, 255, 2);
  text('DROITE', 412, 255, 2);
  rect(252, 245, 8, 32, white);
  rect(240, 257, 32, 8, white);
  return data;
}
