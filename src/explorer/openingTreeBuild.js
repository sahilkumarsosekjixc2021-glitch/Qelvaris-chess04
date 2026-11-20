// Qelvaris Explore — tree builder.
// openingTree.js ke data ko chess.js se chala kar har node ke liye FEN/UCI/ply banata hai.
// Galat (illegal) move mili toh wo subtree skip hoga aur warning milegi — app crash nahi hoga.

import { Chess } from "chess.js";

export function moveLabel(ply, san) {
  return ply % 2 === 1 ? `${(ply + 1) / 2}.${san}` : `${ply / 2}…${san}`;
}

const keyOf = (fen) => fen.split(" ").slice(0, 4).join(" ");

// def = { id, name, side, trunk, overview, tree } (openingRegistry.js)
export function buildOpening(def) {
  const nodes = new Map();
  const byKey = new Map();
  const warnings = [];

  const rootChess = new Chess();
  const root = {
    id: "",
    san: null,
    uci: null,
    fen: rootChess.fen(),
    ply: 0,
    parentId: null,
    childIds: [],
    info: null,
    critical: null,
    path: [],
  };
  root.key = keyOf(root.fen);

  function add(parent, san, extra) {
    const chess = new Chess(parent.fen);
    let played;
    try {
      played = chess.move(san);
    } catch {
      played = null;
    }
    if (!played) {
      warnings.push(`Illegal move "${san}" after: ${parent.path.join(" ") || "start"}`);
      return null;
    }
    const path = [...parent.path, played.san];
    const node = {
      id: path.join(" "),
      san: played.san,
      uci: played.from + played.to + (played.promotion || ""),
      fen: chess.fen(),
      ply: parent.ply + 1,
      parentId: parent.id,
      childIds: [],
      info: extra?.info || null,
      critical: extra?.critical || null,
      path,
    };
    node.key = keyOf(node.fen);
    nodes.set(node.id, node);
    parent.childIds.push(node.id);
    if (!byKey.has(node.key)) byKey.set(node.key, []);
    byKey.get(node.key).push(node.id);
    return node;
  }

  nodes.set(root.id, root);
  byKey.set(root.key, [root.id]);

  // Trunk: opening ki shuruaati chaalein
  let cursor = root;
  for (const san of def.trunk.split(" ")) {
    const next = add(cursor, san, null);
    if (!next) break;
    cursor = next;
  }
  cursor.info = def.overview;
  const trunkEnd = cursor;

  function grow(parent, defs) {
    for (const def of defs) {
      const node = add(parent, def.san, { info: def.info, critical: def.critical });
      if (node && def.children?.length) grow(node, def.children);
    }
  }
  grow(trunkEnd, def.tree);

  return { openingId: def.id, nodes, byKey, root, trunkEndId: trunkEnd.id, warnings };
}
