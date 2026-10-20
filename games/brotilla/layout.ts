export function layout(portrait: boolean) {
  return {
    portrait, w: portrait ? 540 : 960, h: portrait ? 800 : 540,
    top: portrait ? 99 : 75, footer: portrait ? 146 : 104,
    horizon: portrait ? 285 : 203,
    shipX: portrait ? 18 : 270, shipY: portrait ? 556 : 367,
    shipScale: portrait ? .99 : 1.02,
    partyX: portrait ? 17 : 23, partyY: portrait ? 337 : 319,
    partyScale: portrait ? .72 : .89,
  };
}
export type Layout = ReturnType<typeof layout>;
