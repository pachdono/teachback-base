export const MONSTERS = ["slime", "eyeball", "bat", "spore"];

export const CHAR_ATK = { spaceboy: "blaster", bob: "raygun", robert: "laser", max: "slash", einstein: "orb" };

export const MONSTER_MOVE = { slime: "SLIME SURGE!", eyeball: "EYE LASER!", bat: "WING SLASH!", spore: "SPORE BOMB!" };

export const CHARACTERS = [
  { id: "spaceboy", name: "Space Boy", tag: "Astronaut ace of the academy", tint: "#ff9f1c" },
  { id: "bob", name: "Bob", tag: "Blue, friendly, slightly squishy", tint: "#4cc9f0" },
  { id: "robert", name: "Robert", tag: "Fully certified quiz machine", tint: "#9aa7c7" },
  { id: "max", name: "Max", tag: "Cyber fox in prototype armour", tint: "#f0762e" },
  { id: "einstein", name: "Einstein", tag: "A small world of big brains", tint: "#3ddc97" },
];

export const PIXEL_SPRITES = {
  spaceboy: {
    colors: { k: "#241e4d", w: "#f2eeff", v: "#352a68", r: "#8f86c9", o: "#ff9f1c" },
    map: [
      "....kkkk....",
      "...kwwwwk...",
      "..kwwwwwwk..",
      "..kwvvvvwk..",
      "..kwvrvvwk..",
      "..kwvvvvwk..",
      "..kwwwwwwk..",
      "...kwwwwk...",
      "..kwwwwwwk..",
      ".kowwwwwwok.",
      ".kowwoowwok.",
      "..kwwwwwwk..",
      "..kww..wwk..",
      "..koo..ook..",
    ],
  },
  bob: {
    colors: { d: "#0e4a6e", b: "#4cc9f0", e: "#ffffff", p: "#0b2f47", m: "#0e4a6e", y: "#d8f7ff" },
    map: [
      "....dyyd....",
      "......d.....",
      "...dbbbbd...",
      "..dbbbbbbd..",
      ".dbeebbeebd.",
      ".dbepbbepbd.",
      ".dbbbbbbbbd.",
      ".dbbmmmmbbd.",
      ".dbbbbbbbbd.",
      "..dbbbbbbd..",
      "..dbbbbbbd..",
      "...dbbbbd...",
      "...db..bd...",
      "...dd..dd...",
    ],
  },
  robert: {
    colors: { k: "#20263c", m: "#b9c2d9", d: "#5a6378", c: "#45e0ff", y: "#ffd166", p: "#1c2340", g: "#3ddc97" },
    map: [
      ".....y......",
      ".....k......",
      "..kkkkkkkk..",
      ".kmmmmmmmmk.",
      ".kmcmmmmcmk.",
      ".kmmmmmmmmk.",
      ".kmddddddmk.",
      "..kkkkkkkk..",
      "....kddk....",
      ".kkkkkkkkkk.",
      ".kmpppmmgmk.",
      ".kmpgpmmymk.",
      ".kmmmmmmmmk.",
      "..kdd..ddk..",
    ],
  },
  max: {
    colors: { k: "#2a1a12", o: "#f0762e", O: "#ffb56b", w: "#ffffff", a: "#3a4566", c: "#45e0ff", g: "#8b95b3" },
    map: [
      ".kk......kk.",
      ".kok....kok.",
      ".koOk..kOok.",
      "..koooooook.",
      "..kocooocok.",
      "..kowwwwok..",
      "..kowkkwok..",
      "...kkkkkk...",
      "..kaaaaaak..",
      ".kgaaccaagk.",
      ".kgaaccaagk.",
      "..kaaaaaak..",
      "..kaa..aak..",
      "..koo..ook..",
    ],
  },
  ninja: {
    colors: { n: "#232946", b: "#3a4166", r: "#ff2e3f", s: "#c1121f", k: "#10131f" },
    map: [
      "...nnnnnn...",
      "..nnnnnnnn..",
      ".nnbbbbbbnn.",
      ".nbrbbbbrbn.",
      ".nnbbbbbbnn.",
      "..nnnnnnnn..",
      "..nssssssn..",
      ".ssnnnnnnss.",
      "..nnnnnnnn..",
      ".nnnnnnnnnn.",
      "..nnnnnnnn..",
      "..nnn..nnn..",
      "..nn....nn..",
      "..kk....kk..",
    ],
  },
  voidlord: {
    colors: { k: "#140f2e", y: "#ffc24b", o: "#b9791a", b: "#ece7fb", d: "#221844", e: "#ff3ea8", p: "#7c5cff", m: "#4a2fa8" },
    map: [
      "....y.y..y.y....",
      "...yyyyyyyyyy...",
      "..oyyyyyyyyyyo..",
      "..yoyoyoyoyoyo..",
      "..kbbbbbbbbbbk..",
      ".kbbbbbbbbbbbbk.",
      "kbbbbbbbbbbbbbbk",
      "kbbdddbbbbdddbbk",
      "kbbdedbbbbdedbbk",
      "kbbdddbbbbdddbbk",
      "kbbbbbbbbbbbbbbk",
      "kbbbbbbddbbbbbbk",
      ".kbbbbbbbbbbbbk.",
      "..kbkbkbkbkbkb..",
      "pppp........pppp",
      "pppmm......mmppp",
    ],
  },
  slime: {
    colors: { k: "#123a24", g: "#3ddc97", d: "#1f8f5f", w: "#ffffff", p: "#0e2a1a" },
    map: [
      "...ddddd...",
      ".ddgggggdd.",
      "dgggggggggd",
      "dgwwgggwwgd",
      "dgwpgggpwgd",
      "dgggggggggd",
      "dggkkkkkggd",
      "dgggggggggd",
      ".dgggggggd.",
      "..dd...dd..",
      "..d.....d..",
    ],
  },
  eyeball: {
    colors: { k: "#2a1a4a", u: "#a78bfa", U: "#7c5cff", w: "#ffffff", p: "#1a0f33", t: "#5a3fb0" },
    map: [
      "...UUUUU...",
      ".UUuuuuuUU.",
      "UUuuwwwuuUU",
      "UuwwpppwwuU",
      "UuwwpppwwuU",
      "UUuuwwwuuUU",
      ".UUuuuuuUU.",
      "...UUUUU...",
      "..t.t.t.t..",
      ".t.t.t.t.t.",
      ".t..t.t..t.",
    ],
  },
  bat: {
    colors: { k: "#1a1030", b: "#6b4fd0", B: "#4a2fa8", e: "#ff3ea8", w: "#ffffff" },
    map: [
      "b.........b",
      "bb.bbbbb.bb",
      "bBbbbbbbbBb",
      "bBBbbbbbBBb",
      "..beebeeb..",
      "..bbbbbbb..",
      "...bbbbb...",
      "...bkbkb...",
      "....b.b....",
    ],
  },
  spore: {
    colors: { k: "#3a1a2a", r: "#ff5c61", R: "#c1121f", w: "#ffffff", s: "#e8d9c0", p: "#2a1018" },
    map: [
      "...RRRRR...",
      ".RRrrrrrRR.",
      "RrwrrrrrwrR",
      "RrrrrrrrrrR",
      "RrrwrrrwrrR",
      ".RRrrrrrRR.",
      "...sssss...",
      "..sswwwss..",
      "..sspppss..",
      "..sssssss..",
      "..ss...ss..",
    ],
  },
  einstein: {
    colors: { k: "#1d2440", G: "#cfe9ff", u: "#2e7dd1", g: "#3ddc97", w: "#ffffff" },
    map: [
      "...GGGGGG...",
      "..G.uuuu.G..",
      ".G.uugguu.G.",
      ".G.uguuug.G.",
      "kG.uwuuwu.Gk",
      "kG.uuuuuu.Gk",
      ".G.uwwwwu.G.",
      ".G..uggu..G.",
      "..G.uuuu.G..",
      "...GGGGGG...",
      "....k..k....",
      "....k..k....",
      "...kk..kk...",
    ],
  },
};

export function PixelSprite({ id, size = 86 }) {
  const spr = PIXEL_SPRITES[id] || PIXEL_SPRITES.spaceboy;
  const cols = spr.map[0].length;
  const rows = spr.map.length;
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      width={size}
      height={Math.round((size * rows) / cols)}
      shapeRendering="crispEdges"
      className="pixel-sprite"
      aria-hidden="true"
    >
      {spr.map.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={spr.colors[ch]} />
        )
      )}
    </svg>
  );
}

