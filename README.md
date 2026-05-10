# Voice-Based AI Agent With Memory & Tools

This project is a browser-based voice agent for the assignment. It accepts voice input, converts speech to text, decides whether to call a tool, manages a To-Do list, stores important memories, recalls saved memories, and speaks the response back to the user.

## What The Project Does

- Voice input: uses the browser Web Speech API to listen to your command.
- Speech output: uses browser text-to-speech to reply aloud.
- To-Do tools: supports add, update, delete, complete, and list actions.
- Memory: saves important facts/events and recalls them later.
- Agent behavior: decides whether to call a tool or reply conversationally.
- Tool call log: shows which function was called, with arguments and result.

## How To Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Use Google Chrome for the best voice recognition support.

## Commands To Try

- "Add submit AI assignment tomorrow"
- "Add meeting with sir today"
- "List my tasks"
- "Mark submit AI assignment done"
- "Update meeting with sir to project review with sir"
- "Delete project review with sir"
- "Remember that my final project topic is a voice based AI agent"
- "What do you remember?"

## Important Code Files

- `server.js`: starts the local web server.
- `public/index.html`: page structure.
- `public/styles.css`: app design.
- `public/app.js`: voice handling, agent prompt, tool calling logic, To-Do tools, memory tools, and text-to-speech.

## Demo Video Script

Record a 6-10 minute video with your face and screen.

1. Introduce the project: "This is a voice-based AI agent with memory and tools. It manages To-Do tasks and remembers important user events."
2. Show the UI and explain the three panels: chat, To-Do tools, memory, and tool calls.
3. Click Start Voice and say: "Add submit AI assignment tomorrow."
4. Show that the To-Do was added and the tool log displays `addTodo`.
5. Say: "Add meeting with sir today."
6. Say: "List my tasks" and show that the agent reads the list.
7. Say: "Mark submit AI assignment done" and show the task is completed.
8. Say: "Remember that my project topic is voice based AI agent with memory and tools."
9. Say: "What do you remember?" and show memory recall.
10. Explain code briefly from `public/app.js`: `AGENT_PROMPT`, `tools`, `planAgentAction`, `setupSpeechRecognition`, and `speak`.

## Assignment Criteria Mapping

| Criteria | Where It Is Implemented |
| --- | --- |
| Voice interaction | `setupSpeechRecognition()` and `speak()` in `public/app.js` |
| Tool usage CRUD | `tools.addTodo`, `tools.updateTodo`, `tools.deleteTodo`, `tools.listTodos` |
| Memory implementation | `tools.saveMemory`, `tools.recallMemory`, browser `localStorage` |
| Prompt quality | `AGENT_PROMPT` in `public/app.js` |
| Code structure | Separate server, HTML, CSS, and JS files |
| Demo clarity | README demo script |
