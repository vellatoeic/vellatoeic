// LC 음원·특강 자료 링크 검사 (DB 없이)
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMaterialLink, cleanMaterialTitle, isDriveLink } from "@/lib/materialLink";

test("링크: https 주소만 받고 앞뒤 공백·꺾쇠는 지워요", () => {
  assert.equal(cleanMaterialLink("  https://drive.google.com/file/d/abc/view?usp=sharing  "), "https://drive.google.com/file/d/abc/view?usp=sharing");
  assert.equal(cleanMaterialLink("<https://drive.google.com/drive/folders/xyz>"), "https://drive.google.com/drive/folders/xyz");
  assert.equal(cleanMaterialLink("http://drive.google.com/file/d/abc"), null);
  assert.equal(cleanMaterialLink("javascript:alert(1)"), null);
  assert.equal(cleanMaterialLink("drive.google.com/file/d/abc"), null);
  assert.equal(cleanMaterialLink(""), null);
});

test("제목: 공백 정리, 비면 null, 200자까지", () => {
  assert.equal(cleanMaterialTitle("  PART 1   음원 "), "PART 1 음원");
  assert.equal(cleanMaterialTitle("   "), null);
  assert.equal(cleanMaterialTitle("가".repeat(300))?.length, 200);
});

test("구글 드라이브 링크 알아보기", () => {
  assert.equal(isDriveLink("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(isDriveLink("https://docs.google.com/document/d/abc"), true);
  assert.equal(isDriveLink("https://example.com/a.zip"), false);
});
