import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const failures = [];
const todoModule = loadTypeScriptModule("src/domain/todo-widget.ts");

verifyDragReordering(todoModule);
verifyPersistedOrdering(todoModule);

if (failures.length > 0) {
  console.error("Todo widget verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Todo widget ordering verified.");

function verifyDragReordering(todo) {
  const original = [
    todo.createTodoItem("todo-a", "A", 1),
    todo.createTodoItem("todo-b", "B", 2),
    todo.createTodoItem("todo-c", "C", 3)
  ];
  const moved = [original[1], original[2], original[0]];
  const renumbered = todo.renumberTodoItems(moved);

  expectEqual(readIds(renumbered), "todo-b,todo-c,todo-a", "renumbering should preserve the drag result array order");
  expectEqual(readOrders(renumbered), "1,2,3", "renumbering should assign contiguous order values");
  expectEqual(readOrders(original), "1,2,3", "renumbering should not mutate source items");

  const roundTrip = todo.readTodoItems({ items: renumbered });
  expectEqual(readIds(roundTrip), "todo-b,todo-c,todo-a", "drag order should survive config normalization");
}

function verifyPersistedOrdering(todo) {
  const normalized = todo.normalizeTodoConfig({
    items: [
      { id: "todo-third", title: "Third", completed: false, order: 30 },
      { id: "todo-first", title: "First", completed: false, order: 10 },
      { id: "todo-second", title: "Second", completed: true, order: 20 }
    ]
  });

  expectEqual(readIds(normalized.items), "todo-first,todo-second,todo-third", "stored order values should control initial read order");
  expectEqual(readOrders(normalized.items), "1,2,3", "stored items should be normalized to contiguous order values");
}

function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const sandbox = {
    module: { exports: {} },
    exports: {}
  };

  vm.runInNewContext(transpiled, sandbox, { filename: relativePath });
  return sandbox.exports;
}

function readIds(items) {
  return items.map((item) => item.id).join(",");
}

function readOrders(items) {
  return items.map((item) => item.order).join(",");
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
