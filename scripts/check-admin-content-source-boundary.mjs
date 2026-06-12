import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = path.resolve('.');
const adminConsoleDir = path.join(projectRoot, 'src/lib/admin-console');
const adminContentApiDir = path.join(projectRoot, 'src/pages/api/admin/content');

const toProjectPath = (filePath) => path.relative(projectRoot, filePath).split(path.sep).join('/');

const normalizeComparablePath = (filePath) =>
  path.normalize(filePath).replace(/\.(?:astro|mjs|js|tsx|ts)$/u, '');

const forbiddenResolvedModules = new Map([
  [normalizeComparablePath(path.join(projectRoot, 'src/lib/content.ts')), 'public content module import'],
  [normalizeComparablePath(path.join(projectRoot, 'src/lib/bits.ts')), 'public bits module import']
]);

const forbiddenSourcePatterns = [
  {
    label: 'astro content entry type',
    pattern: /\b(?:EssayEntry|BitsEntry|MemoEntry|CollectionEntry)\b/gu
  },
  {
    label: 'public content query',
    pattern: /\b(?:getSortedEssays|getSortedBits|getPublished|getEssayDerivedText|getBitsDerivedText|getMemoDerivedText|getEssaySlug|getBitSlug)\b/gu
  }
];

const failures = [];

const getLineNumber = (source, index) => source.slice(0, index).split(/\r\n|\r|\n/u).length;

const listFiles = async (directory, predicate) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(directory, entry.name));
};

const getCheckedFiles = async () => {
  const adminConsoleContentFiles = await listFiles(adminConsoleDir, (name) =>
    /^content.*\.ts$/u.test(name)
  );
  const adminContentApiFiles = await listFiles(adminContentApiDir, (name) =>
    name.endsWith('.ts')
  );

  return [...adminConsoleContentFiles, ...adminContentApiFiles].sort((left, right) =>
    toProjectPath(left).localeCompare(toProjectPath(right))
  );
};

const resolveImportSpecifier = (filePath, specifier) => {
  if (specifier === 'astro:content') return { label: 'astro:content import' };
  if (specifier.startsWith('@/')) {
    const resolvedPath = path.join(projectRoot, 'src', specifier.slice(2));
    return { label: forbiddenResolvedModules.get(normalizeComparablePath(resolvedPath)) };
  }
  if (!specifier.startsWith('.')) return { label: undefined };

  const resolvedPath = path.resolve(path.dirname(filePath), specifier);
  return { label: forbiddenResolvedModules.get(normalizeComparablePath(resolvedPath)) };
};

const addImportSpecifierFailure = (filePath, sourceFile, specifierNode) => {
  const specifier = specifierNode.text;
  const { label } = resolveImportSpecifier(filePath, specifier);
  if (!label) return;

  const { line } = sourceFile.getLineAndCharacterOfPosition(specifierNode.getStart(sourceFile));
  failures.push(`${toProjectPath(filePath)}:${line + 1}: ${label} (${JSON.stringify(specifier)})`);
};

const checkImportSpecifiers = (filePath, source) => {
  const sourceFile = ts.createSourceFile(
    toProjectPath(filePath),
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addImportSpecifierFailure(filePath, sourceFile, node.moduleSpecifier);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      addImportSpecifierFailure(filePath, sourceFile, node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const checkSourcePatterns = (filePath, source) => {
  for (const { label, pattern } of forbiddenSourcePatterns) {
    for (const match of source.matchAll(pattern)) {
      failures.push(`${toProjectPath(filePath)}:${getLineNumber(source, match.index ?? 0)}: ${label}`);
    }
  }
};

const checkedFiles = await getCheckedFiles();

for (const filePath of checkedFiles) {
  const source = await readFile(filePath, 'utf8');
  checkImportSpecifiers(filePath, source);
  checkSourcePatterns(filePath, source);
}

if (failures.length > 0) {
  console.error('[check:admin-content-source-boundary] Admin Content source boundary violations:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[check:admin-content-source-boundary] OK');
