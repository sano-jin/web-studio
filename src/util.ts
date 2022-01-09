/**
 * Utility functions
 */

// 長さ length, で全ての値が initialValue な array を作る．
// ただし，値は JSON.parse/stringfy を用いて deep copy する．
export const makeArray = <T extends {}>(length: number, initialValue: T): T[] =>
  JSON.parse(JSON.stringify(Array(length).fill(initialValue)));
