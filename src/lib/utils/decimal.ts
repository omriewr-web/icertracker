export const toNumber = (val: unknown): number =>
  val === null || val === undefined ? 0 : Number(val);
