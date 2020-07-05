import { Operation, Validator, applyOperation } from "fast-json-patch";

export const jsonPatchReducer = function <T>(
  state: T,
  action: Operation,
  validator?: Validator<T>
): T {
  // use default validator, don't mutate the document, ban prototype modifications
  return applyOperation(state, action, validator || true, false, true)
    .newDocument;
};
