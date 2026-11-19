const DOC = "STANDARD.md#comments";

const ALLOWED_LINE = [
  /^\s*why:\s+\S/i,
  /^\s*TODO\(#\d+\):\s+\S/,
  /^\s*(eslint|oxlint)-(disable|enable)(-next-line|-line)?\b/,
  /^\s*@ts-expect-error\s+--?\s*\S/,
  /^\/\s*<reference\b/,
  /^\s*#(region|endregion)\b/,
];

const isAllowed = (comment, sourceCode) => {
  if (comment.type === "Block" && comment.value.startsWith("*")) {
    return isDocOnExport(comment, sourceCode);
  }
  return ALLOWED_LINE.some((pattern) => pattern.test(comment.value));
};

const isDocOnExport = (comment, sourceCode) => {
  const next = sourceCode.getTokenAfter(comment, { includeComments: false });
  return next !== null && next.value === "export";
};

const noComments = {
  meta: {
    type: "suggestion",
    docs: { description: "Allow only comments that carry what code, types and lint cannot." },
    schema: [],
    messages: {
      comment:
        "Delete this comment. Comments go stale: rename the code so it explains itself, or put the rule in a lint message. Allowed: JSDoc on an export, `why: …`, `TODO(#123): …`, a disable with a reason (" +
        DOC +
        ").",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Shebang" || isAllowed(comment, sourceCode)) {
            continue;
          }
          context.report({ loc: comment.loc, messageId: "comment" });
        }
      },
    };
  },
};

const DISABLE = /^\s*(eslint|oxlint)-disable(-next-line|-line)?\b(.*)$/s;

const disableNeedsReason = {
  meta: {
    type: "problem",
    docs: { description: "A lint disable says which rule and why." },
    schema: [],
    messages: {
      reason:
        "Name the rule and say why: `oxlint-disable-next-line rule-name -- reason`. A silent disable hides the next real problem (STANDARD.md#disabling-a-rule).",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE.exec(comment.value);
          if (match === null) {
            continue;
          }
          const [rules, reason] = match[3].split(/\s--\s/);
          if (rules.trim() === "" || reason === undefined || reason.trim() === "") {
            context.report({ loc: comment.loc, messageId: "reason" });
          }
        }
      },
    };
  },
};

// oxlint-disable-next-line import/no-default-export -- Oxlint loads a JS plugin from its default export
export default {
  meta: { name: "house", version: "0.1.0" },
  rules: {
    "no-comments": noComments,
    "disable-needs-reason": disableNeedsReason,
  },
};
