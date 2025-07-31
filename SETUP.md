# Mass Evaluation Tool Setup

## Prerequisites

1. Node.js installed on your system
2. OpenRouter API key from [https://openrouter.ai](https://openrouter.ai)

## Setup Instructions

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create a .env file:**
   Create a `.env` file in the root directory with your OpenRouter API key:

   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   PORT=3000
   ```

3. **Start the server:**

   ```bash
   npm start
   ```

4. **Access the tool:**
   Open your browser and go to `http://localhost:3000`

## Available Models

The tool now includes only modern models:

- **GPT o4 Mini** (openai/gpt-4o-mini)
- **GPT o3** (openai/gpt-3.5-turbo)
- **Claude 3.5 Sonnet** (anthropic/claude-3-5-sonnet)
- **Gemini 2.5 Flash** (google/gemini-2.5-flash)
- **Gemini 2.5 Pro** (google/gemini-2.5-pro)

## Usage

1. Select your preferred model from the dropdown
2. Enter your evaluation prompt
3. Add the content you want to evaluate
4. Click "Evaluate Content" to get the AI response

The tool will remember your model selection and prompt for future use.
