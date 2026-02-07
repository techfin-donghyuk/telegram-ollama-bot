# telegram-ollama-bot

# 텔레그램 봇 설치
pnpm install
npm install -g pm2
pm2 start index.js --name "telegram-ollama-bot"
pm2 save
pm2 startup

# env
.env에 TELEGRAM_TOKEN을 입력해야 합니다.

# 텔레그램 봇 중지
pm2 stop telegram-ollama-bot

# 텔레그램 봇 재시작
pm2 restart telegram-ollama-bot

# 텔레그램 봇 삭제
pm2 delete telegram-ollama-bot

# 텔레그램 봇 상태 확인
pm2 status

# 텔레그램 봇 로그 확인
pm2 logs telegram-ollama-bot

# 텔레그램 봇 로그 삭제
pm2 flush telegram-ollama-bot