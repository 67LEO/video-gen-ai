export interface ScriptScene {
  description: string
  visualPrompt: string
  audioText?: string
  duration: number
}

export interface ScriptResult {
  scenes: ScriptScene[]
  voiceoverDescription: string
}
