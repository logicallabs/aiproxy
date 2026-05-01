const GH_MODEL = "gpt-4o-mini",
      ORF_MODEL = "openrouter/free",
      ORD_MODEL = "deepseek/deepseek-v3:free",
      DS_MODEL = "deepseek-v4-flash";

class ChatManager {
    constructor(){this.counter = 0;};
    setSystemInstruction(){}
    prepareRequest(){}
    addModelResponse(){this.counter++;}
    clearHistory(){this.counter = 0;}
    get count() {return this.counter;}
}

class GeminiChatManager extends ChatManager {
  constructor(systemInstruction) {
    super();
    this.system_instruction = systemInstruction;
    this.history = []; // This stores the conversation "memory"
  }
  setSystemInstruction(systemInstruction) {
    this.system_instruction = systemInstruction;
  }
  prepareRequest(userPrompt) {
    this.history.push({
      role: "user",
      parts: [{ text: userPrompt }]
    });
    return {
      system_instruction: {parts: [{ text: this.system_instruction }]},
      contents: this.history
    };
  }
  addModelResponse(responseText) {
    super.addModelResponse();
    this.history.push({
      role: "model",
      parts: [{ text: responseText }]
    });
  }
  clearHistory() {
    super.clearHistory();
    this.history = [];
  }
}

class OAIChatManager extends ChatManager {
  constructor(systemInstruction, model) {
    super()
    this.model = model;
    this.system_instruction = { role: "system", content: systemInstruction };
    this.messages = [this.system_instruction];
  }
  setSystemInstruction(systemInstruction) {
    this.system_instruction.content = systemInstruction;
  }
  prepareRequest(userPrompt) {
    this.messages.push({ role: "user", content: userPrompt });
    return {
      model: this.model,
      messages: this.messages
    };
  }
  addModelResponse(responseText) {
    super.addModelResponse();
    this.messages.push({ role: "assistant", content: responseText });
  }
  clearHistory() {
    super.clearHistory();
    this.messages = [this.system_instruction];
  }
}

class ChatGPTChatManager extends OAIChatManager {
  constructor(systemInstruction) {
    super(systemInstruction, GH_MODEL);
  }
}
class ORFChatManager extends OAIChatManager {
  constructor(systemInstruction) {
    super(systemInstruction, ORF_MODEL);
  }
}
class ORDChatManager extends OAIChatManager {
  constructor(systemInstruction) {
    super(systemInstruction, ORD_MODEL);
  }
}
class DSChatManager extends OAIChatManager {
  constructor(systemInstruction) {
    super(systemInstruction, DS_MODEL);
  }
}

export {GeminiChatManager, ChatGPTChatManager, ORFChatManager as ORChatManager, DSChatManager}