const AGENT_PROMPT = `
You are a voice-based AI productivity agent.
You can respond conversationally, but when the user wants to manage tasks or save/recall important details, use tools.
Available tools:
- addTodo(title, dueDate)
- updateTodo(idOrText, updates)
- deleteTodo(idOrText)
- listTodos()
- saveMemory(text)
- recallMemory(query)
Always keep responses short because they are spoken aloud.
`;

const STORAGE_KEYS = {
  todos: "voice-agent.todos",
  memories: "voice-agent.memories",
  toolCalls: "voice-agent.toolCalls",
  theme: "voice-agent.theme"
};

const state = {
  todos: load(STORAGE_KEYS.todos, []).map((todo) => ({
    ...todo,
    title: cleanTitle(todo.title)
  })),
  memories: load(STORAGE_KEYS.memories, []),
  toolCalls: load(STORAGE_KEYS.toolCalls, []),
  recognition: null,
  isListening: false,
  shouldKeepListening: false,
  isSpeaking: false,
  pendingVoiceText: "",
  voiceFinalizeTimer: null
};

const elements = {
  voiceBtn: document.querySelector("#voiceBtn"),
  voiceBtnText: document.querySelector("#voiceBtnText"),
  statusText: document.querySelector("#statusText"),
  transcriptText: document.querySelector("#transcriptText"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  chatLog: document.querySelector("#chatLog"),
  todoList: document.querySelector("#todoList"),
  todoCount: document.querySelector("#todoCount"),
  memoryList: document.querySelector("#memoryList"),
  memoryCount: document.querySelector("#memoryCount"),
  toolLog: document.querySelector("#toolLog"),
  themeToggleBtn: document.querySelector("#themeToggleBtn"),
  resetDataBtn: document.querySelector("#resetDataBtn")
};

const TODO_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "have",
  "has",
  "to",
  "do",
  "my",
  "please",
  "edit",
  "button"
]);

const tools = {
  addTodo({ title, dueDate = "" }) {
    const todo = {
      id: crypto.randomUUID(),
      title: cleanTitle(title),
      dueDate,
      done: false,
      createdAt: new Date().toISOString()
    };
    state.todos.unshift(todo);
    persist();
    return `Added To-Do: ${todo.title}${dueDate ? `, due ${dueDate}` : ""}.`;
  },

  updateTodo({ target, title, dueDate, done }) {
    const todo = findTodo(target);
    if (!todo) return `I could not find a To-Do matching "${target}".`;

    if (typeof title === "string" && title.trim()) todo.title = cleanTitle(title);
    if (typeof dueDate === "string") todo.dueDate = dueDate;
    if (typeof done === "boolean") todo.done = done;
    persist();
    return `Updated To-Do: ${todo.title}.`;
  },

  deleteTodo({ target }) {
    const todo = findTodo(target);
    if (!todo) return `I could not find a To-Do matching "${target}".`;

    state.todos = state.todos.filter((item) => item.id !== todo.id);
    persist();
    return `Deleted To-Do: ${todo.title}.`;
  },

  listTodos() {
    if (!state.todos.length) return "Your To-Do list is empty.";
    const openTodos = state.todos.filter((todo) => !todo.done);
    if (!openTodos.length) return "All To-Do items are completed.";
    return `You have ${openTodos.length} active To-Do item${openTodos.length === 1 ? "" : "s"}: ${openTodos
      .map((todo) => todo.title)
      .join(", ")}.`;
  },

  saveMemory({ text }) {
    const memory = {
      id: crypto.randomUUID(),
      text: cleanMemory(text),
      createdAt: new Date().toISOString()
    };
    state.memories.unshift(memory);
    persist();
    return `I will remember: ${memory.text}.`;
  },

  recallMemory({ query = "" }) {
    if (!state.memories.length) return "I do not have any saved memories yet.";

    const normalizedQuery = normalize(query);
    const matches = normalizedQuery
      ? state.memories.filter((memory) => normalize(memory.text).includes(normalizedQuery))
      : state.memories;

    const selected = matches.length ? matches : state.memories;
    return `I remember: ${selected
      .slice(0, 3)
      .map((memory) => memory.text)
      .join("; ")}.`;
  }
};

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-theme", nextTheme === "dark");
  elements.themeToggleBtn.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
  elements.themeToggleBtn.setAttribute("aria-pressed", String(nextTheme === "dark"));
  save(STORAGE_KEYS.theme, nextTheme);
}

function persist() {
  save(STORAGE_KEYS.todos, state.todos);
  save(STORAGE_KEYS.memories, state.memories);
  save(STORAGE_KEYS.toolCalls, state.toolCalls);
  render();
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\bedit\b/gi, "")
    .replace(/^(and\s+)?(i\s+have\s+to|i\s+need\s+to|need\s+to|must|remind\s+me\s+to)\s+/i, "")
    .replace(/^(and\s+)?i\s+have\s+(a|an|the)?\s*/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMemory(value) {
  return String(value || "")
    .replace(/^that\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findTodo(target) {
  const normalizedTarget = normalize(target);
  if (!normalizedTarget) return null;

  const exactMatch =
    state.todos.find((todo) => todo.id === target) ||
    state.todos[Number(target) - 1] ||
    state.todos.find((todo) => normalize(todo.title) === normalizedTarget) ||
    state.todos.find((todo) => normalize(todo.title).includes(normalizedTarget));

  if (exactMatch) return exactMatch;

  const targetTokens = getTodoMatchTokens(target);
  if (!targetTokens.length) return null;

  const scoredMatches = state.todos
    .map((todo) => {
      const todoTokens = getTodoMatchTokens(todo.title);
      const overlap = targetTokens.filter((token) => todoTokens.includes(token)).length;
      const score = overlap / Math.max(targetTokens.length, todoTokens.length);

      return { todo, overlap, score };
    })
    .filter((match) => match.overlap > 0)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap);

  const bestMatch = scoredMatches[0];
  if (!bestMatch || bestMatch.score < 0.34) return null;

  return bestMatch.todo;
}

function getTodoMatchTokens(value) {
  return normalize(value)
    .replace(/\b(assignments?|projects?)\b/g, "task")
    .replace(/\bmeetings?\b/g, "meeting")
    .replace(/\bsubmitting\b/g, "submit")
    .split(" ")
    .filter((token) => token && !TODO_STOP_WORDS.has(token));
}

function detectDueDate(text) {
  const lower = text.toLowerCase();
  if (lower.includes("today")) return "today";
  if (lower.includes("tomorrow")) return "tomorrow";
  if (lower.includes("next week")) return "next week";
  const dateMatch = text.match(/\b(?:on|by|due)\s+([a-z]+\s+\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i);
  return dateMatch ? dateMatch[1] : "";
}

function removeCommandWords(text, words) {
  let cleaned = text;
  words.forEach((word) => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  });
  return cleaned.replace(/\b(today|tomorrow|next week)\b/gi, " ").replace(/\s+/g, " ").trim();
}

function planAgentAction(userText) {
  const text = userText.trim();
  const lower = normalize(text);

  if (!text) {
    return { kind: "chat", response: "Please say or type a command." };
  }

  if (/\b(what do you remember|recall|my memory|remember about)\b/i.test(text)) {
    const query = text.replace(/.*\b(about|for)\b/i, "").trim();
    return {
      kind: "tool",
      name: "recallMemory",
      args: { query }
    };
  }

  if (/\b(remember|note|save this|important)\b/i.test(text)) {
    const memoryText = text.replace(/^(please\s+)?(remember|note|save this|important)\s*(that)?\s*/i, "");
    return {
      kind: "tool",
      name: "saveMemory",
      args: { text: memoryText || text }
    };
  }

  if (/\b(add|create|new|put)\b.*\b(todo|task|to do|list)\b/i.test(text) || /^(add|create|new)\b/i.test(text)) {
    const dueDate = detectDueDate(text);
    const title = removeCommandWords(text, ["please", "add", "create", "new", "put", "todo", "task", "to", "do", "list", "due", "by", "on"]);
    return {
      kind: "tool",
      name: "addTodo",
      args: { title: title || text, dueDate }
    };
  }

  if (/\b(i have to|i need to|need to|must|remind me to)\b/i.test(text)) {
    const dueDate = detectDueDate(text);
    const title = text
      .replace(/^(and\s+)?(please\s+)?/i, "")
      .replace(/\b(i have to|i need to|need to|must|remind me to)\b/i, "")
      .replace(/\b(today|tomorrow|next week)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      kind: "tool",
      name: "addTodo",
      args: { title: title || text, dueDate }
    };
  }

  if (/\b(show|list|read|what are|what is|tell me)\b.*\b(todo|todos|tasks|to do|list)\b/i.test(text)) {
    return {
      kind: "tool",
      name: "listTodos",
      args: {}
    };
  }

  if (/\b(delete|remove|clear)\b/i.test(text)) {
    const target = removeCommandWords(text, ["please", "delete", "remove", "clear", "todo", "task", "to", "do"]);
    return {
      kind: "tool",
      name: "deleteTodo",
      args: { target }
    };
  }

  if (/\b(mark|complete|finish|done)\b/i.test(text)) {
    const target = removeCommandWords(text, ["please", "mark", "complete", "finish", "done", "as", "todo", "task", "to", "do"]);
    return {
      kind: "tool",
      name: "updateTodo",
      args: { target, done: true }
    };
  }

  if (/\b(update|change|rename)\b/i.test(text)) {
    const targetMatch = text.match(/\b(?:update|change|rename)\s+(.+?)\s+\b(?:to|as)\b\s+(.+)/i);
    return {
      kind: "tool",
      name: "updateTodo",
      args: targetMatch
        ? { target: targetMatch[1], title: targetMatch[2] }
        : { target: text.replace(/^(update|change|rename)\s+/i, ""), dueDate: detectDueDate(text) }
    };
  }

  if (/\b(hello|hi|hey)\b/.test(lower)) {
    return { kind: "chat", response: "Hi. I can manage your To-Do list and remember important details." };
  }

  return {
    kind: "chat",
    response:
      "I can help with To-Dos and memory. Try saying: add meeting tomorrow, mark meeting done, remember my project topic, or what do you remember?"
  };
}

function executeTool(name, args) {
  const result = tools[name](args);
  state.toolCalls.unshift({
    id: crypto.randomUUID(),
    name,
    args,
    result,
    createdAt: new Date().toISOString()
  });
  state.toolCalls = state.toolCalls.slice(0, 20);
  persist();
  return result;
}

function handleUserMessage(text, source = "typed") {
  appendMessage("user", text);
  elements.transcriptText.textContent = source === "voice" ? `Heard: “${text}”` : `Typed: “${text}”`;

  const action = planAgentAction(text);
  const response = action.kind === "tool" ? executeTool(action.name, action.args) : action.response;

  appendMessage("agent", response);
  speak(response);
}

function queueVoiceTranscript(text) {
  const cleanedText = text.trim();
  if (!cleanedText) return;

  state.pendingVoiceText = `${state.pendingVoiceText} ${cleanedText}`.replace(/\s+/g, " ").trim();
  elements.transcriptText.textContent = `Listening: “${state.pendingVoiceText}”`;

  window.clearTimeout(state.voiceFinalizeTimer);
  state.voiceFinalizeTimer = window.setTimeout(finalizePendingVoiceInput, 1500);
}

function finalizePendingVoiceInput() {
  const finalText = state.pendingVoiceText.trim();
  window.clearTimeout(state.voiceFinalizeTimer);
  state.voiceFinalizeTimer = null;
  state.pendingVoiceText = "";

  if (!finalText) return;

  handleUserMessage(finalText, "voice");
}

function appendMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  elements.chatLog.appendChild(message);
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const shouldResumeAfterSpeaking = state.shouldKeepListening;
  state.isSpeaking = true;
  if (state.recognition && state.isListening) {
    state.recognition.stop();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => {
    state.isSpeaking = false;
    if (shouldResumeAfterSpeaking) {
      window.setTimeout(startVoiceInput, 350);
    }
  };
  utterance.onerror = () => {
    state.isSpeaking = false;
  };
  window.speechSynthesis.speak(utterance);
}

function startVoiceInput() {
  if (!state.recognition) return;

  state.shouldKeepListening = true;
  window.speechSynthesis?.cancel();

  if (state.isListening) return;

  try {
    state.recognition.start();
  } catch (error) {
    if (error.name !== "InvalidStateError") {
      elements.statusText.textContent = "Could not start voice input. Try again or type the command.";
    }
  }
}

function stopVoiceInput() {
  state.shouldKeepListening = false;
  state.isSpeaking = false;
  window.speechSynthesis?.cancel();

  if (!state.recognition || !state.isListening) {
    updateVoiceIdleState();
    return;
  }

  state.recognition.stop();
}

function updateVoiceListeningState() {
  elements.voiceBtn.classList.add("listening");
  elements.voiceBtnText.textContent = "Stop Voice";
  elements.voiceBtn.setAttribute("aria-label", "Stop voice input");
  elements.statusText.textContent = "Listening. Speak a command or click Stop Voice.";
}

function updateVoiceIdleState() {
  elements.voiceBtn.classList.remove("listening");
  elements.voiceBtnText.textContent = "Start Voice";
  elements.voiceBtn.setAttribute("aria-label", "Start voice input");
  elements.statusText.textContent = "Ready. Speak or type a task.";
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.statusText.textContent = "Voice input is not supported in this browser. Use Chrome or type below.";
    elements.voiceBtn.disabled = true;
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = "en-IN";
  state.recognition.interimResults = true;
  state.recognition.continuous = true;

  state.recognition.onstart = () => {
    state.isListening = true;
    updateVoiceListeningState();
  };

  state.recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;

      if (event.results[index].isFinal) {
        finalTranscript += ` ${transcript}`;
      } else {
        interimTranscript += ` ${transcript}`;
      }
    }

    if (finalTranscript.trim()) {
      queueVoiceTranscript(finalTranscript);
      return;
    }

    if (interimTranscript.trim()) {
      const previewText = `${state.pendingVoiceText} ${interimTranscript}`.replace(/\s+/g, " ").trim();
      elements.transcriptText.textContent = `Listening: “${previewText}”`;
    }
  };

  state.recognition.onerror = (event) => {
    if (event.error === "no-speech") {
      elements.statusText.textContent = "Still listening. Speak a little louder or move closer to the mic.";
      return;
    }

    state.shouldKeepListening = false;
    elements.statusText.textContent = `Voice error: ${event.error}. You can type the same command.`;
  };

  state.recognition.onend = () => {
    state.isListening = false;
    finalizePendingVoiceInput();

    if (state.shouldKeepListening && !state.isSpeaking) {
      window.setTimeout(startVoiceInput, 350);
      return;
    }

    updateVoiceIdleState();
  };
}

function render() {
  renderTodos();
  renderMemories();
  renderToolCalls();
}

function renderTodos() {
  elements.todoCount.textContent = `${state.todos.length} item${state.todos.length === 1 ? "" : "s"}`;
  elements.todoList.innerHTML = "";

  if (!state.todos.length) {
    elements.todoList.innerHTML = '<li class="empty-state">No To-Do items yet.</li>';
    return;
  }

  state.todos.forEach((todo, index) => {
    const li = document.createElement("li");
    li.className = `todo-item ${todo.done ? "done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => {
      executeTool("updateTodo", { target: todo.id, done: checkbox.checked });
    });

    const content = document.createElement("div");
    const title = document.createElement("p");
    title.className = "todo-title";
    title.textContent = `${index + 1}. ${todo.title}`;
    const meta = document.createElement("p");
    meta.className = "todo-meta";
    meta.textContent = todo.dueDate ? `Due: ${todo.dueDate}` : "No due date";
    content.append(title, meta);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mini-button";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      const response = executeTool("deleteTodo", { target: todo.id });
      appendMessage("agent", response);
      speak(response);
    });

    li.append(checkbox, content, deleteBtn);
    elements.todoList.appendChild(li);
  });
}

function renderMemories() {
  elements.memoryCount.textContent = `${state.memories.length} saved`;
  elements.memoryList.innerHTML = "";

  if (!state.memories.length) {
    elements.memoryList.innerHTML = '<li class="empty-state">No important memories saved yet.</li>';
    return;
  }

  state.memories.forEach((memory) => {
    const li = document.createElement("li");
    li.className = "memory-item";
    const text = document.createElement("p");
    text.textContent = memory.text;
    const time = document.createElement("div");
    time.className = "memory-time";
    time.textContent = new Date(memory.createdAt).toLocaleString();
    li.append(text, time);
    elements.memoryList.appendChild(li);
  });
}

function renderToolCalls() {
  elements.toolLog.innerHTML = "";
  if (!state.toolCalls.length) {
    elements.toolLog.innerHTML = '<li class="empty-state">No tool calls yet.</li>';
    return;
  }

  state.toolCalls.forEach((call) => {
    const li = document.createElement("li");
    li.textContent = `${call.name}(${JSON.stringify(call.args)}) -> ${call.result}`;
    elements.toolLog.appendChild(li);
  });
}

elements.voiceBtn.addEventListener("click", () => {
  if (!state.recognition) return;

  if (state.shouldKeepListening) {
    stopVoiceInput();
    return;
  }

  startVoiceInput();
});

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.messageInput.value.trim();
  if (!text) return;
  elements.messageInput.value = "";
  handleUserMessage(text);
});

elements.resetDataBtn.addEventListener("click", () => {
  state.todos = [];
  state.memories = [];
  state.toolCalls = [];
  persist();
  elements.chatLog.innerHTML = "";
  appendMessage("agent", "Data reset. I am ready for a fresh demo.");
});

elements.themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
  setTheme(nextTheme);
});

setTheme(load(STORAGE_KEYS.theme, "light"));
setupSpeechRecognition();
render();
appendMessage("agent", "Hello. I can manage To-Dos with tools and remember important details from your conversation.");
