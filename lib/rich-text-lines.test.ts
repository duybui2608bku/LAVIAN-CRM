import assert from "node:assert/strict";
import { test } from "node:test";
import { getSchema } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { isolateSelectedLines } from "./rich-text-lines.ts";

const schema = getSchema([StarterKit]);
const br = () => schema.nodes.hardBreak.create();
const txt = (s: string) => schema.text(s);

// 1 đoạn: "Dòng A<br>Dòng B<br>Dòng C" + 1 đoạn riêng "Khác"
const doc = schema.nodes.doc.create(null, [
  schema.nodes.paragraph.create(null, [txt("Dòng A"), br(), txt("Dòng B"), br(), txt("Dòng C")]),
  schema.nodes.paragraph.create(null, [txt("Khác")]),
]);

/** Vị trí ngay sau chuỗi `s` đầu tiên trong tài liệu. */
function posOf(s: string) {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(s)) found = pos + node.text.indexOf(s);
  });
  return found;
}

function headingOn(from: number, to = from) {
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
  const tr = isolateSelectedLines(state.tr);
  const { $from, $to } = tr.selection;
  tr.setBlockType($from.pos, $to.pos, schema.nodes.heading, { level: 1 });
  const blocks: string[] = [];
  tr.doc.forEach((n) => blocks.push(`${n.type.name}:${n.textContent}`));
  return blocks;
}

test("con trỏ trên 1 dòng chỉ biến dòng đó thành tiêu đề", () => {
  assert.deepEqual(headingOn(posOf("Dòng B") + 2), [
    "paragraph:Dòng A",
    "heading:Dòng B",
    "paragraph:Dòng C",
    "paragraph:Khác",
  ]);
});

test("bôi đen 1 phần dòng đầu", () => {
  assert.deepEqual(headingOn(posOf("Dòng A"), posOf("Dòng A") + 3), [
    "heading:Dòng A",
    "paragraph:Dòng BDòng C",
    "paragraph:Khác",
  ]);
});

test("bôi đen 2 dòng cuối → mỗi dòng 1 tiêu đề", () => {
  assert.deepEqual(headingOn(posOf("Dòng B"), posOf("Dòng C") + 6), [
    "paragraph:Dòng A",
    "heading:Dòng B",
    "heading:Dòng C",
    "paragraph:Khác",
  ]);
});

test("đoạn không có ngắt dòng giữ nguyên", () => {
  assert.deepEqual(headingOn(posOf("Khác") + 1), [
    "paragraph:Dòng ADòng BDòng C",
    "heading:Khác",
  ]);
});
