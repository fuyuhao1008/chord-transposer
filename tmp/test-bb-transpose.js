// 测试 bB 转调
const { CHROMATIC_SCALE, ENHARMONIC_MAP } = require('./src/lib/chord-transposer.ts');

console.log('CHROMATIC_SCALE:', CHROMATIC_SCALE);
console.log('ENHARMONIC_MAP:', ENHARMONIC_MAP);

// 测试 bB -> A# 转换
const bB = 'Bb';
console.log(`\nbB (${bB}) 映射为:`, ENHARMONIC_MAP[bB] || bB);

// 测试转调: bB (A#) + 2 semitones = C
const aSharpIndex = CHROMATIC_SCALE.findIndex(n => n === 'A#');
console.log('A# index:', aSharpIndex);
const cIndex = (aSharpIndex + 2) % 12;
console.log('C index:', cIndex);
console.log('转调后:', CHROMATIC_SCALE[cIndex]);
