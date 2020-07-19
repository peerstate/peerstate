import { Operation } from ".";
import { deepEntries, delimitEntryBy } from "deep-entries";
import { AddOperation } from "fast-json-patch";

const DELIMITER = "/";

export const jsonPatchFlat = (action: Operation): Operation[] => {
  return {
    add: () => {
      const a = <AddOperation<any>>action;
      return deepEntries(a.value, delimitEntryBy(DELIMITER)).map(
        ([path, value]) => ({
          ...a,
          value,
          path: [a.path, path].join(DELIMITER),
        })
      );
    },
    remove: () => {
      return [];
    },
    replace: () => {
      return [];
    },
    move: () => {
      return [];
    },
    copy: () => {
      return [];
    },
    test: () => {
      return [];
    },
  }[action.op]();
};
