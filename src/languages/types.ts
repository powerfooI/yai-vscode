import * as vscode from 'vscode';


export abstract class Yai {
  protected verbose: boolean = false
  protected enableCustomInput: boolean = false
  protected indexExclude: string[] = []
  protected wsConfig = vscode.workspace.getConfiguration()

  private configs = {
    verbose: "yai.verbose",
    enableCustomInput: "yai.enableCustomInput",
    indexExclude: "yai.indexExclude",
  }

  constructor() {
    this.getExtensionConfig()
  }

  private getExtensionConfig() {
    this.verbose = this.wsConfig.get<boolean>(this.configs.verbose) ?? false
    this.enableCustomInput = this.wsConfig.get<boolean>(this.configs.enableCustomInput) ?? false
    this.indexExclude = this.wsConfig.get<string[]>(this.configs.indexExclude) ?? []
  }

  /**
   * index is the function that indexes the current workspace and loads the dependencies
   */
  public async index() { }

  /**
   * import imports desired dependencies into current file
   */
  public async import() { }

  /**
   * importPrevious imports previously imported dependencies into current file
   */
  public async importPrevious() { }
}

