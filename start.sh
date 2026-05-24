#!/bin/bash
# Hermes Console — 启动脚本
# 用法: ./start.sh [端口号]

PORT=${1:-8089}
cd "$(dirname "$0")"

# 停止已有进程
pkill -f "python3.*serve.py" 2>/dev/null || true
sleep 1

# 启动服务
export CONSOLE_PORT=$PORT
nohup python3 serve.py > /tmp/hermes-console.log 2>&1 &
echo "✅ Hermes Console 已启动"
echo "   地址: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "   日志: /tmp/hermes-console.log"
echo "   PID:  $!"
