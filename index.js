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
            model: 'gemma3:4b',
            messages: []
        });
    }
    return sessions.get(chatId);
}

async function resolveModelByPrefix(prefix, currentModel) {
    const res = await axios.get(`${OLLAMA_BASE}/tags`);
    const models = res.data.models.map(m => m.name);

    // prefix 매칭
    const matched = models.filter(name =>
        name.toLowerCase().startsWith(prefix.toLowerCase())
    );

    if (matched.length === 0) {
        return null;
    }

    // 현재 모델 제외
    const candidates = matched.filter(name => name !== currentModel);

    // 전부 현재 모델이면 → 그대로 반환
    if (candidates.length === 0) {
        return currentModel;
    }

    // 랜덤 선택
    const chosen =
        candidates[Math.floor(Math.random() * candidates.length)];

    return chosen;
}

/* -------------------------
 * 명령어: /start
 * ------------------------- */
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `안녕하세요! 저는 Ollama 챗봇입니다.
        \n\n/model [모델명] 으로 모델을 변경할 수 있습니다.
        \n/models 로 설치된 모델 목록을 볼 수 있습니다.
        \n/current 로 현재 사용 중인 모델을 볼 수 있습니다.
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
bot.onText(/\/model (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim();
    const session = getSession(chatId);

    try {
        const resolvedModel = await resolveModelByPrefix(
            input,
            session.model
        );

        if (!resolvedModel) {
            await bot.sendMessage(
                chatId,
                `❌ "${input}" 로 시작하는 모델을 찾을 수 없어요`
            );
            return;
        }

        // 모델 변경
        session.model = resolvedModel;
        session.messages = [];

        await bot.sendMessage(
            chatId,
            `✅ 모델 변경 완료\n` +
            `입력: ${input}\n` +
            `선택된 모델: ${resolvedModel}`
        );
    } catch (err) {
        console.error(err.message);
        await bot.sendMessage(chatId, '❌ 모델 변경 중 오류 발생');
    }
});
bot.onText(/^\/model$/, (msg) => {
    const session = getSession(msg.chat.id);

    bot.sendMessage(
        msg.chat.id,
        `🤖 현재 모델: ${session.model}
        \n\n모델 변경: /model <model-name>`
    );
});

/* -------------------------
 * 명령어: /current
 * ------------------------- */
bot.onText(/\/current/, (msg) => {
    const session = getSession(msg.chat.id);

    bot.sendMessage(
        msg.chat.id,
        `🤖 현재 모델: ${session.model}`
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
        if (!answer) {
            throw new Error('Ollama 응답에 message.content 없음');
        }

        session.messages.push({
            role: 'assistant',
            content: answer
        });

        await bot.sendMessage(chatId, answer);
    } catch (err) {
        console.error('OLLAMA ERROR:', err.response?.data || err.message);
        await bot.sendMessage(chatId, '❌ LLM 응답 처리 중 오류 발생');
    }
});

/* -------------------------
 * 시작 로그
 * ------------------------- */
console.log('🤖 Telegram Ollama Bot 실행 중...');