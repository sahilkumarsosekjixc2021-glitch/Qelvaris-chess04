// Tree node helper: n(san, info, children, critical)
export const n = (san, info = null, children = [], critical = null) => ({
  san,
  info,
  critical,
  children,
});

// chain("d4","b5","Bb3") -> [one node d4 > b5 > Bb3]
export const chain = (...sans) => sans.reduceRight((kids, san) => [n(san, null, kids)], []);
