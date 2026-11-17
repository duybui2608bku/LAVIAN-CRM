import type { Transaction } from "@tiptap/pm/state";

/**
 * Nội dung dán từ web/Word (hoặc Shift+Enter) hay để nhiều "dòng" trong CÙNG 1 đoạn, ngăn bằng ngắt dòng (hardBreak).
 * Đổi H1/danh sách áp cho cả đoạn → cả loạt dòng bị đổi theo. Hàm này tách đoạn tại các ngắt dòng bao quanh
 * và nằm trong vùng chọn (ngắt dòng → đoạn mới), để thao tác khối sau đó chỉ chạm đúng các dòng đang chọn.
 * Vùng chọn trải nhiều khối thì giữ nguyên.
 */
export function isolateSelectedLines(tr: Transaction): Transaction {
  const { $from, $to } = tr.selection;
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return tr;

  const start = $from.start();
  const breaks: number[] = [];
  $from.parent.forEach((node, offset) => {
    if (node.type.name === "hardBreak") breaks.push(start + offset);
  });
  const before = breaks.filter((p) => p < $from.pos).at(-1); // ngắt dòng ngay trước dòng đầu được chọn
  const after = breaks.find((p) => p >= $to.pos); // ngắt dòng ngay sau dòng cuối được chọn
  const cut = breaks.filter((p) => (before === undefined || p >= before) && (after === undefined || p <= after));

  // Tách từ cuối lên để vị trí phía trước không bị lệch.
  for (const pos of cut.reverse()) tr.delete(pos, pos + 1).split(pos);
  return tr;
}
