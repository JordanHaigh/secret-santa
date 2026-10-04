import test from "node:test";
import assert from "node:assert/strict";
import { createPairings, validateRules, validateSignup, type Rule } from "../lib/exchange.ts";

const rule = (giver: string, recipient: string, type: "must" | "cant"): Rule => ({ id: `${giver}-${recipient}-${type}`, giver, recipient, type });
test("everyone gives and receives once, with no self-match", () => {
  for (let size = 2; size <= 40; size++) {
    const ids = Array.from({ length: size }, (_, i) => String(i));
    const result = createPairings(ids, []);
    assert.equal(result.length, size);
    assert.equal(new Set(result.map(p => p.giver)).size, size);
    assert.equal(new Set(result.map(p => p.recipient)).size, size);
    assert.ok(result.every(p => p.giver !== p.recipient));
  }
});
test("required and excluded directional pairings are respected", () => {
  const rules = [rule("a", "b", "must"), rule("b", "a", "cant"), rule("c", "d", "cant")];
  for (let i = 0; i < 100; i++) {
    const pairs = createPairings(["a", "b", "c", "d"], rules);
    assert.ok(pairs.some(p => p.giver === "a" && p.recipient === "b"));
    assert.ok(!pairs.some(p => p.giver === "b" && p.recipient === "a"));
    assert.ok(!pairs.some(p => p.giver === "c" && p.recipient === "d"));
  }
});
test("mutual required pairings remain possible", () => {
  assert.deepEqual(createPairings(["a", "b"], [rule("a", "b", "must"), rule("b", "a", "must")]), [{ giver: "a", recipient: "b" }, { giver: "b", recipient: "a" }]);
});
test("all fixed pairings work", () => {
  const rules = [rule("a", "b", "must"), rule("b", "c", "must"), rule("c", "a", "must")];
  assert.equal(createPairings(["a", "b", "c"], rules).length, 3);
});
test("conflicting, duplicate, self and missing-person rules fail clearly", () => {
  const ids = ["a", "b", "c"];
  assert.throws(() => validateRules(ids, [rule("a", "b", "must"), rule("a", "b", "cant")]), /required and excluded/);
  assert.throws(() => validateRules(ids, [rule("a", "b", "must"), rule("a", "c", "must")]), /two required recipients/);
  assert.throws(() => validateRules(ids, [rule("a", "c", "must"), rule("b", "c", "must")]), /same required recipient/);
  assert.throws(() => validateRules(ids, [rule("a", "b", "cant"), rule("a", "b", "cant")]), /already exists/);
  assert.throws(() => validateRules(ids, [rule("a", "a", "must")]), /themselves/);
  assert.throws(() => validateRules(ids, [rule("a", "missing", "must")]), /no longer signed up/);
});
test("too few people and impossible exclusions fail", () => {
  assert.throws(() => createPairings(["a"], []), /At least two/);
  assert.throws(() => createPairings(["a", "b"], [rule("a", "b", "cant")]), /no possible draw/);
});
test("matching agrees with exhaustive feasibility over every four-person exclusion graph", () => {
  const ids = ["a", "b", "c", "d"];
  const possible = ids.flatMap(giver => ids.filter(recipient => recipient !== giver).map(recipient => rule(giver, recipient, "cant")));
  function feasible(rules: Rule[], giverIndex = 0, used = new Set<string>()): boolean {
    if (giverIndex === ids.length) return true;
    return ids.some(recipient => {
      if (recipient === ids[giverIndex] || used.has(recipient) || rules.some(r => r.giver === ids[giverIndex] && r.recipient === recipient)) return false;
      return feasible(rules, giverIndex + 1, new Set([...used, recipient]));
    });
  }
  for (let mask = 0; mask < 1 << possible.length; mask++) {
    const rules = possible.filter((_, bit) => mask & (1 << bit));
    if (feasible(rules)) assert.equal(createPairings(ids, rules).length, ids.length);
    else assert.throws(() => createPairings(ids, rules), /no possible draw/);
  }
});
const signup = { name: "  Jordan Santa  ", email: "JORDAN@EXAMPLE.COM ", notes: "", wishes: [{ idea: "A book", link: "https://example.com/book" }] };
test("signup trims and normalises details, removes blank optional wishes", () => {
  const result = validateSignup({ ...signup, wishes: [...signup.wishes, { idea: "", link: "" }] });
  assert.equal(result.name, "Jordan Santa"); assert.equal(result.email, "jordan@example.com"); assert.equal(result.wishes.length, 1);
});
test("one idea, three ideas and more than three ideas are accepted", () => {
  for (const size of [1, 3, 6, 50]) assert.equal(validateSignup({ ...signup, wishes: Array.from({ length: size }, (_, i) => ({ idea: `Idea ${i}`, link: "" })) }).wishes.length, size);
});
test("invalid and dangerous links are rejected", () => {
  for (const link of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:password@example.com", "not a link"]) {
    assert.throws(() => validateSignup({ ...signup, wishes: [{ idea: "A book", link }] }));
  }
  assert.throws(() => validateSignup({ ...signup, wishes: [{ idea: "", link: "https://example.com" }] }), /description/);
});
test("empty names, invalid email, empty ideas and oversized submissions are rejected", () => {
  assert.throws(() => validateSignup({ ...signup, name: " " }));
  assert.throws(() => validateSignup({ ...signup, email: "not-an-email" }));
  assert.throws(() => validateSignup({ ...signup, wishes: [] }));
  assert.throws(() => validateSignup({ ...signup, notes: "x".repeat(1001) }));
  assert.throws(() => validateSignup({ ...signup, wishes: [{ idea: "x".repeat(201), link: "" }] }));
  assert.throws(() => validateSignup({ ...signup, wishes: Array.from({ length: 51 }, () => ({ idea: "Gift", link: "" })) }));
  assert.throws(() => validateSignup(null));
});
