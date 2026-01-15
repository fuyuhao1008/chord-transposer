/**
 * 和弦转调工具类
 * 支持完整的12个调性和等音转换
 */

export type ChordQuality = '' | 'm' | 'maj' | 'min' | 'aug' | 'dim' | 'sus2' | 'sus4' | 'add9' | '6' | '7' | 'maj7' | '9' | '11' | '13' | string; // 支持"7sus4"等复合和弦性质

// OCR修正库：根据原调修正AI识别遗漏的升降号
const OCR_CORRECTION_LIBRARY: Record<string, Record<string, string>> = {
  /* ======================
   * 升号调（Sharp Keys）
   * ====================== */

  // C 调（无升降号）
  'C': {},

  // G 调（1#：F#）
  'G': {
    // Slash 低音（相差3个半音，需要修正）
    'Em/F': 'Em/F#',
    'D/F': 'D/F#',
  },

  // D 调（2#：F#, C#）
  'D': {
    // Slash 低音（相差3个半音，需要修正）
    'A/C': 'A/C#',
    'D/F': 'D/F#',
    'Bm/F': 'Bm/F#',
    'E7/G': 'E7/G#',

    // 和弦根音（相差3个半音，需要修正）
    'C/E': 'C#/E',
  },

  // A 调（3#：F#, C#, G#）
  'A': {
    // Slash 低音（相差3个半音，需要修正）
    'A/C': 'A/C#',
    'D/F': 'D/F#',
    'E/G': 'E/G#',
    'C#m/G': 'C#m/G#',

    // 和弦根音（相差3个半音，需要修正）
    'C/E': 'C#/E',
    'G/B': 'G#/B',
  },

  // E 调（4#：F#, C#, G#, D#）
  'E': {
    // Slash 低音（相差3个半音，需要修正）
    'E/G': 'E/G#',
    'B/D': 'B/D#',
    'A/C': 'A/C#',
    'F#7/A': 'F#7/A#',

    // 和弦根音（相差3个半音，需要修正）
    'C/E': 'C#/E',
    'G/B': 'G#/B',
  },

  // B 调（5#：F#, C#, G#, D#, A#）
  'B': {
    // Slash 低音（相差3个半音，需要修正）
    'B/D': 'B/D#',
    'E/G': 'E/G#',
    'F#/A': 'F#/A#',
    'C#m/G': 'C#m/G#',

    // 和弦根音（相差3个半音，需要修正）
    'C/E': 'C#/E',
  },

  // F# 调（6#：F#, C#, G#, D#, A#, E#）
  'F#': {
    // Slash 低音（相差3个半音，需要修正）
    'F#/A': 'F#/A#',
    'C#/E': 'C#/E#',
    'B/D': 'B/D#',

    // 和弦根音（相差3个半音，需要修正）
    'G/B': 'G#/B',
  },

  // C# 调（7#：F#, C#, G#, D#, A#, E#, B#）
  'C#': {
    'F#/A': 'F#/A#',
    'C#/E': 'C#/E#',
    'G#/B': 'G#/B#',
  },

  /* ======================
   * 降号调（Flat Keys）
   * ====================== */

  // F 调（1♭：Bb）
  'F': {
    'Bb/D': 'Bb/D',
  },

  // Bb 调（2♭：Bb, Eb）
  'Bb': {
    // Slash 低音
    'E/G': 'Eb/G',

    // 和弦根音
    'E/Bb': 'Eb/Bb',
    'E/F': 'Eb/F',
  },

  // Eb 调（3♭：Bb, Eb, Ab）
  'Eb': {
    // Slash 低音
    'E/G': 'Eb/G',
    'A/C': 'Ab/C',

    // 和弦根音
    'E/Bb': 'Eb/Bb',
    'A/Eb': 'Ab/Eb',
  },

  // Ab 调（4♭：Bb, Eb, Ab, Db）
  'Ab': {
    // Slash 低音
    'A/C': 'Ab/C',
    'D/F': 'Db/F',

    // 和弦根音
    'A/Eb': 'Ab/Eb',
    'D/Ab': 'Db/Ab',
  },

  // Db 调（5♭：Bb, Eb, Ab, Db, Gb）
  'Db': {
    // Slash 低音
    'G/B': 'Gb/Bb',
    'D/F': 'Db/F',

    // 和弦根音
    'G/Db': 'Gb/Db',
    'C/F': 'Cb/F',
  },

  // Gb 调（6♭：Bb, Eb, Ab, Db, Gb, Cb）
  'Gb': {
    // Slash 低音
    'G/B': 'Gb/Bb',
    'C/E': 'Cb/Eb',

    // 和弦根音
    'G/Db': 'Gb/Db',
    'C/Gb': 'Cb/Gb',
  },

  // Cb 调（7♭，实际很少用，通常用B调代替）
  'Cb': {
    'G/B': 'Gb/Bb',
    'C/E': 'Cb/Eb',
  },
};

export interface Chord {
  root: string;        // 根音，如 'C', 'G#'
  quality: ChordQuality; // 和弦性质，如 '', 'm', 'maj7'
  bass?: string;       // 转位低音，如 'E' (表示 C/E)
  x?: number;          // 图片中的 x 坐标（百分比，0-100）
  y?: number;          // 图片中的 y 坐标（百分比，0-100）
  hasParentheses?: boolean; // 是否用括号包围（如 (D), (D/F#)）
}

export interface TransposeResult {
  originalKey: string;
  targetKey: string;
  semitones: number;
  chords: {
    original: Chord;
    transposed: Chord;
  }[];
}

// 12个调的音阶
export const CHROMATIC_SCALE = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

// 等音转换映射（根据用户要求）
// D# → bE, A# → bB
export const ENHARMONIC_MAP: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
  // 反向映射
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
};

// 和弦识别正则表达式（支持升降号在前/后）
// 匹配：C, C#, #C, D, D/F#, G7sus4, Am7, A7sus4, Asus4 等
// 修正：低音部分使用三个独立的匹配组，避免丢失升降号
const CHORD_REGEX = /^([#b]?)([A-G])([#b]?)([a-z0-9]*)?(?:\/([#b]?)([A-G])([#b]?))?$/i;

class ChordTransposer {
  /**
   * 规范化音符为升号形式（用于内部处理）
   * 如 bB -> A#, bE -> D#
   */
  private normalizeToSharp(note: string): string {
    // 检查是否已经是升号或基本音
    if (CHROMATIC_SCALE.includes(note)) {
      return note;
    }

    // 将降号转换为升号
    return ENHARMONIC_MAP[note] || note;
  }

  /**
   * 根据原调修正和弦字符串（OCR修正）
   * 用于修正AI识别时遗漏的升降号
   * @param chordString 原始和弦字符串
   * @param originalKey 原调
   * @returns 修正后的和弦字符串
   */
  correctChordByKey(chordString: string, originalKey: string): string {
    // 规范化和弦字符串
    let corrected = chordString.trim();

    // 转换上标数字为普通数字（AI可能识别出上标字符）
    const superscriptMap: Record<string, string> = {
      '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
      '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    };
    for (const [sup, normal] of Object.entries(superscriptMap)) {
      corrected = corrected.replace(new RegExp(sup, 'g'), normal);
    }

    // 保存括号状态
    const hasParentheses = corrected.startsWith('(') && corrected.endsWith(')');
    if (hasParentheses) {
      corrected = corrected.slice(1, -1);
    }

    // 规范化原调（去掉"调"字等后缀）
    const normalizedKey = this.normalizeKey(originalKey);

    // 检查OCR修正库中是否有针对这个原调的修正规则
    const corrections = OCR_CORRECTION_LIBRARY[normalizedKey];
    if (corrections) {
      // 检查和弦是否在修正库中
      const replacement = corrections[corrected];
      if (replacement) {
        corrected = replacement;
      }
    }

    // 恢复括号
    if (hasParentheses) {
      corrected = '(' + corrected + ')';
    }

    return corrected;
  }

  /**
   * 解析和弦字符串
   * @param chordString 和弦字符串，如 "C", "Am7", "Gsus4", "C/E", "G7sus4", "#C", "(D)", "(D/F#)", "(#D/F#)"
   */
  parseChord(chordString: string): Chord | null {
    let trimmed = chordString.trim();

    // 转换上标数字为普通数字（AI可能识别出上标字符）
    const superscriptMap: Record<string, string> = {
      '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
      '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    };
    for (const [sup, normal] of Object.entries(superscriptMap)) {
      trimmed = trimmed.replace(new RegExp(sup, 'g'), normal);
    }

    // 检测是否有括号（必须同时有左右括号）
    const hasParentheses = trimmed.startsWith('(') && trimmed.endsWith(')');

    // 如果有括号，去掉括号后再匹配
    if (hasParentheses) {
      trimmed = trimmed.slice(1, -1);
    }

    const match = trimmed.match(CHORD_REGEX);

    if (!match) {
      return null;
    }

    const [, accidentalFront, root, accidentalBack, qualityPart, bassAccFront, bassRoot, bassAccBack] = match;

    // 合并升降号（优先使用前面的）
    const accidental = accidentalFront || accidentalBack || '';

    // 构建和弦性质（使用简单映射）
    let quality: ChordQuality = '';

    if (!qualityPart) {
      quality = '';
    } else if (qualityPart.toLowerCase() === 'min') {
      quality = 'm';
    } else if (qualityPart.toLowerCase() === 'sus' || qualityPart.toLowerCase() === 'sus2') {
      quality = qualityPart.toLowerCase() as ChordQuality;
    } else if (qualityPart.toLowerCase() === 'sus4') {
      quality = 'sus4';
    } else {
      // 直接使用识别到的性质（支持 m7, maj7, 7sus4, add9, 7, 9, 11, 13 等）
      quality = qualityPart.toLowerCase() as ChordQuality;
    }

    // 解析转位低音（格式：/F#, /bE, /#C等）
    let normalizedBass: string | undefined;
    if (bassRoot) {
      const bassAccidental = bassAccFront || bassAccBack || '';
      normalizedBass = this.normalizeToSharp(bassRoot + bassAccidental);
    }

    // 规范化根音为升号形式
    const normalizedRoot = this.normalizeToSharp(root + accidental);

    const chord: Chord = {
      root: normalizedRoot,
      quality,
      bass: normalizedBass,
      hasParentheses, // 使用之前检测到的括号状态
    };

    return chord;
  }

  /**
   * 将和弦转换为字符串
   * @param chord 和弦对象
   */
  chordToString(chord: Chord): string {
    let result = chord.root + chord.quality;
    if (chord.bass) {
      result += '/' + chord.bass;
    }
    // 如果有括号，用半角括号包围
    if (chord.hasParentheses) {
      result = '(' + result + ')';
    }
    return result;
  }

  /**
   * 在音阶中移动半音数
   * @param note 音符，如 'C', 'G#'
   * @param semitones 半音数，正数表示升高，负数表示降低
   * @param useEnharmonic 是否使用等音（如 Eb 代替 D#）
   */
  shiftNote(note: string, semitones: number, useEnharmonic: boolean = true): string {
    const index = CHROMATIC_SCALE.findIndex(n => n === note);
    if (index === -1) return note;

    const newIndex = ((index + semitones) % 12 + 12) % 12;
    let newNote = CHROMATIC_SCALE[newIndex];

    // 等音转换（根据用户要求）
    if (useEnharmonic) {
      newNote = this.applyEnharmonicMapping(newNote);
    }

    return newNote;
  }

  /**
   * 应用等音映射规则
   * D# → Eb, A# → Bb
   */
  private applyEnharmonicMapping(note: string): string {
    return ENHARMONIC_MAP[note] || note;
  }

  /**
   * 转调单个和弦
   * @param chord 和弦对象
   * @param semitones 半音数
   * @param useEnharmonic 是否使用等音
   */
  transposeChord(chord: Chord, semitones: number, useEnharmonic: boolean = true): Chord {
    const newRoot = this.shiftNote(chord.root, semitones, useEnharmonic);
    const newBass = chord.bass ? this.shiftNote(chord.bass, semitones, useEnharmonic) : undefined;

    return {
      root: newRoot,
      quality: chord.quality,
      bass: newBass,
      x: chord.x,
      y: chord.y,
      hasParentheses: chord.hasParentheses, // 保留括号标记
    };
  }

  /**
   * 计算两个调之间的半音数
   * @param fromKey 原调
   * @param toKey 目标调
   */
  calculateSemitones(fromKey: string, toKey: string): number {
    // 规范化调号为升号形式
    const normalizedFrom = this.normalizeToSharp(fromKey);
    const normalizedTo = this.normalizeToSharp(toKey);

    const fromIndex = CHROMATIC_SCALE.findIndex(k => k === normalizedFrom);
    const toIndex = CHROMATIC_SCALE.findIndex(k => k === normalizedTo);

    if (fromIndex === -1 || toIndex === -1) {
      throw new Error(`Invalid key: ${fromKey} (${normalizedFrom}) or ${toKey} (${normalizedTo})`);
    }

    return ((toIndex - fromIndex) % 12 + 12) % 12;
  }

  /**
   * 批量转调和弦
   * @param chords 和弦列表
   * @param originalKey 原调
   * @param targetKey 目标调
   * @param useEnharmonic 是否使用等音
   */
  transposeChords(
    chords: Chord[],
    originalKey: string,
    targetKey: string,
    useEnharmonic: boolean = true
  ): TransposeResult {
    const semitones = this.calculateSemitones(originalKey, targetKey);

    // 规范化目标调性为升号形式
    const normalizedTarget = this.normalizeToSharp(targetKey);

    // 根据目标调性决定是否使用降号形式
    // 降号调：F, Bb, Eb, Ab, Db, Gb, Cb
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    const shouldUseFlats = flatKeys.includes(normalizedTarget);

    return {
      originalKey,
      targetKey,
      semitones,
      chords: chords.map(chord => {
        const transposed = this.transposeChord(chord, semitones, shouldUseFlats);
        // 修正不可能的和弦（如 G/A# -> G/B）
        return {
          original: chord,
          transposed: this.correctUnreasonableChord(transposed),
        };
      }),
    };
  }

  /**
   * 批量转调和弦（根据半音数）
   * @param chords 和弦列表
   * @param originalKey 原调
   * @param semitones 半音数（正数表示升，负数表示降）
   * @param useEnharmonic 是否使用等音
   */
  transposeChordsBySemitones(
    chords: Chord[],
    originalKey: string,
    semitones: number,
    useEnharmonic: boolean = true
  ): TransposeResult {
    // 规范化原调为升号形式
    const normalizedOriginal = this.normalizeToSharp(originalKey);

    // 计算目标调
    const originalIndex = CHROMATIC_SCALE.findIndex(k => k === normalizedOriginal);
    const targetIndex = ((originalIndex + semitones) % 12 + 12) % 12;
    let targetKeyCalculated = CHROMATIC_SCALE[targetIndex];

    // 应用等音转换
    targetKeyCalculated = this.applyEnharmonicMapping(targetKeyCalculated);

    // 根据目标调性决定是否使用降号形式
    // 降号调：F, Bb, Eb, Ab, Db, Gb, Cb
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    const shouldUseFlats = flatKeys.includes(targetKeyCalculated);

    return {
      originalKey,
      targetKey: targetKeyCalculated,
      semitones,
      chords: chords.map(chord => {
        const transposed = this.transposeChord(chord, semitones, shouldUseFlats);
        // 修正不可能的和弦（如 G/A# -> G/B）
        return {
          original: chord,
          transposed: this.correctUnreasonableChord(transposed),
        };
      }),
    };
  }

  /**
   * 判断和弦是否"不可能"（根音与低音形成极不和谐的音程）
   * 判断规则：
   * 1. 只禁止极度不和谐的小二度（1半音）和减三度（3半音）
   * 2. 其他音程都允许，包括：
   *    - 同音（0半音）
   *    - 大二度（2半音）：如 C/D
   *    - 大三度（4半音）：如 C/E
   *    - 纯四度（5半音）：如 C/F
   *    - 增四度/减五度（6半音）：如 C/F#，爵士乐中常见
   *    - 纯五度（7半音）：如 C/G
   *    - 其他音程（8-11半音）：如 C-Ab(8), C-A(9), C-Bb(10), C-B(11)
   * @param chord 和弦对象
   */
  private isUnreasonableChord(chord: Chord): boolean {
    if (!chord.bass) return false;

    const rootIndex = CHROMATIC_SCALE.findIndex(n => n === chord.root);
    const bassIndex = CHROMATIC_SCALE.findIndex(n => n === chord.bass);

    if (rootIndex === -1 || bassIndex === -1) return false;

    // 计算根音到低音的音程（向上0-11半音）
    let interval = bassIndex - rootIndex;
    if (interval < 0) interval += 12;

    // 只禁止极度不和谐的音程：
    // 1. 小二度（1半音）：如 C-Db，极度不和谐
    // 2. 减三度（3半音）：如 C-Eb，不和谐
    const unacceptableIntervals = [1, 3];

    return unacceptableIntervals.includes(interval);
  }

  /**
   * 修正不可能的和弦
   * 规则：
   * 1. 如果和弦不合理，找到距离原低音最近的合理低音
   * 2. 优先选择常用的和弦转位音程（2, 4, 5, 7），其次选择其他音程
   * 3. 如果找不到，则移除低音
   * @param chord 和弦对象
   */
  correctUnreasonableChord(chord: Chord): Chord {
    // 如果没有低音或和弦合理，直接返回
    if (!chord.bass || !this.isUnreasonableChord(chord)) {
      return chord;
    }

    const rootIndex = CHROMATIC_SCALE.findIndex(n => n === chord.root);
    const originalBassIndex = CHROMATIC_SCALE.findIndex(n => n === chord.bass!);

    if (rootIndex === -1 || originalBassIndex === -1) {
      return { ...chord, bass: undefined };
    }

    // 常用的和弦转位音程（相对于根音的半音数）
    // 2: 9音，4: 3音，5: 11音，7: 5音（不包括同音0）
    const preferredIntervals = [2, 4, 5, 7];

    let bestBass: string | undefined = undefined;
    let bestDistance = 13; // 最大距离是6，初始化为大于6的值
    let isPreferred = false; // 是否找到了首选音程

    // 遍历所有可能的低音
    for (let i = 0; i < 12; i++) {
      const candidateBass = CHROMATIC_SCALE[i];
      const testChord = { ...chord, bass: candidateBass };

      // 检查是否合理
      if (this.isUnreasonableChord(testChord)) {
        continue; // 不合理，跳过
      }

      // 计算与原低音的距离（取最小路径）
      let distance = Math.abs(i - originalBassIndex);
      if (distance > 6) {
        distance = 12 - distance;
      }

      // 计算相对于根音的音程
      let interval = i - rootIndex;
      if (interval < 0) interval += 12;

      // 判断是否为常用音程
      const candidateIsPreferred = preferredIntervals.includes(interval);

      // 优先级：
      // 1. 常用音程优先于非常用音程
      // 2. 同等优先级下，距离更近的优先
      if (!bestBass || candidateIsPreferred > isPreferred ||
          (candidateIsPreferred === isPreferred && distance < bestDistance)) {
        bestDistance = distance;
        bestBass = candidateBass;
        isPreferred = candidateIsPreferred;
      }
    }

    // 如果找到合理的低音，使用它；否则移除低音
    return {
      ...chord,
      bass: bestBass,
    };
  }

  /**
   * 规范化调号（转换为标准格式）
   */
  normalizeKey(key: string): string {
    const trimmed = key.trim().toUpperCase();
    // 处理 1=C 格式
    if (trimmed.startsWith('1=')) {
      return trimmed.replace('1=', '');
    }
    // 处理 Key: C 格式
    if (trimmed.startsWith('KEY:')) {
      return trimmed.replace('KEY:', '');
    }
    return trimmed;
  }
}

export const chordTransposer = new ChordTransposer();

// 导出所有可用的调号
export const ALL_KEYS = [
  { value: 'C', label: 'C调' },
  { value: 'Db', label: 'Db调' },
  { value: 'D', label: 'D调' },
  { value: 'Eb', label: 'Eb调' },
  { value: 'E', label: 'E调' },
  { value: 'F', label: 'F调' },
  { value: 'Gb', label: 'Gb调' },
  { value: 'G', label: 'G调' },
  { value: 'Ab', label: 'Ab调' },
  { value: 'A', label: 'A调' },
  { value: 'Bb', label: 'Bb调' },
  { value: 'B', label: 'B调' },
];

/**
 * 获取调号在音阶中的索引
 * @param key 调号（如 'C', 'Db', 'F#'）
 * @returns 索引（0-11），找不到则返回 -1
 */
export function getKeyIndex(key: string): number {
  const normalizedKey = chordTransposer['normalizeToSharp'](key);
  return CHROMATIC_SCALE.findIndex(n => n === normalizedKey);
}
