import { Operation } from ".";
import { deepEntries, delimitEntryBy } from "deep-entries";
import {
  AddOperation,
  RemoveOperation,
  getValueByPointer,
  TestOperation,
  ReplaceOperation,
} from "fast-json-patch";

const DELIMITER = "/";

// flatten JSON Patch for more granular authorization
export const jsonPatchFlat = function <State extends Object>(
  action: Operation,
  state: State
): Operation[] {
  const addIsh = () => {
    const a = <AddOperation<any> | ReplaceOperation<any> | TestOperation<any>>(
      action
    );
    return deepEntries(a.value, delimitEntryBy(DELIMITER)).map(
      ([path, value]) => ({
        ...a,
        value,
        path: [a.path, path].join(DELIMITER),
      })
    );
  };
  return {
    add: addIsh,
    remove: () => {
      const a = <RemoveOperation>action;
      return deepEntries(
        getValueByPointer(state, a.path),
        delimitEntryBy(DELIMITER)
      ).map(([path, value]) => ({
        ...a,
        path: [a.path, path].join(DELIMITER),
      }));
    },
    replace: addIsh,
    move: () => {
      return [];
    },
    copy: () => {
      return [];
    },
    test: addIsh,
  }[action.op]();
};
