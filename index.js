import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import 'dotenv/config';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN 환경변수가 필요합니다');
    process.exit(1);
}

const OLLAMA_BASE = 'http://localhost:11434/api';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

/**
 * 세션 구조
 * chatId => {
 *   model: string,
 *   messages: [{ role, content }]
 * }
 */
const sessions = new Map();

function getSession(chatId) {
    if (!sessions.has(chatId)) {
        sessions.set(chatId, {
            model: 'qwen3:1.7b',
            messages: []
        });
    }
    return sessions.get(chatId);
}

/* -------------------------
 * 명령어: /start
 * ------------------------- */
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `안녕하세요! 저는 Ollama 챗봇입니다.
        \n\n/model [모델명] 으로 모델을 변경할 수 있습니다.
        \n/models 로 설치된 모델 목록을 볼 수 있습니다.
        \n/reset 로 대화 컨텍스트를 초기화 할 수 있습니다.`
    );
});

/* -------------------------
 * 명령어: /models
 * ------------------------- */
bot.onText(/\/models/, async (msg) => {
    try {
        const res = await axios.get(`${OLLAMA_BASE}/tags`);
        const models = res.data.models
            .map(m => `• ${m.name}`)
            .join('\n');

        bot.sendMessage(
            msg.chat.id,
            `📦 설치된 Ollama 모델:\n${models}`
        );
    } catch (err) {
        bot.sendMessage(msg.chat.id, '❌ 모델 목록 조회 실패');
    }
});

/* -------------------------
 * 명령어: /model <name>
 * ------------------------- */
bot.onText(/\/model (.+)/, (msg, match) => {
    const modelName = match[1].trim();
    const session = getSession(msg.chat.id);

    session.model = modelName;
    session.messages = []; // 모델 변경 시 컨텍스트 초기화

    bot.sendMessage(
        msg.chat.id,
        `✅ 모델 변경 완료\n현재 모델: ${modelName}`
    );
});

/* -------------------------
 * 명령어: /reset
 * ------------------------- */
bot.onText(/\/reset/, (msg) => {
    const session = getSession(msg.chat.id);
    session.messages = [];

    bot.sendMessage(msg.chat.id, '🧹 대화 컨텍스트를 초기화했어요');
});

/* -------------------------
 * 일반 메시지 처리
 * ------------------------- */
bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const session = getSession(chatId);

    session.messages.push({
        role: 'user',
        content: text
    });

    // 타이핑 표시
    bot.sendChatAction(chatId, 'typing');

    try {
        const res = await axios.post(`${OLLAMA_BASE}/chat`, {
            model: session.model,
            messages: session.messages,
            stream: false
        });

        const answer = res.data.message.content;

        session.messages.push({
            role: 'assistant',
            content: answer
        });

        bot.sendMessage(chatId, answer);
    } catch (err) {
        console.error(err.message);
        bot.sendMessage(chatId, '❌ Ollama 응답 중 오류 발생');
    }
});

/* -------------------------
 * 시작 로그
 * ------------------------- */
console.log('🤖 Telegram Ollama Bot 실행 중...');