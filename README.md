# llm-racing

Race GPT-4o mini, Claude Haiku, Gemini Flash, and Gemini Flash Lite head-to-head in real time. Ask any question and watch them stream their answers simultaneously — tokens/sec, progress bars, and a winner's podium when they finish.

Cool because you can actually *see* which model thinks faster, not just read a benchmark table.

<img width="741" height="643" alt="Screenshot 2026-03-04 at 12 54 28 PM" src="https://github.com/user-attachments/assets/79a63b2d-2a79-4a1d-a12e-e7ae92a69467" />

## Run it yourself

```bash
git clone https://github.com/estebanvargas/llm-racing
npm install
```

Add a `.env.local`:
```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

```bash
npm run dev
```
