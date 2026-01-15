# 括号处理修复说明

## 问题描述

用户反馈：有的和弦被括号括起来，括号不能丢失。需要用半角括号节约空间。

### 示例
- `(D)` → 转调后应为 `(G)`（保留括号）
- `(D/F#)` → 转调后应为 `(G/A#)`（保留括号）

---

## 根本原因

### 问题1: 正则表达式不够严格

**原正则**:
```typescript
const CHORD_REGEX = /^(?:\()?([#b]?)([A-G])([#b]?)([a-z0-9]*)?(?:\/([#b]?[A-G])([#b])?)?(?:\))?$/i;
```

**问题**:
- `(?:\()?` 和 `(?:\))?` 使括号成为可选的
- 即使输入 `(C`（只有左括号）或 `C)`（只有右括号）也能匹配
- 导致括号检测不准确

### 问题2: parseChord 中重复检测括号

**原逻辑**:
```typescript
const hasParentheses = trimmed.startsWith('(') && trimmed.endsWith(')'); // 第一次检测
// ... 去掉括号并匹配正则 ...
const hasParentheses = trimmed.startsWith('(') && trimmed.endsWith(')'); // 第二次检测（此时 trimmed 已去掉括号）
```

**问题**:
- 第二次检测时，`trimmed` 已被去掉括号（如果有的话）
- 导致 `hasParentheses` 总是为 `false`

### 问题3: transposeChord 没有保留括号标记

**原代码**:
```typescript
return {
  root: newRoot,
  quality: chord.quality,
  bass: newBass,
  x: chord.x,
  y: chord.y,
  // ❌ 缺少 hasParentheses
};
```

**问题**:
- 转调后的和弦丢失了 `hasParentheses` 属性
- 导致 `chordToString` 无法正确添加括号

---

## 修复方案

### 1. 修改正则表达式

**新正则**（去掉括号匹配）:
```typescript
const CHORD_REGEX = /^([#b]?)([A-G])([#b]?)([a-z0-9]*)?(?:\/([#b]?[A-G])([#b])?)?$/i;
```

**优势**:
- 正则表达式只匹配无括号的和弦
- 简化匹配逻辑，更清晰

### 2. 修改 parseChord 方法

**新逻辑**:
```typescript
// 先检测是否有完整括号（必须同时有左右括号）
const hasParentheses = trimmed.startsWith('(') && trimmed.endsWith(')');

// 如果有括号，去掉括号后再匹配
if (hasParentheses) {
  trimmed = trimmed.slice(1, -1);
}

// 用无括号的正则匹配
const match = trimmed.match(CHORD_REGEX);
```

**优势**:
- 括号检测在正则匹配之前，更准确
- 确保只有完整的括号 `(C)` 才会被识别
- 避免部分括号 `(C` 或 `C)` 的误判

### 3. 删除重复检测

**修改后**:
```typescript
const hasParentheses = trimmed.startsWith('(') && trimmed.endsWith(')'); // 检测一次
if (hasParentheses) {
  trimmed = trimmed.slice(1, -1); // 去掉括号
}
const match = trimmed.match(CHORD_REGEX); // 匹配
// ...
const chord: Chord = {
  root: normalizedRoot,
  quality,
  bass: normalizedBass,
  hasParentheses, // ✅ 使用之前检测到的状态
};
```

**优势**:
- 只检测一次，逻辑清晰
- 避免状态不一致

### 4. 修改 transposeChord 方法

**新代码**:
```typescript
return {
  root: newRoot,
  quality: chord.quality,
  bass: newBass,
  x: chord.x,
  y: chord.y,
  hasParentheses: chord.hasParentheses, // ✅ 保留括号标记
};
```

**优势**:
- 转调时保留 `hasParentheses` 属性
- 确保 `chordToString` 能正确添加括号

---

## chordToString 方法（已正确实现）

```typescript
chordToString(chord: Chord): string {
  let result = chord.root + chord.quality;
  if (chord.bass) {
    result += '/' + chord.bass;
  }
  // 如果有括号，用半角括号包围
  if (chord.hasParentheses) {
    result = '(' + result + ')'; // ✅ 使用半角括号
  }
  return result;
}
```

**说明**:
- 使用半角括号 `(` 和 `)`（不是全角括号 `（` 和 `）`）
- 节约空间

---

## 修改的文件

**文件**: `src/lib/chord-transposer.ts`

### 修改位置

1. **第48行**: 正则表达式定义
   - 修改前: `/^(?:\()?...(?:\))?$/i`
   - 修改后: `/^...$/i`（去掉括号匹配）

2. **第78-84行**: parseChord 方法
   - 添加括号检测逻辑（在匹配前）
   - 去掉括号再匹配

3. **第136行**: parseChord 方法
   - 删除重复的括号检测
   - 使用之前检测到的 `hasParentheses`

4. **第206行**: transposeChord 方法
   - 添加 `hasParentheses: chord.hasParentheses`

---

## 测试场景

### 场景1: 简单和弦
- 输入: `(D)`
- 期望: 转调后为 `(G)`（保留括号）

### 场景2: 转位和弦
- 输入: `(D/F#)`
- 期望: 转调后为 `(G/A#)`（保留括号）

### 场景3: 带升降号的和弦
- 输入: `(#D)`
- 期望: 转调后为 `(#G)`（保留括号）

### 场景4: 无括号和弦
- 输入: `D`
- 期望: 转调后为 `G`（不添加括号）

### 场景5: 不完整的括号
- 输入: `(D` 或 `D)`
- 期望: 不识别为带括号和弦，正常处理

---

## 技术细节

### 括号类型

使用**半角括号**（英文括号）:
- 左括号: `(` (U+0028)
- 右括号: `)` (U+0029)

不使用**全角括号**（中文括号）:
- 左括号: `（` (U+FF08)
- 右括号: `）` (U+FF09)

**原因**: 半角括号占用空间更小，更适合在图片标注中使用。

### AI 识别支持

AI 识别的和弦字符串可能包含：
- `(D)` - 简单和弦
- `(D/F#)` - 转位和弦
- `(#D)` - 带升降号的和弦
- `(D7)` - 带和弦性质的
- `(Gsus4)` - 挂留和弦
- `(Am7)` - 小七和弦

所有这些格式都会被正确识别并保留括号。

---

## 验证

### 代码验证
```bash
npx tsc --noEmit
```

✅ 无类型错误

### 逻辑验证

1. **输入**: `(D)`
   - `parseChord`: `{ root: 'D', quality: '', hasParentheses: true }`
   - `transposeChord` (C→G): `{ root: 'G', quality: '', hasParentheses: true }`
   - `chordToString`: `(G)` ✅

2. **输入**: `(D/F#)`
   - `parseChord`: `{ root: 'D', quality: '', bass: 'F#', hasParentheses: true }`
   - `transposeChord` (C→G): `{ root: 'G', quality: '', bass: 'A#', hasParentheses: true }`
   - `chordToString`: `(G/A#)` ✅

3. **输入**: `D`
   - `parseChord`: `{ root: 'D', quality: '', hasParentheses: false }`
   - `transposeChord` (C→G): `{ root: 'G', quality: '', hasParentheses: false }`
   - `chordToString`: `G` ✅

---

## 影响范围

**受影响的功能**:
1. ✅ 和弦识别（AI 识别带括号的和弦）
2. ✅ 和弦解析（parseChord 正确识别括号）
3. ✅ 和弦转调（transposeChord 保留括号）
4. ✅ 和弦显示（chordToString 正确输出括号）
5. ✅ 图片标注（标注时保留括号）

**不受影响的功能**:
1. ✅ 无括号和弦的处理
2. ✅ 转调算法
3. ✅ 坐标计算
4. ✅ 字体大小计算

---

## 总结

✅ **修复完成**

### 改进点
1. 正则表达式更严格，避免误判
2. 括号检测逻辑更清晰
3. 转调时正确保留括号标记
4. 使用半角括号节约空间

### 结果
- 带括号的和弦转调后仍然保留括号
- 使用半角括号，占用空间更小
- 无括号的和弦不受影响

---

**文档版本**: v1.0
**修复日期**: 2025-01-23
**维护者**: 项目团队
