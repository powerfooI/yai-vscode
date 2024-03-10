import * as vscode from 'vscode'

/**
 * All information of a go.mod file
 */
export type GoModInfo = {
  module: string
  goVersion: string
  requirements: ModuleDependency[]
}

/**
 * Require information of a go.mod file
 */
export type ModuleDependency = {
  name: string
  version: string
  indirect?: boolean
}

type ImportAlias = {
  alias: string,
  files: vscode.Uri[]
}

export type IndexLocalGoFiles = {
  localImports: LocalModuleImport[]
  localSubPackages: LocalSubPackage[]
}

export type LocalSubPackage = string

export enum LocalModuleImportType {
  Local = 'local',
  Deps = 'deps'
}

export class LocalModuleImport {
  public aliases: ImportAlias[] = []
  private aliasesNames: Set<string> = new Set()

  constructor(
    private context: vscode.ExtensionContext,
    public readonly type: LocalModuleImportType,
    public readonly name: string,
    public readonly version: string,
  ) {
    this.aliases = context.workspaceState.get(`${this.name}-${this.version}-aliases`, [])
    this.aliases.forEach(alias => this.aliasesNames.add(alias.alias))
  }

  public addAlias(alias: string, file: vscode.Uri) {
    if (this.name === '//') {
      console.log('alias', alias, file.path)
    }
    const found = this.aliases.find(a => a.alias === alias)
    if (found) {
      found.files.push(file)
    } else {
      this.aliases.push({ alias, files: [file] })
      this.aliasesNames.add(alias)
    }
  }

  public removeAlias(alias: string, file: vscode.Uri) {
    if (!this.aliasesNames.has(alias)) {
      return
    }
    const found = this.aliases.find(a => a.alias === alias)
    if (found) {
      found.files = found.files.filter(f => f.path !== file.path)
      if (found.files.length === 0) {
        this.aliases = this.aliases.filter(a => a.alias !== alias)
        this.aliasesNames.delete(alias)
      }
    }
  }

  public storeAliases() {
    this.context.workspaceState.update(`${this.name}-${this.version}-aliases`, this.aliases)
  }
}