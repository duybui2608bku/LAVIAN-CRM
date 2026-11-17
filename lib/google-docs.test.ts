import assert from "node:assert/strict";
import { test } from "node:test";
import { googleDocId, googleImageSources, parseGoogleDocHtml, unwrapGoogleLink } from "./google-docs.ts";

test("googleDocId reads edit, view and /u/N links", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab";
  assert.equal(googleDocId(`https://docs.google.com/document/d/${id}/edit?usp=sharing`), id);
  assert.equal(googleDocId(`https://docs.google.com/document/u/1/d/${id}/view`), id);
  assert.equal(googleDocId("https://drive.google.com/file/d/abc/view"), null);
  assert.equal(googleDocId("hello"), null);
});

test("unwrapGoogleLink returns the real target", () => {
  assert.equal(
    unwrapGoogleLink("https://www.google.com/url?q=https://lavian.vn/a?b%3D1&amp;sa=D&amp;ust=1"),
    "https://lavian.vn/a?b=1",
  );
  assert.equal(unwrapGoogleLink("https://lavian.vn/x"), "https://lavian.vn/x");
});

test("parseGoogleDocHtml inlines bold/italic/underline classes and drops the rest", () => {
  const html = `<html><head><title>Quy tr&amp;nh</title><style>
    .c1{font-weight:700;color:#000}.c2{font-style:italic}.c3{text-decoration:underline;font-size:11pt}
    ol.lst-kix_a{list-style-type:none}.c9{background-color:#fff;padding:72pt}</style></head>
    <body class="c9 doc-content"><h1 id="h.x" class="c2">Tiêu đề</h1>
    <p class="c9"><span class="c1">Đậm</span> <span class="c3" style="color:red">Gạch</span>
    <a class="c3" href="https://www.google.com/url?q=https://a.vn&amp;sa=D">link</a></p>
    <script>alert(1)</script></body></html>`;
  const { title, body } = parseGoogleDocHtml(html);
  assert.equal(title, "Quy tr&nh");
  assert.match(body, /<h1 style="font-style:italic">Tiêu đề<\/h1>/);
  assert.match(body, /<p>/);
  assert.match(body, /<span style="font-weight:700">Đậm<\/span>/);
  assert.match(body, /<span style="text-decoration:underline">Gạch<\/span>/);
  assert.match(body, /<a href="https:\/\/a.vn" style="text-decoration:underline">link<\/a>/);
  assert.doesNotMatch(body, /script|class=|id=/);
});

test("googleImageSources only returns Google-hosted images, once each", () => {
  const body =
    '<img src="https://lh7-rt.googleusercontent.com/docsz/a?key=1"><img src="https://lh7-rt.googleusercontent.com/docsz/a?key=1">' +
    '<img src="https://cdn.example.com/b.png">';
  assert.deepEqual(googleImageSources(body), ["https://lh7-rt.googleusercontent.com/docsz/a?key=1"]);
});
