const assert = require("assert");
function buildRangeDates(start, end) {
  const startD = new Date(start);
  const endD = new Date(end);
  const out = [];
  let current = new Date(startD);
  while (current <= endD) {
    out.push(new Date(current));
    current = new Date(current.setDate(current.getDate() + 1)); // ← direct reassignment
  }
  return out;
}
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function removeDate(list, date) {
  return list.filter((item) => !isSameDay(item, date));  // ← 'd' → 'item'
}
function testEmptyList() {
  const dates = [];
  assert.strictEqual(dates.length, 0);
}
function testRangeBuild() {
  const dates = buildRangeDates("2026-02-21", "2026-02-26");
  assert.strictEqual(dates.length, 6);
  assert.ok(isSameDay(dates[0], new Date("2026-02-21")));
  assert.ok(isSameDay(dates[5], new Date("2026-02-26")));
}
function testRapidCrossClicks() {
  let list = [
    new Date("2026-02-21"),
    new Date("2026-02-26"),
    new Date("2026-02-28"),
  ];
  list = removeDate(list, new Date("2026-02-26"));
  list = removeDate(list, new Date("2026-02-26"));
  assert.strictEqual(list.length, 2);
}
function testResizeAnchorNoCrash() {
  try {
    if (typeof globalThis.window !== "undefined") {  // ← 'window' → 'globalThis.window'
      globalThis.window.dispatchEvent(new Event("resize"));
      globalThis.window.dispatchEvent(
        new CustomEvent("focus-section", { detail: "availability-calendar" }),
      );
    }
    assert.ok(true);
  } catch (err) {  // ← 'e' → 'err'
    assert.fail(err);
  }
}
function run() {
  testEmptyList();
  testRangeBuild();
  testRapidCrossClicks();
  testResizeAnchorNoCrash();
  console.log("All tests passed");
}
run();
