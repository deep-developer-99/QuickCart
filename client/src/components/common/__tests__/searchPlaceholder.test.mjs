import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceTypewriter, getSearchPhrases, normalizeSearchPhrase, splitSearchPhrase,
} from "../searchPlaceholder.ts";

test("erases one grapheme at a time, types in order, holds, and wraps to the first phrase", () => {
  const phrases = ["Milk", "👩🏽‍🍳", "Eggs"].map(splitSearchPhrase);
  const lengths = phrases.map((phrase) => phrase.length);
  let frame = { index: 0, length: lengths[0], phase: "hold" };
  const display = () => [phrases[frame.index].slice(0, frame.length).join(""), frame.phase];
  const actual = [display()];
  for (let step = 0; step < 14; step++) {
    frame = advanceTypewriter(frame, lengths);
    actual.push(display());
  }
  assert.deepEqual(actual, [
    ["Milk", "hold"], ["Mil", "delete"], ["Mi", "delete"], ["M", "delete"], ["", "type"],
    ["👩🏽‍🍳", "hold"], ["", "type"], ["E", "type"], ["Eg", "type"], ["Egg", "type"],
    ["Eggs", "hold"], ["Egg", "delete"], ["Eg", "delete"], ["E", "delete"], ["", "type"],
  ]);
  for (let step = 0; step < 4; step++) frame = advanceTypewriter(frame, lengths);
  assert.deepEqual(display(), ["Milk", "hold"]);
});

test("filters inactive and duplicate display phrases while preserving the caller's order", () => {
  const suggestions = [
    { _id: "1", order: 0, phrase: "  Search for “Fresh fruits”  " },
    { _id: "2", order: 1, phrase: "fresh fruits" },
    { _id: "3", order: 2, phrase: "Milk", isActive: false },
    { _id: "4", order: 3, phrase: "Eggs" },
  ];
  assert.deepEqual(getSearchPhrases(suggestions), ["Fresh fruits", "Eggs"]);
  assert.deepEqual(getSearchPhrases([suggestions[3], suggestions[0]]), ["Eggs", "Fresh fruits"]);
  assert.deepEqual(getSearchPhrases([{ ...suggestions[0], phrase: "Bread" }]), ["Bread"]);
  assert.deepEqual(getSearchPhrases([suggestions[2]]), []);
  assert.equal(normalizeSearchPhrase("Search for Ben's ice cream"), "Ben's ice cream");
});
