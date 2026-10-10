// Creates cards_source.zip (source, data, assets, docs, preview, PDFs) with a tiny
// dependency-free ZIP writer (deflate via node:zlib).
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import { ROOT } from "./lib.mjs";

const OUT = "cards_source.zip";
const INCLUDE = [
  "README.md", "QC_REPORT.md", "package.json", "package-lock.json", ".gitignore", ".env.example",
  "international_fair_airport_card_game_master_prompt_final.md", "University Partners.xlsx",
  "exports", "preview", "editor",
  "config", "data", "design", "assets", "src", "scripts", "docs",
];
// Local-only material: editor import backups and temporary probe scripts.
const EXCLUDE = [/^data[\\/]backups([\\/]|$)/, /^scripts[\\/]_[^\\/]*_tmp\.mjs$/];

function walk(p) {
  const abs = join(ROOT, p);
  if (!existsSync(abs) || EXCLUDE.some((re) => re.test(p))) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((n) => walk(join(p, n)));
}

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const files = INCLUDE.flatMap(walk);
const locals = [], centrals = [];
let offset = 0;
for (const abs of files) {
  const name = Buffer.from("international-fair-airport-cards/" + relative(ROOT, abs).split(sep).join("/"), "utf8");
  const raw = readFileSync(abs);
  const comp = deflateRawSync(raw, { level: 9 });
  const useDeflate = comp.length < raw.length;
  const body = useDeflate ? comp : raw;
  const crc = crc32(raw) >>> 0;
  const { time, date } = dosTime(statSync(abs).mtime);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(useDeflate ? 8 : 0, 8); lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22);
  lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  locals.push(lh, name, body);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(useDeflate ? 8 : 0, 10); ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14);
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24);
  ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
  centrals.push(ch, name);
  offset += lh.length + name.length + body.length;
}
const cdSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
writeFileSync(join(ROOT, OUT), Buffer.concat([...locals, ...centrals, end]));
console.log(`✓ ${OUT} — ${files.length} files, ${(statSync(join(ROOT, OUT)).size / 1024 / 1024).toFixed(2)} MB`);
