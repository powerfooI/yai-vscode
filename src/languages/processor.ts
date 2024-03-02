import * as vscode from 'vscode'
import * as path from 'path'
import { pathExists } from './utils'
import { GolangProcessor } from './golang'

export enum SupportedLanguages {
  Golang = "golang",
  ECMAScript = "ecmascript",
}

interface InnerProcessor {
  index(): void
  import(): void
}

export interface LanguageProcessor extends InnerProcessor {
  getLanguageIDs(): string[]
}

const languageMapping: Record<string, string> = {
	javascript: 'ecmascript',
	typescript: 'ecmascript',
	javascriptreact: 'ecmascript',
	typescriptreact: 'ecmascript',
	go: 'golang',
}

const langIDMapping: Record<string, string[]> = {
  [SupportedLanguages.Golang]: ['go'],
  [SupportedLanguages.ECMAScript]: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
}

export class YAIProcessor implements LanguageProcessor {
  private language: SupportedLanguages | undefined
  private inner: InnerProcessor | undefined
  constructor(
    private context: vscode.ExtensionContext
  ) {
    const ws = vscode.workspace.workspaceFolders![0]
    if (pathExists(path.join(ws.uri.path, 'go.mod'))) {
      this.language = SupportedLanguages.Golang
      this.inner = new GolangProcessor(context)
    } else if (pathExists(path.join(ws.uri.path, 'package.json'))) {
      this.language = SupportedLanguages.ECMAScript
      // TODO: 
      // this.inner = new NodeDependenciesProvider(context)
    }
  }

  public index() {
    this.inner?.index()
  }

  public import() {
    this.inner?.import()
  }

  public getLanguageIDs(): string[] {
    if (!this.language) {
      return []
    }
    return langIDMapping[this.language]
  }
}