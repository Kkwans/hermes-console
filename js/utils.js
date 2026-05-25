/**
 * utils.js — 工具函数
 */

const Utils = {
  /**
   * 格式化时间戳
   */
  formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    if (isNaN(d.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * 脱敏 API Key
   */
  maskKey(key) {
    if (!key) return '未配置';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  },

  /**
   * 防抖
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 解析 cron 表达式为中文
   */
  describeCron(expr) {
    if (!expr) return '未知';
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) return expr;
    const [min, hour, dom, mon, dow] = parts;

    // Common patterns
    if (expr === '* * * * *') return '每分钟';
    if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '每小时整点';
    if (dom === '*' && mon === '*' && dow === '*') return `每天 ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`;
    if (mon === '*' && dow === '*') return `每月 ${dom}日 ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`;

    // Interval patterns
    const intervalMatch = expr.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (intervalMatch) return `每 ${intervalMatch[1]} 分钟`;

    const hourInterval = expr.match(/^\*\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
    if (hourInterval) return `每 ${hourInterval[1]} 小时`;

    return expr;
  },

  /**
   * 渠道图标映射
   */
  getChannelIcon(name) {
    const icons = {
      telegram: '✈️', discord: '🎮', slack: '💬', whatsapp: '📱',
      feishu: '🐦', email: '📧', signal: '🔒', matrix: '🔗',
      webchat: '🌐', api: '⚡', webhook: '🪝', sms: '📲',
      dingtalk: '🔔', wecom: '🏢', mattermost: '🐘',
      lark: '🐦', wechat: '💚', cli: '⌨️', web: '🌐',
    };
    const lower = (name || '').toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lower.includes(key)) return icon;
    }
    return '📡';
  },

  /**
   * 渠道中文名映射
   */
  getChannelLabel(name) {
    const labels = {
      telegram: 'Telegram', discord: 'Discord', slack: 'Slack', whatsapp: 'WhatsApp',
      feishu: '飞书', lark: '飞书', email: '邮件', signal: 'Signal',
      matrix: 'Matrix', webchat: '网页聊天', api: 'API', webhook: 'Webhook',
      sms: '短信', dingtalk: '钉钉', wecom: '企业微信', mattermost: 'Mattermost',
      wechat: '微信', cli: 'CLI', web: 'Web',
    };
    const lower = (name || '').toLowerCase();
    for (const [key, label] of Object.entries(labels)) {
      if (lower.includes(key)) return label;
    }
    return name;
  },

  /**
   * 渠道描述
   */
  getChannelDescription(name) {
    const descriptions = {
      feishu: '企业协作平台，支持群聊、单聊、机器人消息',
      lark: '企业协作平台（国际版），支持群聊、单聊、机器人消息',
      telegram: '即时通讯应用，支持 Bot API 消息收发',
      discord: '社区聊天平台，支持频道消息和机器人交互',
      slack: '团队协作平台，支持频道消息和 App 集成',
      whatsapp: '全球即时通讯应用，支持 Business API',
      dingtalk: '企业办公平台，支持群聊机器人消息',
      wecom: '企业内部沟通工具，支持应用消息推送',
      wechat: '个人即时通讯应用',
      email: '电子邮件收发，支持 IMAP/SMTP 协议',
      signal: '加密即时通讯应用',
      matrix: '去中心化通讯协议',
      sms: '短信收发服务',
      webchat: '网页嵌入式聊天组件',
      api: 'HTTP API 接口',
      webhook: 'Webhook 回调通知',
    };
    const lower = (name || '').toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lower.includes(key)) return desc;
    }
    return '';
  },

  /**
   * 获取柱状图颜色
   */
  getBarColor(percent) {
    if (percent >= 90) return 'bar-red';
    if (percent >= 70) return 'bar-yellow';
    return 'bar-green';
  },

  /**
   * 高亮日志关键词（HTML 转义后高亮）
   */
  highlightLogMsg(msg) {
    if (!msg) return '';
    // HTML 转义
    const escaped = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 高亮关键词
    const keywords = /(错误|异常|超时|失败|error|exception|timeout|failed|critical|fatal|panic)/gi;
    return escaped.replace(keywords, '<mark class="log-highlight">$1</mark>');
  },

  /**
   * 读取 localStorage
   */
  store: {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem('hermes_' + key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('hermes_' + key, JSON.stringify(value)); } catch {}
    },
    del(key) {
      try { localStorage.removeItem('hermes_' + key); } catch {}
    }
  }
};
