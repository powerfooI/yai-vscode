import * as vscode from 'vscode'

export class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private version: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.version}`;
    this.description = this.version;
  }
}

type ImportAlias = {
  alias: string,
  files: vscode.Uri[]
}

enum LocalModuleImportType {
  Local = 'local',
  Deps = 'deps'
}

export class LocalModuleImport {
  public aliases: ImportAlias[] = []
  private aliasesNames: Set<string> = new Set()
  
  constructor(
    private context: vscode.ExtensionContext,
    public readonly type: string,
    public readonly name: string,
    public readonly version: string,
  ) {
    this.aliases = context.workspaceState.get(`${this.name}-${this.version}-aliases`, [])
    this.aliases.forEach(alias => this.aliasesNames.add(alias.alias))
  }

  public addAlias(alias: string, file: vscode.Uri) {
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