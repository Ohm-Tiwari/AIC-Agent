import readline from 'readline';
import { createChat, runAgent } from './agentCore.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  const chat = createChat();
  console.log("🎨 Art Institute of Chicago Agent — type 'exit' to quit\n");
  while (true) {
    const input = await ask("You: ");
    if (input.toLowerCase() === "exit") { rl.close(); break; }
    try {
      const reply = await runAgent(chat, input);
      console.log("\nAgent:", reply);
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
}

main();
