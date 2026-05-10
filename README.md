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

