import { jsonPatchFlat } from "./jsonPatchFlat";
import { Operation } from "fast-json-patch";

describe("jsonPatchFlat", () => {
  it("turns an 'add' operation into many flattened operations", () => {
    const input = {
      foo: 1,
      bar: {
        deep: {
          key: 2,
        },
      },
      baz: [
        3,
        [4, 5],
        {
          key: 6,
        },
      ],
    };
    const action: Operation = { op: "add", path: "/public/bob", value: input };
    expect(jsonPatchFlat(action)).toMatchInlineSnapshot(`
      Array [
        Object {
          "op": "add",
          "path": "/public/bob/foo",
          "value": 1,
        },
        Object {
          "op": "add",
          "path": "/public/bob/bar/deep/key",
          "value": 2,
        },
        Object {
          "op": "add",
          "path": "/public/bob/baz/0",
          "value": 3,
        },
        Object {
          "op": "add",
          "path": "/public/bob/baz/1/0",
          "value": 4,
        },
        Object {
          "op": "add",
          "path": "/public/bob/baz/1/1",
          "value": 5,
        },
        Object {
          "op": "add",
          "path": "/public/bob/baz/2/key",
          "value": 6,
        },
      ]
    `);
  });
});
