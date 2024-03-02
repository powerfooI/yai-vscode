import { LocalModuleImport, ModuleDependency } from './types';

/** 
 * Given the content of go.mod, parse all its dependencies, including direct and indirect.
 */
export function parseGoMod(content: string): ModuleDependency[] {
  const pattern = /require\s+\(([\s\S]+?)\)/g
  const matches = content.match(pattern)
  if (!matches) {
    return []
  }

  const deps: ModuleDependency[] = []
  for (const match of matches) {
    const lines = match.split('\n').slice(1, -1).map((line) => line.trim())
    lines.forEach((line) => {
      const words = line.split(' ')
      deps.push({ name: words[0], version: words[1] })
    })
  }
  return deps
}

export type GoFileImport = {
  name: string
  alias: string
}

/**
 * Parse the content of a go file, and return all its imports.
 */
export function parseGoFile(content: string): GoFileImport[] {
  const singleImportPattern = /import (.*"\S+")/g
  const multiImportPattern = /import \([\s\S]+?\)/g

  const singleImportMatch = content.match(singleImportPattern)
  const multiImportMatch = content.match(multiImportPattern)

  const imports: GoFileImport[] = []

  if (singleImportMatch) {
    singleImportMatch.forEach((match) => {
      const words = match.replace(/import /g, '').split(' ')
      if (words.length > 1) {
        const mod = words[1].replace(/"/g, '')
        imports.push({ name: mod, alias: words[0] })
      } else {
        const mod = words[0].replace(/"/g, '')
        imports.push({ name: mod, alias: "" })
      }
    })
  } else if (multiImportMatch) {
    multiImportMatch.forEach((match) => {
      match.split('\n').slice(1, -1).forEach((line) => {
        const words = line.trim().split(' ')
        if (words.length > 1) {
          /**
           * abc "abc"
           */
          const mod = words[1].replace(/"/g, '')
          imports.push({ name: mod, alias: words[0] })
        } else {
          /**
           * "abc"
           */
          const mod = words[0].replace(/"/g, '')
          imports.push({ name: mod, alias: "" })
        }
      })
    })
  }
  return imports
}

export enum ImportPosType {
  NoImport = "NoImport",
  AlreadyImported = "AlreadyImported",
  SingleImport = "SingleImport",
  MultiImport = "MultiImport",
}

export type ImportPos = {
  type: ImportPosType
  start?: number
  end?: number
  extra?: string
}

/**
 * Judge the position of the import statement in a go file.
 * @throws an error if no package statement found in the file.
 */
export function findImportPos(content: string, module: string): ImportPos {
  const packagePattern = /package (\S+)/g
  const singleImportPattern = /import (.*"\S+")/g
  const multiImportPattern = /import \([\s\S]+?\)/g

  const packageMatch = content.match(packagePattern)
  if (!packageMatch) {
    throw new Error('No package statement found in the file')
  }
  const singleImportMatch = content.match(singleImportPattern)
  const multiImportMatch = content.match(multiImportPattern)

  let packageLineNo = 0       // line no of package xxx
  let importLineNo = 0        // line no of import [alias] "mode"
  let importStartLineNo = 0   // line no of import (
  let importEndLineNo = 0     // line no of ), pairing with importStartLineNo

  const lines = content.replace(/\/\/.*/g, '//').split('\n').map((l) => l.trim())
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(packagePattern)) {
      packageLineNo = i
    }
    if (lines[i].match(singleImportPattern)) {
      importLineNo = i
      break
    }
    if (lines[i].includes("import (")) {
      importStartLineNo = i
    }
    if (lines[i].includes(")")) {
      importEndLineNo = i
      break
    }
  }
  const maxCheckRange = Math.max(importLineNo, importEndLineNo - 1) + 1
  for (let i = 0; i < maxCheckRange; i++) {
    if (lines[i].includes(`"${module}"`)) {
      return { type: ImportPosType.AlreadyImported }
    }
  }
  if (!singleImportMatch && !multiImportMatch) {
    return {
      type: ImportPosType.NoImport,
      start: packageLineNo + 1,
      end: packageLineNo + 1,
    }
  } else if (singleImportMatch) {
    return {
      type: ImportPosType.SingleImport,
      start: importLineNo,
      end: importLineNo,
      extra: singleImportMatch[0],
    }
  } else if (multiImportMatch) {
    return {
      type: ImportPosType.MultiImport,
      start: importStartLineNo,
      end: importEndLineNo
    }
  }
  return {
    type: ImportPosType.NoImport,
    start: packageLineNo + 1,
    end: packageLineNo + 1
  }
}