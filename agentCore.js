import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { tools, runTool } from './tools.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `You are a knowledgeable and enthusiastic guide to the Art Institute of Chicago's collection.
When a user asks about artworks, artists, or topics, use your tools to search the collection and fetch details.
Always include the image URL when available so users can view the artwork.
Keep responses conversational but informative.`;

export function createChat() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools,
    systemInstruction: SYSTEM_INSTRUCTION
  });
  return model.startChat();
}

export async function runAgent(chat, message) {
  let response = await chat.sendMessage(message);

  for (let i = 0; i < 10; i++) {
    const candidates = response.response.candidates;
    if (!candidates?.length) return "I couldn't generate a response. Please try again.";

    const parts = candidates[0].content.parts;
    const toolCallPart = parts.find(p => p.functionCall);

    if (!toolCallPart) return response.response.text();

    const { name, args } = toolCallPart.functionCall;
    const result = await runTool(name, args);
    response = await chat.sendMessage([
      { functionResponse: { name, response: { result } } }
    ]);
  }

  return "Maximum tool call iterations reached.";
}

export async function runAgentStream(chat, message, onChunk) {
  let messages = message;

  for (let i = 0; i < 10; i++) {
    const streamResult = await chat.sendMessageStream(messages);
    let functionCallPart = null;

    for await (const chunk of streamResult.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.functionCall) {
          functionCallPart = part;
        } else if (part.text) {
          onChunk(part.text);
        }
      }
    }

    if (!functionCallPart) break;

    const { name, args } = functionCallPart.functionCall;
    const result = await runTool(name, args);
    messages = [{ functionResponse: { name, response: { result } } }];
  }
}
