# MyGPT 🚀

MyGPT is a premium, **100% free**, and privacy-focused ChatGPT clone built with Next.js and Tailwind CSS. It leverages the power of Hugging Face's flagship models (like Llama 3.3 70B & FLUX.1) to provide a state-of-the-art AI experience directly in your browser.

## ✨ Features

- 🧠 **Elite Intelligence:** Powered by **Llama 3.3 70B** for desktop-class reasoning.
- 🎨 **AI Image Generation:** integrated with **FLUX.1-schnell**. Includes an AI prompt enhancer that turns simple ideas into detailed artistic descriptions.
- 🔍 **Real-time Web Search:** Instant internet summaries with clickable links via a high-speed search proxy.
- 🛡️ **Privacy First:** All chat history is stored locally in your browser using **IndexedDB**. Your data never leaves your device unless you're chatting with the AI.
- 💎 **Premium UI:** A stunning dark-mode interface with **Glassmorphism** aesthetics and responsive design.
- ⚡ **Turbo Performance:** Optimized streaming responses and fast-fetch search architecture.
- 💬 **Advanced Chat Features:** 
  - Multi-session management (Rename/Delete).
  - "Quote-to-Reply" for highlighting and referencing messages.
  - Markdown support with syntax highlighting.

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS
- **AI Infrastructure:** Hugging Face Inference API / Router
- **Database:** IndexedDB (Local only)
- **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 18 or later)
- A [Hugging Face](https://huggingface.co/) account and API Token.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SP-Shreya-SP/MyChat-app.git
   cd MyChat-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   HUGGINGFACE_TOKEN=your_token_here
   NEXT_PUBLIC_HF_MODEL=meta-llama/Llama-3.3-70B-Instruct
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the result.

## 📜 License

This project is open-source and available under the MIT License.

---
Built with ❤️ by [SP-Shreya-SP](https://github.com/SP-Shreya-SP)
